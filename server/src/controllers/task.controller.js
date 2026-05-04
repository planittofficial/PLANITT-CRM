import prisma from "../config/db.js";
import { emitCRMEvent } from "../socket.js";
import { sendSafeError } from "../middleware/error.middleware.js";

function getTaskInclude() {
  return {
    assignments: {
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
    checklistItems: {
      orderBy: { createdAt: "asc" },
    },
    issues: {
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    },
  };
}

function deriveTaskStateFromChecklist(items) {
  if (!items.length) {
    return null;
  }

  const completed = items.filter((item) => item.completed).length;
  const progress = Math.round((completed / items.length) * 100);
  const status = progress >= 100 ? "DONE" : progress > 0 ? "IN_PROGRESS" : "TODO";

  return { progress, status };
}

async function syncTaskProgress(taskId) {
  const items = await prisma.taskChecklistItem.findMany({
    where: { taskId },
  });

  const derived = deriveTaskStateFromChecklist(items);

  if (!derived) {
    return prisma.task.findUnique({
      where: { id: taskId },
      include: getTaskInclude(),
    });
  }

  return prisma.task.update({
    where: { id: taskId },
    data: derived,
    include: getTaskInclude(),
  });
}

function isLeadership(role) {
  return role === "SUPERADMIN" || role === "ADMIN" || role === "MANAGER";
}

const TASK_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);

function normalizePriority(value, fallback = "MEDIUM") {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  return TASK_PRIORITIES.has(raw) ? raw : fallback;
}

const LEADERSHIP_ROLES = ["SUPERADMIN", "ADMIN", "MANAGER"];

async function validateProjectTaskAssignees(projectId, userIds) {
  if (!projectId || !Array.isArray(userIds) || userIds.length === 0) {
    return null;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      members: { select: { userId: true } },
    },
  });

  if (!project) {
    return { status: 404, error: "Project not found" };
  }

  if (!project.members.length) {
    return null;
  }

  const allowed = new Set(project.members.map((m) => m.userId));
  const invalid = userIds.filter((id) => !allowed.has(id));

  if (invalid.length) {
    return {
      status: 400,
      error: "Assignees must be on the project team. Add them under project team first, or clear the team to assign from the full directory.",
    };
  }

  return null;
}

export async function createTask(req, res) {
  try {
    const { title, description, userIds = [], progress = 0, checklistItems = [], projectId, priority } =
      req.body;

    if (!title) {
      return res.status(400).json({ error: "Task title is required" });
    }

    const normalizedChecklistItems = Array.isArray(checklistItems)
      ? checklistItems
          .map((item) => `${item ?? ""}`.trim())
          .filter(Boolean)
      : [];

    const normalizedProgress = normalizedChecklistItems.length
      ? 0
      : Math.min(100, Math.max(0, Number(progress) || 0));
    const initialStatus = normalizedChecklistItems.length
      ? "TODO"
      : normalizedProgress >= 100
        ? "DONE"
        : normalizedProgress > 0
          ? "IN_PROGRESS"
          : "TODO";

    if (projectId) {
      const assigneeError = await validateProjectTaskAssignees(projectId, userIds);
      if (assigneeError) {
        return res.status(assigneeError.status).json({ error: assigneeError.error });
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: normalizePriority(priority),
        ...(projectId ? { projectId } : {}),
        status: initialStatus,
        progress: normalizedProgress,
        assignments: {
          create: userIds.map((id) => ({
            userId: id,
          })),
        },
        checklistItems: {
          create: normalizedChecklistItems.map((item) => ({
            title: item,
          })),
        },
      },
      include: getTaskInclude(),
    });

    let projectAssignedUserIds = [];
    if (task.projectId) {
      const projectAssignments = await prisma.taskAssignment.findMany({
        where: {
          task: {
            projectId: task.projectId,
          },
          user: {
            role: {
              in: ["EMPLOYEE", "INTERN"],
            },
          },
        },
        select: {
          userId: true,
        },
      });
      projectAssignedUserIds = Array.from(new Set(projectAssignments.map((item) => item.userId)));
    }

    emitCRMEvent("task:updated", {
      type: "task_created",
      taskId: task.id,
      projectId: task.projectId ?? null,
      taskTitle: task.title,
      actorId: req.user.userId,
      actorRole: req.user.role,
      assignedUserIds: task.assignments.map((assignment) => assignment.userId),
      projectAssignedUserIds,
    });
    if (task.projectId) {
      emitCRMEvent("project:updated", {
        type: "project_progress_updated",
        projectId: task.projectId,
      });
    }

    return res.status(201).json(task);
  } catch (err) {
    return sendSafeError(res, err, "Unable to create task");
  }
}

export async function getTasks(_req, res) {
  try {
    const projectFilter = _req.query.projectId
      ? { projectId: _req.query.projectId }
      : {};
    const roleWhere =
      _req.user.role === "SUPERADMIN" || _req.user.role === "ADMIN" || _req.user.role === "MANAGER"
        ? {}
        : {
            assignments: {
              some: {
                userId: _req.user.userId,
              },
            },
          };
    const where = {
      ...roleWhere,
      ...projectFilter,
    };

    const paginate = String(_req.query.paginate || "").toLowerCase() === "true";
    const limitRaw = Number(_req.query.limit);
    const offsetRaw = Number(_req.query.offset);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 30;
    const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

    const taskOrderBy = [{ priority: "desc" }, { createdAt: "desc" }];

    if (!paginate) {
      const tasks = await prisma.task.findMany({
        where,
        orderBy: taskOrderBy,
        include: getTaskInclude(),
      });
      return res.json(tasks);
    }

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: taskOrderBy,
        skip: offset,
        take: limit,
        include: getTaskInclude(),
      }),
      prisma.task.count({ where }),
    ]);

    return res.json({
      items,
      total,
      hasMore: offset + items.length < total,
      nextOffset: offset + items.length,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch tasks");
  }
}

export async function updateTaskStatus(req, res) {
  try {
    const { status, progress, title, description, userIds, checklistItems, priority } = req.body;

    const isStructurePayload =
      typeof title === "string" ||
      typeof description === "string" ||
      Array.isArray(userIds) ||
      Array.isArray(checklistItems);

    const hasPriorityUpdate = typeof priority === "string";

    if (!isStructurePayload && !hasPriorityUpdate && !status && typeof progress !== "number") {
      return res.status(400).json({ error: "Task update payload is empty" });
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: true,
        checklistItems: true,
      },
    });

    if (!existingTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    const previousAssigneeIds = existingTask.assignments.map((assignment) => assignment.userId);

    const isLeader = isLeadership(req.user.role);
    const canUpdate =
      isLeader ||
      existingTask.assignments.some((assignment) => assignment.userId === req.user.userId);

    if (!canUpdate) {
      return res.status(403).json({ error: "You are not allowed to update this task" });
    }

    if (isStructurePayload && !isLeader) {
      return res.status(403).json({ error: "Only leadership can modify task details" });
    }

    if (hasPriorityUpdate) {
      const canChangePriority =
        isLeader ||
        existingTask.assignments.some((assignment) => assignment.userId === req.user.userId);
      if (!canChangePriority) {
        return res.status(403).json({ error: "You are not allowed to change this task's priority" });
      }
    }

    const emitAsStructureChange = isStructurePayload || hasPriorityUpdate;

    const normalizedChecklistItems = Array.isArray(checklistItems)
      ? checklistItems
          .map((item) => `${item ?? ""}`.trim())
          .filter(Boolean)
      : null;

    const willHaveChecklist =
      normalizedChecklistItems !== null
        ? normalizedChecklistItems.length > 0
        : existingTask.checklistItems.length > 0;

    if (willHaveChecklist && typeof progress === "number" && normalizedChecklistItems === null) {
      return res.status(400).json({
        error: "Progress is controlled by checklist completion for this task",
      });
    }

    const normalizedProgress =
      typeof progress === "number"
        ? Math.min(100, Math.max(0, progress))
        : status === "DONE"
          ? 100
          : status === "TODO"
            ? 0
            : existingTask.progress;

    const nextStatus =
      status ??
      (normalizedProgress >= 100
        ? "DONE"
        : normalizedProgress > 0
          ? "IN_PROGRESS"
          : "TODO");

    if (Array.isArray(userIds) && existingTask.projectId) {
      const assigneeError = await validateProjectTaskAssignees(existingTask.projectId, userIds);
      if (assigneeError) {
        return res.status(assigneeError.status).json({ error: assigneeError.error });
      }
    }

    const task = await prisma.$transaction(async (tx) => {
      if (Array.isArray(userIds)) {
        await tx.taskAssignment.deleteMany({
          where: { taskId: req.params.id },
        });

        if (userIds.length) {
          await tx.taskAssignment.createMany({
            data: userIds.map((id) => ({
              taskId: req.params.id,
              userId: id,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (normalizedChecklistItems !== null) {
        await tx.taskChecklistItem.deleteMany({
          where: { taskId: req.params.id },
        });

        if (normalizedChecklistItems.length) {
          await tx.taskChecklistItem.createMany({
            data: normalizedChecklistItems.map((item) => ({
              taskId: req.params.id,
              title: item,
            })),
          });
        }
      }

      const taskData = {
        ...(typeof title === "string" ? { title: title.trim() || existingTask.title } : {}),
        ...(typeof description === "string" ? { description } : {}),
        ...(hasPriorityUpdate
          ? { priority: normalizePriority(priority, existingTask.priority ?? "MEDIUM") }
          : {}),
        status: normalizedChecklistItems && normalizedChecklistItems.length ? "TODO" : nextStatus,
        progress: normalizedChecklistItems && normalizedChecklistItems.length ? 0 : normalizedProgress,
      };

      await tx.task.update({
        where: { id: req.params.id },
        data: taskData,
      });

      if (normalizedChecklistItems !== null && normalizedChecklistItems.length) {
        return tx.task.findUnique({
          where: { id: req.params.id },
          include: getTaskInclude(),
        });
      }

      return tx.task.findUnique({
        where: { id: req.params.id },
        include: getTaskInclude(),
      });
    });

    emitCRMEvent("task:updated", {
      type: emitAsStructureChange ? "task_modified" : "task_progress_updated",
      taskId: task.id,
      projectId: task.projectId ?? null,
      taskTitle: task.title,
      actorId: req.user.userId,
      actorRole: req.user.role,
      assignedUserIds: task.assignments.map((assignment) => assignment.userId),
      newlyAssignedUserIds: task.assignments
        .map((assignment) => assignment.userId)
        .filter((userId) => !previousAssigneeIds.includes(userId)),
      progress: task.progress,
      status: task.status,
    });
    if (task.projectId) {
      emitCRMEvent("project:updated", {
        type: "project_progress_updated",
        projectId: task.projectId,
      });
    }

    return res.json(task);
  } catch (err) {
    return sendSafeError(res, err, "Unable to update task");
  }
}

export async function deleteTask(req, res) {
  try {
    if (!isLeadership(req.user.role)) {
      return res.status(403).json({ error: "Only leadership can delete tasks" });
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!existingTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    await prisma.task.delete({
      where: { id: req.params.id },
    });

    emitCRMEvent("task:updated", {
      type: "task_deleted",
      taskId: existingTask.id,
      projectId: existingTask.projectId ?? null,
    });

    if (existingTask.projectId) {
      emitCRMEvent("project:updated", {
        type: "project_progress_updated",
        projectId: existingTask.projectId,
      });
    }

    return res.status(204).send();
  } catch (err) {
    return sendSafeError(res, err, "Unable to update task progress");
  }
}

export async function toggleChecklistItem(req, res) {
  try {
    const item = await prisma.taskChecklistItem.findUnique({
      where: { id: req.params.itemId },
      include: {
        task: {
          include: {
            assignments: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Checklist item not found" });
    }

    const canUpdate =
      req.user.role === "SUPERADMIN" ||
      req.user.role === "ADMIN" ||
      req.user.role === "MANAGER" ||
      item.task.assignments.some((assignment) => assignment.userId === req.user.userId);

    if (!canUpdate) {
      return res.status(403).json({ error: "You are not allowed to update this checklist item" });
    }

    await prisma.taskChecklistItem.update({
      where: { id: req.params.itemId },
      data: {
        completed: !item.completed,
        completedAt: item.completed ? null : new Date(),
      },
    });

    const task = await syncTaskProgress(item.taskId);
    emitCRMEvent("task:updated", {
      type: "checklist_toggled",
      taskId: item.taskId,
      projectId: task.projectId ?? null,
      checklistItemId: req.params.itemId,
      progress: task.progress,
      status: task.status,
    });
    if (task.projectId) {
      emitCRMEvent("project:updated", {
        type: "project_progress_updated",
        projectId: task.projectId,
      });
    }
    return res.json(task);
  } catch (err) {
    return sendSafeError(res, err, "Unable to delete task");
  }
}

export async function createTaskIssue(req, res) {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Issue title and description are required" });
    }

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const canReport =
      req.user.role === "SUPERADMIN" ||
      req.user.role === "ADMIN" ||
      req.user.role === "MANAGER" ||
      task.assignments.some((assignment) => assignment.userId === req.user.userId);

    if (!canReport) {
      return res.status(403).json({ error: "You are not allowed to report an issue on this task" });
    }

    const issue = await prisma.taskIssue.create({
      data: {
        taskId: req.params.id,
        reporterId: req.user.userId,
        title,
        description,
      },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    emitCRMEvent("task:updated", {
      type: "issue_reported",
      taskId: req.params.id,
      projectId: task.projectId ?? null,
      issueId: issue.id,
      taskTitle: task.title,
      issueTitle: issue.title,
      actorId: req.user.userId,
      actorRole: req.user.role,
      reporterId: req.user.userId,
      reporterName: issue.reporter.name,
      assignedUserIds: task.assignments.map((assignment) => assignment.userId),
      notifyRoles: LEADERSHIP_ROLES,
    });
    emitCRMEvent("issue:updated", {
      type: "issue_reported",
      taskId: req.params.id,
      issueId: issue.id,
      taskTitle: task.title,
      issueTitle: issue.title,
      actorId: req.user.userId,
      actorRole: req.user.role,
      reporterId: req.user.userId,
      reporterName: issue.reporter.name,
      assignedUserIds: task.assignments.map((assignment) => assignment.userId),
      notifyRoles: LEADERSHIP_ROLES,
    });

    return res.status(201).json(issue);
  } catch (err) {
    return sendSafeError(res, err, "Unable to update checklist item");
  }
}

export async function respondToTaskIssue(req, res) {
  try {
    const { managerResponse, status = "RESOLVED" } = req.body;

    if (!managerResponse) {
      return res.status(400).json({ error: "Manager response is required" });
    }

    const issue = await prisma.taskIssue.findUnique({
      where: { id: req.params.issueId },
      select: {
        id: true,
        taskId: true,
        task: {
          select: {
            id: true,
            title: true,
            projectId: true,
            assignments: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    const canRespond =
      req.user.role === "SUPERADMIN" ||
      req.user.role === "ADMIN" ||
      req.user.role === "MANAGER";

    if (!canRespond) {
      return res.status(403).json({ error: "Only leadership can respond to issues" });
    }

    const updatedIssue = await prisma.taskIssue.update({
      where: { id: req.params.issueId },
      data: {
        managerResponse,
        status,
        resolvedById: req.user.userId,
      },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    emitCRMEvent("task:updated", {
      type: "issue_responded",
      taskId: issue.taskId,
      projectId: issue.task.projectId ?? null,
      issueId: updatedIssue.id,
      taskTitle: issue.task.title,
      issueTitle: updatedIssue.title,
      actorId: req.user.userId,
      actorRole: req.user.role,
      reporterId: updatedIssue.reporter.id,
      assignedUserIds: issue.task.assignments.map((assignment) => assignment.userId),
    });
    emitCRMEvent("issue:updated", {
      type: "issue_responded",
      taskId: issue.taskId,
      issueId: updatedIssue.id,
      taskTitle: issue.task.title,
      issueTitle: updatedIssue.title,
      actorId: req.user.userId,
      actorRole: req.user.role,
      reporterId: updatedIssue.reporter.id,
      assignedUserIds: issue.task.assignments.map((assignment) => assignment.userId),
    });

    return res.json(updatedIssue);
  } catch (err) {
    return sendSafeError(res, err, "Unable to update issue");
  }
}
