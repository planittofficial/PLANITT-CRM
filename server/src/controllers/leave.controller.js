import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../config/db.js";
import { emitCRMEvent } from "../socket.js";
import { sendSafeError } from "../middleware/error.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_LEAVE_TYPES = [
  { name: "Sick Leave", description: "Medical or health-related leave." },
  { name: "Casual Leave", description: "Personal or short-term leave." },
  { name: "Vacation", description: "Planned holiday or vacation time." },
  { name: "Emergency", description: "Urgent and unexpected leave." },
  { name: "Maternity", description: "Maternity or parental leave." },
  { name: "Other", description: "Other leave reasons." },
];

function isLeadershipRole(role) {
  return ["SUPERADMIN", "ADMIN", "MANAGER"].includes(role);
}

async function ensureLeaveTypes() {
  const count = await prisma.leaveType.count();
  if (count > 0) {
    return;
  }
  await prisma.leaveType.createMany({
    data: DEFAULT_LEAVE_TYPES,
    skipDuplicates: true,
  });
}

function getLeaveSelect() {
  return {
    id: true,
    userId: true,
    managerId: true,
    leaveTypeId: true,
    startDate: true,
    endDate: true,
    reason: true,
    attachmentUrl: true,
    status: true,
    requestedAt: true,
    updatedAt: true,
    leaveType: {
      select: {
        id: true,
        name: true,
        description: true,
      },
    },
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    },
    manager: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    },
    comments: {
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        message: true,
        createdAt: true,
        author: {
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

async function resolveAssignedManager(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { managerId: true, departmentId: true },
  });
  if (!user) {
    return null;
  }
  if (user.managerId) {
    return user.managerId;
  }
  if (!user.departmentId) {
    return null;
  }
  const department = await prisma.department.findUnique({
    where: { id: user.departmentId },
    select: { headId: true },
  });
  return department?.headId ?? null;
}

function canViewLeave(user, leaveRequest) {
  if (!leaveRequest) {
    return false;
  }
  if (leaveRequest.userId === user.userId) {
    return true;
  }
  if (user.role === "SUPERADMIN" || user.role === "ADMIN") {
    return true;
  }
  if (user.role === "MANAGER" && leaveRequest.managerId === user.userId) {
    return true;
  }
  return false;
}

function canManageLeave(user, leaveRequest) {
  if (user.role === "SUPERADMIN" || user.role === "ADMIN") {
    return true;
  }
  if (user.role === "MANAGER" && leaveRequest.managerId === user.userId) {
    return true;
  }
  return false;
}

function getLeaveNotificationPayload(req, leaveRequest, extra = {}) {
  return {
    actorId: req.user.userId,
    leaveId: leaveRequest.id,
    assignedUserIds: [leaveRequest.userId, leaveRequest.managerId].filter(Boolean),
    notifyRoles: ["SUPERADMIN", "ADMIN"],
    ...extra,
  };
}

async function createLeaveRequest(req, res) {
  try {
    const currentUserId = req.user.userId;
    const leaveTypeId = String(req.body.leaveTypeId || "").trim();
    const startDate = new Date(String(req.body.startDate || ""));
    const endDate = new Date(String(req.body.endDate || ""));
    const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    const attachmentUrl = typeof req.body.attachmentUrl === "string" ? req.body.attachmentUrl.trim() : null;

    if (!leaveTypeId || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Leave type, start date, and end date are required." });
    }

    if (startDate > endDate) {
      return res.status(400).json({ error: "Start date cannot be later than end date." });
    }

    const managerId = await resolveAssignedManager(currentUserId);

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        userId: currentUserId,
        managerId,
        leaveTypeId,
        startDate,
        endDate,
        reason: reason || null,
        attachmentUrl,
      },
      select: getLeaveSelect(),
    });

    emitCRMEvent(
      "leave:created",
      getLeaveNotificationPayload(req, leaveRequest, {
        assignedUserIds: managerId ? [managerId] : [],
      })
    );

    return res.status(201).json(leaveRequest);
  } catch (err) {
    return sendSafeError(res, err, "Unable to create leave request");
  }
}

async function getLeaveTypes(req, res) {
  try {
    await ensureLeaveTypes();
    const types = await prisma.leaveType.findMany({ orderBy: { name: "asc" } });
    return res.json(types);
  } catch (err) {
    return sendSafeError(res, err, "Unable to load leave types");
  }
}

async function getLeaveRequests(req, res) {
  try {
    const currentUserId = req.user.userId;
    const status = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const where = {};

    if (req.user.role === "SUPERADMIN" || req.user.role === "ADMIN") {
      // no extra restriction
    } else if (req.user.role === "MANAGER") {
      Object.assign(where, { managerId: currentUserId });
    } else {
      Object.assign(where, { userId: currentUserId });
    }

    if (status) {
      Object.assign(where, { status });
    }

    if (search) {
      Object.assign(where, {
        OR: [
          { leaveType: { name: { contains: search, mode: "insensitive" } } },
          { reason: { contains: search, mode: "insensitive" } },
          { user: { name: { contains: search, mode: "insensitive" } } },
          { manager: { name: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      select: getLeaveSelect(),
    });

    return res.json(leaveRequests);
  } catch (err) {
    return sendSafeError(res, err, "Unable to load leave requests");
  }
}

async function getLeaveRequest(req, res) {
  try {
    const { id } = req.params;
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      select: getLeaveSelect(),
    });

    if (!leaveRequest) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    if (!canViewLeave(req.user, leaveRequest)) {
      return res.status(403).json({ error: "You do not have access to this leave request" });
    }

    return res.json(leaveRequest);
  } catch (err) {
    return sendSafeError(res, err, "Unable to load leave request");
  }
}

async function updateLeaveRequest(req, res) {
  try {
    const { id } = req.params;
    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });

    if (!leaveRequest) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    if (leaveRequest.userId !== req.user.userId) {
      return res.status(403).json({ error: "Only the request owner can update this leave request" });
    }

    if (!["PENDING", "MORE_INFORMATION", "ALTERNATIVE_SUGGESTED"].includes(leaveRequest.status)) {
      return res.status(400).json({ error: "Only pending or follow-up leave requests can be updated." });
    }

    const leaveTypeId = typeof req.body.leaveTypeId === "string" ? req.body.leaveTypeId.trim() : undefined;
    const startDate = req.body.startDate ? new Date(String(req.body.startDate)) : undefined;
    const endDate = req.body.endDate ? new Date(String(req.body.endDate)) : undefined;
    const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : undefined;
    const attachmentUrl = typeof req.body.attachmentUrl === "string" ? req.body.attachmentUrl.trim() : undefined;
    const cancel = Boolean(req.body.cancel);

    if (cancel) {
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
        select: getLeaveSelect(),
      });
      emitCRMEvent("leave:updated", getLeaveNotificationPayload(req, updated));
      return res.json(updated);
    }

    const updateData = {};
    if (leaveTypeId) {
      updateData.leaveTypeId = leaveTypeId;
    }
    if (startDate) {
      if (Number.isNaN(startDate.getTime())) {
        return res.status(400).json({ error: "Invalid start date." });
      }
      updateData.startDate = startDate;
    }
    if (endDate) {
      if (Number.isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid end date." });
      }
      updateData.endDate = endDate;
    }
    if (updateData.startDate && updateData.endDate && updateData.startDate > updateData.endDate) {
      return res.status(400).json({ error: "Start date cannot be later than end date." });
    }
    if (reason !== undefined) {
      updateData.reason = reason || null;
    }
    if (attachmentUrl !== undefined) {
      updateData.attachmentUrl = attachmentUrl || null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No updates were provided." });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: updateData,
      select: getLeaveSelect(),
    });

    emitCRMEvent("leave:updated", getLeaveNotificationPayload(req, updated));

    return res.json(updated);
  } catch (err) {
    return sendSafeError(res, err, "Unable to update leave request");
  }
}

async function updateLeaveStatus(req, res) {
  try {
    const { id } = req.params;
    const status = String(req.body.status || "").trim().toUpperCase();
    const note = typeof req.body.note === "string" ? req.body.note.trim() : "";

    if (!status) {
      return res.status(400).json({ error: "A new status must be provided." });
    }

    const allowedStatuses = [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "MORE_INFORMATION",
      "ALTERNATIVE_SUGGESTED",
      "CANCELLED",
    ];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid leave status." });
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leaveRequest) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    if (!canManageLeave(req.user, leaveRequest)) {
      return res.status(403).json({ error: "You do not have permission to manage this leave request." });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status },
      select: getLeaveSelect(),
    });

    if (note) {
      await prisma.leaveComment.create({
        data: {
          leaveRequestId: id,
          authorId: req.user.userId,
          message: note,
        },
      });
    }

    emitCRMEvent("leave:status", getLeaveNotificationPayload(req, updated));

    return res.json(updated);
  } catch (err) {
    return sendSafeError(res, err, "Unable to update leave status");
  }
}

async function addLeaveComment(req, res) {
  try {
    const { id } = req.params;
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      return res.status(400).json({ error: "Comment message is required." });
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leaveRequest) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    if (!canViewLeave(req.user, leaveRequest)) {
      return res.status(403).json({ error: "You do not have access to this leave request." });
    }

    const comment = await prisma.leaveComment.create({
      data: {
        leaveRequestId: id,
        authorId: req.user.userId,
        message,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    emitCRMEvent("leave:comment", getLeaveNotificationPayload(req, leaveRequest));

    return res.status(201).json(comment);
  } catch (err) {
    return sendSafeError(res, err, "Unable to add leave comment");
  }
}

async function uploadLeaveAttachment(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const directory = path.resolve(__dirname, "../uploads", "leaves");
    await fs.mkdir(directory, { recursive: true });

    const extension = path.extname(req.file.originalname) || "";
    const baseName = path.basename(req.file.originalname, extension).replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 50);
    const fileName = `${Date.now()}-${baseName}${extension}`;
    const filePath = path.join(directory, fileName);

    await fs.writeFile(filePath, req.file.buffer);

    return res.status(201).json({
      attachmentUrl: `/uploads/leaves/${fileName}`,
      attachmentMimeType: req.file.mimetype,
      attachmentFileName: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to upload leave attachment");
  }
}

export {
  addLeaveComment,
  createLeaveRequest,
  getLeaveRequest,
  getLeaveRequests,
  getLeaveTypes,
  updateLeaveRequest,
  updateLeaveStatus,
  uploadLeaveAttachment,
};
