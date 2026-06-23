import express from "express";
import {
  addCredentialUsage,
  createCredential,
  deleteCredential,
  getCredentials,
  removeCredentialUsage,
  updateCredential,
} from "../controllers/credential.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = express.Router();
const credentialRoles = ["SUPERADMIN", "ADMIN"];

router.get("/", authMiddleware, authorizeRoles(...credentialRoles), getCredentials);
router.post("/", authMiddleware, authorizeRoles(...credentialRoles), createCredential);
router.put("/:id", authMiddleware, authorizeRoles(...credentialRoles), updateCredential);
router.delete("/:id", authMiddleware, authorizeRoles(...credentialRoles), deleteCredential);
router.post("/:id/usages", authMiddleware, authorizeRoles(...credentialRoles), addCredentialUsage);
router.delete("/:id/usages/:usageId", authMiddleware, authorizeRoles(...credentialRoles), removeCredentialUsage);

export default router;

