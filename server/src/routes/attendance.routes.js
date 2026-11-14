import express from "express";
import { checkIn, checkOut, getAttendanceStatus } from "../controllers/attendance.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/status", protect, getAttendanceStatus);
router.post("/checkin", protect, checkIn);
router.post("/checkout", protect, checkOut);

export default router;
