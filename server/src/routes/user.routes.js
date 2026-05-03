import express from "express";
import multer from "multer";
import {
  bulkCreateUsers,
  createUser,
  deleteUser,
  getMyProfile,
  getUserAnalytics,
  getUsers,
  updateMyProfile,
  updateUserProfileByLeadership,
  updateUserAssignment,
} from "../controllers/user.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

router.get("/me", authMiddleware, getMyProfile);
router.put("/me/profile", authMiddleware, updateMyProfile);
router.get("/", authMiddleware, authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER"), getUsers);
router.post(
  "/bulk-upload",
  authMiddleware,
  authorizeRoles("SUPERADMIN", "ADMIN"),
  upload.single("file"),
  bulkCreateUsers
);
router.get(
  "/:id/analytics",
  authMiddleware,
  authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER"),
  getUserAnalytics
);
router.post("/", authMiddleware, authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER"), createUser);
router.put(
  "/:id/profile",
  authMiddleware,
  authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER"),
  updateUserProfileByLeadership
);
router.put(
  "/:id/assignment",
  authMiddleware,
  authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER"),
  updateUserAssignment
);
router.delete("/:id", authMiddleware, authorizeRoles("SUPERADMIN", "ADMIN", "MANAGER"), deleteUser);

export default router;
