import express from "express";
import {
  addCredentialUsage,
  addCredentialUsagesBulk,
  createCredential,
  deleteCredential,
  getCredentials,
  getCredentialsForProject,
  removeCredentialUsage,
  updateCredential,
} from "../controllers/credential.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = express.Router();
const credentialAdminRoles = ["SUPERADMIN", "ADMIN"];

router.get("/project/:projectId", authMiddleware, getCredentialsForProject);
router.get("/", authMiddleware, authorizeRoles(...credentialAdminRoles), getCredentials);
router.post("/", authMiddleware, authorizeRoles(...credentialAdminRoles), createCredential);
router.put("/:id", authMiddleware, authorizeRoles(...credentialAdminRoles), updateCredential);
router.delete("/:id", authMiddleware, authorizeRoles(...credentialAdminRoles), deleteCredential);
router.post("/:id/usages", authMiddleware, authorizeRoles(...credentialAdminRoles), addCredentialUsage);
router.post("/:id/usages/bulk", authMiddleware, authorizeRoles(...credentialAdminRoles), addCredentialUsagesBulk);
router.delete("/:id/usages/:usageId", authMiddleware, authorizeRoles(...credentialAdminRoles), removeCredentialUsage);

export default router;
