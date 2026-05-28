import express from "express";
import multer from "multer";
import {
  addLeaveComment,
  createLeaveRequest,
  getLeaveRequest,
  getLeaveRequests,
  getLeaveTypes,
  updateLeaveRequest,
  updateLeaveStatus,
  uploadLeaveAttachment,
} from "../controllers/leave.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      cb(null, true);
      return;
    }
    cb(new Error("Only image and PDF files are allowed."));
  },
});

router.get("/types", authMiddleware, getLeaveTypes);
router.post("/", authMiddleware, createLeaveRequest);
router.get("/", authMiddleware, getLeaveRequests);
router.get("/:id", authMiddleware, getLeaveRequest);
router.put("/:id", authMiddleware, updateLeaveRequest);
router.put("/:id/status", authMiddleware, updateLeaveStatus);
router.post("/:id/comments", authMiddleware, addLeaveComment);
router.post("/attachments", authMiddleware, upload.single("file"), uploadLeaveAttachment);

export default router;
