import express from "express";
import {
  getExecutiveReport,
  getEmployeeReportDirectory,
  getDepartmentReport,
  getProjectReport,
  getAttendanceReport,
  getTaskSlaReport,
  getLeaveReport,
  exportReportCsv,
  exportReportPdf,
} from "../controllers/reports.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = express.Router();

const leadershipOnly = [authMiddleware, authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER")];

router.get("/executive", ...leadershipOnly, getExecutiveReport);
router.get("/employees", ...leadershipOnly, getEmployeeReportDirectory);
router.get("/departments", ...leadershipOnly, getDepartmentReport);
router.get("/projects", ...leadershipOnly, getProjectReport);
router.get("/attendance", ...leadershipOnly, getAttendanceReport);
router.get("/task-sla", ...leadershipOnly, getTaskSlaReport);
router.get("/leaves", ...leadershipOnly, getLeaveReport);

router.get("/export.csv", ...leadershipOnly, exportReportCsv);
router.get("/export.pdf", ...leadershipOnly, exportReportPdf);

export default router;

