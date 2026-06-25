import express from "express";
import {
  createCategory,
  createItem,
  deleteCategory,
  deleteItem,
  getChecklistActivity,
  getChecklistAdmins,
  getEmployeeChecklist,
  resetEmployeeChecklist,
  toggleChecklistItem,
  updateCategory,
  updateItem,
} from "../controllers/checklist.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = express.Router();
const checklistRoles = ["SUPERADMIN", "ADMIN"];

router.get("/", authMiddleware, authorizeRoles(...checklistRoles), getChecklistAdmins);
router.get("/activity", authMiddleware, authorizeRoles("SUPERADMIN"), getChecklistActivity);
router.get("/:employeeId", authMiddleware, authorizeRoles(...checklistRoles), getEmployeeChecklist);
router.patch("/items/:recordId", authMiddleware, authorizeRoles(...checklistRoles), toggleChecklistItem);
router.post("/:employeeId/reset", authMiddleware, authorizeRoles("SUPERADMIN"), resetEmployeeChecklist);
router.post("/categories", authMiddleware, authorizeRoles("SUPERADMIN"), createCategory);
router.patch("/categories/:categoryId", authMiddleware, authorizeRoles("SUPERADMIN"), updateCategory);
router.delete("/categories/:categoryId", authMiddleware, authorizeRoles("SUPERADMIN"), deleteCategory);
router.post("/categories/:categoryId/items", authMiddleware, authorizeRoles("SUPERADMIN"), createItem);
router.patch("/items/:itemId/details", authMiddleware, authorizeRoles("SUPERADMIN"), updateItem);
router.delete("/items/:itemId", authMiddleware, authorizeRoles("SUPERADMIN"), deleteItem);

export default router;
