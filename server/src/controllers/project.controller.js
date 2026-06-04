import prisma from "../config/db.js";
import { emitCRMEvent } from "../socket.js";
import { sendSafeError } from "../middleware/error.middleware.js";

const PROJECT_LIST_INCLUDE = {
  department: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  tasks: {
    select: {
      id: true,
      status: true,
      progress: true,
    },
  },
  members: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          departmentId: true,
        },
      },
    },
  },
};

function getProjectProgress(tasks = []) {
  if (!tasks.length) {
    return 0;
  }

  const total = tasks.reduce(
    (sum, task) => sum + task.progress,
    0
  );

  return Math.round(total / tasks.length);
}

function mapProject(project) {
  const memberRows = project.members ?? [];
  const tasks = project.tasks ?? [];

  return {
    ...project,
    members: memberRows.map((row) => ({
      id: row.id,
      user: row.user,
    })),
    progress: getProjectProgress(tasks),
    taskCounts: {
      total: tasks.length,
      todo: tasks.filter(
        (task) => task.status === "TODO"
      ).length,
      inProgress: tasks.filter(
        (task) => task.status === "IN_PROGRESS"
      ).length,
      done: tasks.filter(
        (task) => task.status === "DONE"
      ).length,
    },
  };
}

function rosterRolesForActor(actorRole) {
  if (actorRole === "SUPERADMIN" || actorRole === "ADMIN") {
    return ["SUPERADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "INTERN"];
  }
  return ["ADMIN", "MANAGER", "EMPLOYEE", "INTERN"];
}

export async function getProjects(req, res) {
  try {
    const where =
      req.user.role === "SUPERADMIN" || req.user.role === "ADMIN"
        ? {}
        : req.user.role === "MANAGER"
          ? {
              OR: [
                { ownerId: req.user.userId },
                {
                  tasks: {
                    some: {
                      assignments: {
                        some: {
                          userId: req.user.userId,
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {
              tasks: {
                some: {
                  assignments: {
                    some: {
                      userId: req.user.userId,
                    },
                  },
                },
              },
            };

    const paginate = String(req.query.paginate || "").toLowerCase() === "true";
    const limitRaw = Number(req.query.limit);
    const offsetRaw = Number(req.query.offset);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 20;
    const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

    const baseQuery = {
      where,
      orderBy: { createdAt: "desc" },
      include: PROJECT_LIST_INCLUDE,
    };

    if (!paginate) {
      const projects = await prisma.project.findMany(baseQuery);
      return res.json(projects.map(mapProject));
    }

    const [items, total] = await Promise.all([
      prisma.project.findMany({
        ...baseQuery,
        skip: offset,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    return res.json({
      items: items.map(mapProject),
      total,
      hasMore: offset + items.length < total,
      nextOffset: offset + items.length,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch projects");
  }
}

export async function createProject(req, res) {
  try {
    const { name, description, departmentId, ownerId } = req.body;

    if (!name || !departmentId) {
      return res.status(400).json({ error: "Project name and department are required" });
    }


    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return res.status(404).json({ error: "Department not found" });
    }

    if (ownerId) {
      const owner = await prisma.user.findUnique({
  where: { id: ownerId },
  select: {
    id: true,
    role: true,
    name: true,
  },
});

      if (!owner || !["SUPERADMIN", "ADMIN", "MANAGER"].includes(owner.role)) {
        return res.status(400).json({ error: "Project owner must be leadership" });
      }
    }

    const project = await prisma.project.create({
    
      data: {
        name,
        description,
        departmentId,
        ...(ownerId ? { ownerId } : {}),
      },
      // include: PROJECT_LIST_INCLUDE,
    });

    emitCRMEvent("project:updated", {
      type: "project_created",
      projectId: project.id,
      departmentId: project.departmentId,
    });

    return res.status(201).json(mapProject(project));
  } catch (err) {
    return sendSafeError(res, err, "Unable to create project");
  }
}

export async function updateProjectMembers(req, res) {
  try {
    const { id } = req.params;
    const memberUserIdsRaw = req.body.memberUserIds;

    if (!Array.isArray(memberUserIdsRaw)) {
      return res.status(400).json({ error: "memberUserIds must be an array" });
    }

    const memberUserIds = Array.from(
      new Set(memberUserIdsRaw.map((x) => `${x ?? ""}`.trim()).filter(Boolean))
    );

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, departmentId: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const rosterRoles = rosterRolesForActor(req.user.role);

    if (memberUserIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: memberUserIds } },
        select: { id: true, departmentId: true, role: true },
      });

      if (users.length !== memberUserIds.length) {
        return res.status(400).json({ error: "One or more user ids are invalid" });
      }

      for (const u of users) {
        if (u.departmentId !== project.departmentId) {
          return res.status(400).json({
            error: "Project team members must belong to the project's department",
          });
        }
        if (!rosterRoles.includes(u.role)) {
          return res.status(400).json({ error: "This role cannot be added to a project team" });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.projectMember.deleteMany({ where: { projectId: id } });
      if (memberUserIds.length) {
        await tx.projectMember.createMany({
          data: memberUserIds.map((userId) => ({ projectId: id, userId })),
        });
      }
    });

    const updated = await prisma.project.findUnique({
      where: { id },
      include: PROJECT_LIST_INCLUDE,
    });

    emitCRMEvent("project:updated", {
      type: "project_members_updated",
      projectId: id,
      departmentId: project.departmentId,
    });

    return res.json(mapProject(updated));
  } catch (err) {
    return sendSafeError(res, err, "Unable to update project team");
  }
}
