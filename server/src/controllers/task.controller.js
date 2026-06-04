import prisma from "../config/db.js";
import { emitCRMEvent, emitNotificationToRole } from "../socket.js";
import {
  createBulkNotifications,
  getNotificationRecipientsByRoles,
  isNotificationTypeEnabled,
} from "../services/notification.service.js";
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

function isSuperAdmin(role) {
  return role === "SUPERADMIN";
}

async function getCurrentUserDepartmentId(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });
  return user?.departmentId ?? null;
}

function getDepartmentScopedTaskWhere(departmentId, userId, role) {
  if (!departmentId && isLeadership(role)) {
    return {};
  }

  if (!departmentId) {
    return {
      OR: [{ assignedById: userId }, { assignments: { some: { userId } } }],
    };
  }

  return {
    OR: [
      { project: { departmentId } },
      { assignments: { some: { user: { departmentId } } } },
      { assignedById: userId },
      { assignments: { some: { userId } } },
    ],
  };
}

function canAccessTaskByDepartment(task, departmentId, userId, role) {
  if (!departmentId && isLeadership(role)) {
    return true;
  }

  if (task.assignedById === userId) {
    return true;
  }

  if (task.assignments.some((assignment) => assignment.userId === userId)) {
    return true;
  }

  if (!departmentId) {
    return false;
  }

  if (task.project?.departmentId === departmentId) {
    return true;
  }

  return task.assignments.some((assignment) => assignment.user?.departmentId === departmentId);
}

const TASK_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);

function normalizePriority(value, fallback = "MEDIUM") {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  return TASK_PRIORITIES.has(raw) ? raw : fallback;
}

const LEADERSHIP_ROLES = ["SUPERADMIN", "ADMIN", "MANAGER"];

async function filterNotificationTargets(userIds, type, actorId = null) {
  const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean))).filter((id) => id !== actorId);
  const targets = [];
  for (const uid of uniqueIds) {
    if (await isNotificationTypeEnabled(uid, type)) {
      targets.push(uid);
    }
  }
  return targets;
}

function extractTaskMentionTerms(...values) {
  const text = values
    .flat()
    .filter(Boolean)
    .join(" ");
  const matches = text.match(/@([a-zA-Z0-9._-]+)/g) ?? [];
  return Array.from(new Set(matches.map((item) => item.slice(1).toLowerCase())));
}

async function getMentionedUserIdsFromTaskContent(values, actorId) {
  const terms = extractTaskMentionTerms(values);
  if (!terms.length) {
    return [];
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
  });

  return users
    .filter((user) => {
      if (user.id === actorId) {
        return false;
      }
      const emailName = user.email.split("@")[0]?.toLowerCase() || "";
      const nameParts = user.name.toLowerCase().split(/\s+/).filter(Boolean);
      return terms.some((term) => term === emailName || nameParts.includes(term));
    })
    .map((user) => user.id);
}

async function notifyTaskMentions({ task, values, actorId }) {
  const mentionedUserIds = await getMentionedUserIdsFromTaskContent(values, actorId);
  const targets = await filterNotificationTargets(mentionedUserIds, "TASK_MENTION", actorId);
  if (!targets.length) {
    return;
  }

  await createBulkNotifications(targets, {
    type: "TASK_MENTION",
    title: "You were mentioned in a task",
    message: `${task.title} mentions you.`,
    href: `/tasks?taskId=${task.id}`,
    priority: task.priority === "URGENT" || task.priority === "HIGH" ? "HIGH" : "MEDIUM",
    taskId: task.id,
    projectId: task.projectId ?? null,
    actorId,
    groupKey: `task:${task.id}:mention`,
  });
}

function runNotificationJob(label, job) {
  setImmediate(() => {
    Promise.resolve()
      .then(job)
      .catch((error) => {
        console.error(`Error creating ${label} notifications:`, error);
      });
  });
}

function parseDeadlineInput(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "INVALID";
  }
  return parsed;
}

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
    const { title, description, userIds = [], progress = 0, checklistItems = [], projectId, priority, deadlineAt } =
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

    const parsedDeadline = parseDeadlineInput(deadlineAt);
    if (parsedDeadline === "INVALID") {
      return res.status(400).json({ error: "Deadline is not a valid date-time value" });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: normalizePriority(priority),
        deadlineAt: parsedDeadline,
        assignedById: userIds.length ? req.user.userId : null,
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

    // Notify assigned users about new task assignment after the task response is sent.
    runNotificationJob("task assignment", async () => {
      const assignedUserIds = task.assignments.map((a) => a.userId).filter(Boolean);
      const targets = await filterNotificationTargets(assignedUserIds, "TASK_ASSIGNED", req.user.userId);
      if (targets.length) {
        await createBulkNotifications(targets, {
          type: "TASK_ASSIGNED",
          title: "New Task Assigned",
          message: `${task.title} assigned to you.`,
          href: `/tasks?taskId=${task.id}`,
          priority: "HIGH",
          taskId: task.id,
          actorId: req.user.userId,
          groupKey: `task:${task.id}:assignment`,
        });
      }
    });

    runNotificationJob("task mention", async () => {
      await notifyTaskMentions({
        task,
        values: [task.title, task.description, normalizedChecklistItems],
        actorId: req.user.userId,
      });
    });

    return res.status(201).json(task);
  } catch (err) {
    return sendSafeError(res, err, "Unable to create task");
  }
}

export async function getTasks(_req, res) {
  try {
    const actorRole = String(_req.user?.role ?? "").trim().toUpperCase();
    const actorUserId = String(_req.user?.userId ?? "").trim();


    const projectFilter = _req.query.projectId
      ? { projectId: _req.query.projectId }
      : {};
    const q = typeof _req.query.q === "string" ? _req.query.q.trim() : "";
    const isLeadership =
      actorRole === "SUPERADMIN" || actorRole === "ADMIN" || actorRole === "MANAGER";

    if (!isLeadership && !actorUserId) {
      return res.status(401).json({ error: "Unauthorized user context" });
    }

    // Compose roleWhere based on leadership
    const roleWhere = isLeadership
      ? {}
      : {
          project: {
            members: {
              some: {
                userId: actorUserId,
              },
            },
          },
        };

    // Compose searchWhere if q is present
    const searchWhere = q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { project: { name: { contains: q, mode: "insensitive" } } },
            { assignments: { some: { user: { name: { contains: q, mode: "insensitive" } } } } },
          ],
        }
      : {};

    // Merge all filters into one where object
    const where = {
      ...roleWhere,
      ...projectFilter,
      ...searchWhere,
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
    const { status, progress, title, description, userIds, checklistItems, priority, deadlineAt } = req.body;

    const isStructurePayload =
      typeof title === "string" ||
      typeof description === "string" ||
      Array.isArray(userIds) ||
      Array.isArray(checklistItems);

    const hasPriorityUpdate = typeof priority === "string";
    const hasDeadlineUpdate = Object.prototype.hasOwnProperty.call(req.body, "deadlineAt");

    if (!isStructurePayload && !hasPriorityUpdate && !hasDeadlineUpdate && !status && typeof progress !== "number") {
      return res.status(400).json({ error: "Task update payload is empty" });
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                departmentId: true,
              },
            },
          },
        },
        checklistItems: true,
        project: {
          select: {
            id: true,
            departmentId: true,
          },
        },
      },
    });

    if (!existingTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (!isSuperAdmin(req.user.role)) {
      const departmentId = await getCurrentUserDepartmentId(req.user.userId);
      if (!canAccessTaskByDepartment(existingTask, departmentId, req.user.userId, req.user.role)) {
        return res.status(403).json({ error: "You are not allowed to access this task" });
      }
    }

    const previousAssigneeIds = existingTask.assignments.map((assignment) => assignment.userId);

    const isLeader = isLeadership(req.user.role);
    const canUpdate =
      isLeader ||
      existingTask.assignments.some((assignment) => assignment.userId === req.user.userId);

    if (!canUpdate) {
      return res.status(403).json({ error: "You are not allowed to update this task" });
    }

    if ((isStructurePayload || hasDeadlineUpdate) && !isLeader) {
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

    const emitAsStructureChange = isStructurePayload || hasPriorityUpdate || hasDeadlineUpdate;

    const parsedDeadline = hasDeadlineUpdate ? parseDeadlineInput(deadlineAt) : undefined;
    if (parsedDeadline === "INVALID") {
      return res.status(400).json({ error: "Deadline is not a valid date-time value" });
    }

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
        ...(hasDeadlineUpdate ? { deadlineAt: parsedDeadline } : {}),
        ...(Array.isArray(userIds) ? { assignedById: userIds.length ? req.user.userId : null } : {}),
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

    runNotificationJob("new task assignment", async () => {
      const newlyAssigned = task.assignments
        .map((assignment) => assignment.userId)
        .filter((userId) => !previousAssigneeIds.includes(userId));
      const targets = await filterNotificationTargets(newlyAssigned, "TASK_ASSIGNED", req.user.userId);
      if (targets.length) {
        await createBulkNotifications(targets, {
          type: "TASK_ASSIGNED",
          title: "Task Assigned",
          message: `${task.title} assigned to you.`,
          href: `/tasks?taskId=${task.id}`,
          priority: "MEDIUM",
          taskId: task.id,
          actorId: req.user.userId,
          groupKey: `task:${task.id}:assignment`,
        });
      }
    });

    runNotificationJob("task update", async () => {
      const updateType = emitAsStructureChange ? "TASK_UPDATED" : "TASK_PROGRESS";
      const targets = await filterNotificationTargets(
        task.assignments.map((assignment) => assignment.userId),
        updateType,
        req.user.userId
      );
      if (targets.length) {
        await createBulkNotifications(targets, {
          type: updateType,
          title: emitAsStructureChange ? "Task Updated" : "Task Progress Updated",
          message: emitAsStructureChange
            ? `${task.title} was updated.`
            : `${task.title} is now ${task.progress}% complete.`,
          href: `/tasks?taskId=${task.id}`,
          priority: task.priority === "URGENT" || task.priority === "HIGH" ? "HIGH" : "MEDIUM",
          taskId: task.id,
          projectId: task.projectId ?? null,
          actorId: req.user.userId,
          groupKey: `task:${task.id}:${updateType.toLowerCase()}`,
        });
      }
    });

    runNotificationJob("task mention", async () => {
      await notifyTaskMentions({
        task,
        values: [
          typeof title === "string" ? title : task.title,
          typeof description === "string" ? description : task.description,
          normalizedChecklistItems ?? task.checklistItems.map((item) => item.title),
        ],
        actorId: req.user.userId,
      });
    });

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
        project: {
          select: {
            departmentId: true,
          },
        },
        assignments: {
          select: {
            user: {
              select: {
                departmentId: true,
              },
            },
          },
        },
      },
    });

    if (!existingTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (!isSuperAdmin(req.user.role)) {
      const departmentId = await getCurrentUserDepartmentId(req.user.userId);
      if (!canAccessTaskByDepartment(existingTask, departmentId, req.user.userId, req.user.role)) {
        return res.status(403).json({ error: "You are not allowed to access this task" });
      }
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
            assignments: {
              include: {
                user: {
                  select: {
                    id: true,
                    departmentId: true,
                  },
                },
              },
            },
            project: {
              select: {
                id: true,
                departmentId: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Checklist item not found" });
    }

    if (!isSuperAdmin(req.user.role)) {
      const departmentId = await getCurrentUserDepartmentId(req.user.userId);
      if (!canAccessTaskByDepartment(item.task, departmentId, req.user.userId, req.user.role)) {
        return res.status(403).json({ error: "You are not allowed to access this task" });
      }
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

    (async () => {
      try {
        const targets = await filterNotificationTargets(
          task.assignments.map((assignment) => assignment.userId),
          "TASK_PROGRESS",
          req.user.userId
        );
        if (targets.length) {
          await createBulkNotifications(targets, {
            type: "TASK_PROGRESS",
            title: "Task Progress Updated",
            message: `${task.title} is now ${task.progress}% complete.`,
            href: `/tasks?taskId=${task.id}`,
            priority: task.priority === "URGENT" || task.priority === "HIGH" ? "HIGH" : "MEDIUM",
            taskId: task.id,
            projectId: task.projectId ?? null,
            actorId: req.user.userId,
            groupKey: `task:${task.id}:task_progress`,
          });
        }
      } catch (e) {
        console.error("Error creating checklist progress notifications:", e);
      }
    })();
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
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                departmentId: true,
              },
            },
          },
        },
        project: {
          select: {
            id: true,
            departmentId: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (!isSuperAdmin(req.user.role)) {
      const departmentId = await getCurrentUserDepartmentId(req.user.userId);
      if (!canAccessTaskByDepartment(task, departmentId, req.user.userId, req.user.role)) {
        return res.status(403).json({ error: "You are not allowed to access this task" });
      }
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

    (async () => {
      try {
        const leadershipIds = await getNotificationRecipientsByRoles(LEADERSHIP_ROLES, [req.user.userId]);
        const targets = await filterNotificationTargets(leadershipIds, "ISSUE_REPORTED", req.user.userId);
        const notificationPayload = {
          type: "ISSUE_REPORTED",
          title: "Task Issue Reported",
          message: `${issue.reporter.name} reported "${issue.title}" on ${task.title}.`,
          href: `/tasks?taskId=${task.id}&issueId=${issue.id}`,
          priority: "HIGH",
          taskId: task.id,
          projectId: task.projectId ?? null,
          issueId: issue.id,
          actorId: req.user.userId,
          groupKey: `issue:${issue.id}:reported`,
        };

        if (targets.length) {
          await createBulkNotifications(targets, notificationPayload);
        } else {
          const transientNotification = {
            id: `transient:issue:${issue.id}:${Date.now()}`,
            read: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...notificationPayload,
          };
          emitNotificationToRole("ADMIN", transientNotification);
          emitNotificationToRole("MANAGER", transientNotification);
          emitNotificationToRole("SUPERADMIN", transientNotification);
        }
      } catch (e) {
        console.error("Error creating issue reported notifications:", e);
      }
    })();

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
            project: {
              select: {
                departmentId: true,
              },
            },
            assignments: {
              select: {
                userId: true,
                user: {
                  select: {
                    departmentId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    if (!isSuperAdmin(req.user.role)) {
      const departmentId = await getCurrentUserDepartmentId(req.user.userId);
      if (!canAccessTaskByDepartment(issue.task, departmentId, req.user.userId, req.user.role)) {
        return res.status(403).json({ error: "You are not allowed to access this task" });
      }
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

    (async () => {
      try {
        const targets = await filterNotificationTargets([updatedIssue.reporter.id], "ISSUE_RESPONDED", req.user.userId);
        if (targets.length) {
          await createBulkNotifications(targets, {
            type: status === "RESOLVED" ? "ISSUE_RESOLVED" : "ISSUE_RESPONDED",
            title: status === "RESOLVED" ? "Issue Resolved" : "Issue Response Added",
            message: `${updatedIssue.title} on ${issue.task.title} has a manager response.`,
            href: `/tasks?taskId=${issue.taskId}&issueId=${updatedIssue.id}`,
            priority: "HIGH",
            taskId: issue.taskId,
            projectId: issue.task.projectId ?? null,
            issueId: updatedIssue.id,
            actorId: req.user.userId,
            groupKey: `issue:${updatedIssue.id}:response`,
          });
        }
      } catch (e) {
        console.error("Error creating issue response notifications:", e);
      }
    })();

    return res.json(updatedIssue);
  } catch (err) {
    return sendSafeError(res, err, "Unable to update issue");
  }
}
