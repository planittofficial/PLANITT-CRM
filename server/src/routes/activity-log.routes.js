import { Router } from "express";
import { getActivityLogs } from "../controllers/activity-log.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", authMiddleware, authorizeRoles("SUPERADMIN", "ADMIN"), getActivityLogs);

export default router;
