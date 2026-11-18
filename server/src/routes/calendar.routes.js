import express from "express";
import {
  getCalendarEvents,
  createCalendarEvent,
  quickMeet,
  deleteCalendarEvent,
} from "../controllers/calendar.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/events", getCalendarEvents);
router.post("/events", createCalendarEvent);
router.post("/quick-meet", quickMeet);
router.delete("/events/:id", deleteCalendarEvent);

export default router;
