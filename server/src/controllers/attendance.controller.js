import prisma from "../config/db.js";
import { emitCRMEvent } from "../socket.js";
import { sendSafeError } from "../middleware/error.middleware.js";

export async function getAttendanceStatus(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const activeRecord = await prisma.attendance.findFirst({
      where: { userId, checkOut: null },
      select: { id: true, checkIn: true },
      orderBy: { checkIn: "desc" },
    });

    return res.json({
      checkedIn: Boolean(activeRecord),
      checkInTime: activeRecord?.checkIn ?? null,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to get attendance status");
  }
}

export async function checkIn(req, res) {
  try {
    const userId = req.user.userId;

    const existingOpenRecord = await prisma.attendance.findFirst({
      where: { userId, checkOut: null },
    });

    if (existingOpenRecord) {
      return res.status(409).json({ error: "User is already checked in" });
    }

    const attendance = await prisma.attendance.create({
      data: {
        userId,
        checkIn: new Date(),
        date: new Date(),
      },
    });

    emitCRMEvent("attendance:updated", {
      userId,
      type: "checkin",
      attendanceId: attendance.id,
    });

    return res.status(201).json(attendance);
  } catch (err) {
    return sendSafeError(res, err, "Unable to check in");
  }
}

export async function checkOut(req, res) {
  try {
    const userId = req.user.userId;

    const record = await prisma.attendance.findFirst({
      where: { userId, checkOut: null },
      orderBy: { checkIn: "desc" },
    });

    if (!record) {
      return res.status(404).json({ error: "No active check-in found" });
    }

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: { checkOut: new Date() },
    });

    emitCRMEvent("attendance:updated", {
      userId,
      type: "checkout",
      attendanceId: updated.id,
    });

    return res.json(updated);
  } catch (err) {
    return sendSafeError(res, err, "Unable to check out");
  }
}
