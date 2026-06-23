import { Router } from "express";
import attendanceRouter from "./attendance.routes.js";
import activityLogRouter from "./activity-log.routes.js";
import authRouter from "./auth.routes.js";
import chatRouter from "./chat.routes.js";
import dashboardRouter from "./dashboard.routes.js";
import departmentRouter from "./department.routes.js";
import healthRouter from "./health.routes.js";
import integrationRouter from "./integration.routes.js";
import projectRouter from "./project.routes.js";
import taskRouter from "./task.routes.js";
import userRouter from "./user.routes.js";
import leaveRouter from "./leave.routes.js";
import notificationRouter from "./notification.routes.js";
import reportsRouter from "./reports.routes.js";
import credentialRouter from "./credential.routes.js";

const router = Router();

router.use("/auth", authRouter);
router.use("/chat", chatRouter);
router.use("/dashboard", dashboardRouter);
router.use("/departments", departmentRouter);
router.use("/health", healthRouter);
router.use("/integrations", integrationRouter);
router.use("/leaves", leaveRouter);
router.use("/projects", projectRouter);
router.use("/tasks", taskRouter);
router.use("/attendance", attendanceRouter);
router.use("/activity-logs", activityLogRouter);
router.use("/users", userRouter);
router.use("/notifications", notificationRouter);
router.use("/reports", reportsRouter);
router.use("/credentials", credentialRouter);

export default router;
