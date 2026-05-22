import express from "express";
import multer from "multer";
import {
  addChatGroupMembers,
  clearChatLocal,
  createChatGroup,
  startDirectChat,
  createChatMessage,
  deleteChatMedia,
  deleteChatMediaBulk,
  deleteChatGroup,
  deleteChatMessage,
  getChatMedia,
  getChatGroupById,
  getChatGroupMembers,
  getChatMessages,
  getChatRooms,
  markChatRoomRead,
  removeChatGroupMember,
  updateChatGroup,
  uploadChatAttachment,
} from "../controllers/chat.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

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

router.get("/rooms", authMiddleware, getChatRooms);
router.post("/groups", authMiddleware, authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER"), createChatGroup);
router.post("/direct", authMiddleware, authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER"), startDirectChat);
router.get("/groups/:id", authMiddleware, getChatGroupById);
router.get("/groups/:id/members", authMiddleware, getChatGroupMembers);
router.put("/groups/:id", authMiddleware, authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER"), updateChatGroup);
router.delete("/groups/:id", authMiddleware, authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER"), deleteChatGroup);
router.post(
  "/groups/:id/members",
  authMiddleware,
  authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER"),
  addChatGroupMembers
);
router.delete(
  "/groups/:id/members/:userId",
  authMiddleware,
  authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER"),
  removeChatGroupMember
);
router.get("/messages", authMiddleware, getChatMessages);
router.get("/media", authMiddleware, getChatMedia);
router.post("/media/delete-bulk", authMiddleware, deleteChatMediaBulk);
router.post("/messages", authMiddleware, createChatMessage);
router.delete("/messages/:id", authMiddleware, deleteChatMessage);
router.delete("/media/:id", authMiddleware, deleteChatMedia);
router.post("/clear/:type/:id", authMiddleware, clearChatLocal);
router.post("/read", authMiddleware, markChatRoomRead);
router.post("/attachments", authMiddleware, upload.single("file"), uploadChatAttachment);

export default router;
