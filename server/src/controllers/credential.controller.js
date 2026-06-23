import prisma from "../config/db.js";
import { sendSafeError } from "../middleware/error.middleware.js";
import { mapCredentialExpiry } from "../utils/credential-expiry.js";

function mapCredential(row) {
  return mapCredentialExpiry(row);
}

const CREDENTIAL_INCLUDE = {
  createdBy: {
    select: { id: true, name: true, email: true, role: true },
  },
  usages: {
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          department: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
};

export async function getCredentials(req, res) {
  try {
    const items = await prisma.credential.findMany({
      orderBy: { createdAt: "desc" },
      include: CREDENTIAL_INCLUDE,
    });
    return res.json(items.map(mapCredential));
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch credentials");
  }
}

export async function createCredential(req, res) {
  try {
    const {
      name,
      provider = null,
      envKey = null,
      validityDays = null,
      expiresAt = null,
      notes = null,
    } = req.body ?? {};

    if (!String(name ?? "").trim()) {
      return res.status(400).json({ error: "Credential name is required" });
    }

    const days =
      validityDays === null || validityDays === undefined || validityDays === ""
        ? null
        : Number(validityDays);
    if (days !== null && (!Number.isFinite(days) || days <= 0 || days > 3650)) {
      return res.status(400).json({ error: "validityDays must be a positive number of days" });
    }

    const expires =
      expiresAt === null || expiresAt === undefined || expiresAt === ""
        ? null
        : new Date(expiresAt);
    if (expires && Number.isNaN(expires.getTime())) {
      return res.status(400).json({ error: "expiresAt must be a valid date" });
    }

    const created = await prisma.credential.create({
      data: {
        name: String(name).trim(),
        provider: provider ? String(provider).trim() : null,
        envKey: envKey ? String(envKey).trim() : null,
        validityDays: days === null ? null : Math.trunc(days),
        expiresAt: expires,
        notes: notes ? String(notes).trim() : null,
        createdById: req.user?.userId ?? null,
      },
      include: CREDENTIAL_INCLUDE,
    });

    return res.status(201).json(mapCredential(created));
  } catch (err) {
    return sendSafeError(res, err, "Unable to create credential");
  }
}

export async function updateCredential(req, res) {
  try {
    const { id } = req.params;
    const payload = req.body ?? {};

    const existing = await prisma.credential.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Credential not found" });
    }

    const data = {};

    if ("name" in payload) {
      const name = String(payload.name ?? "").trim();
      if (!name) return res.status(400).json({ error: "name cannot be empty" });
      data.name = name;
    }
    if ("provider" in payload) data.provider = payload.provider ? String(payload.provider).trim() : null;
    if ("envKey" in payload) data.envKey = payload.envKey ? String(payload.envKey).trim() : null;
    if ("notes" in payload) data.notes = payload.notes ? String(payload.notes).trim() : null;

    if ("validityDays" in payload) {
      const raw = payload.validityDays;
      const days = raw === null || raw === undefined || raw === "" ? null : Number(raw);
      if (days !== null && (!Number.isFinite(days) || days <= 0 || days > 3650)) {
        return res.status(400).json({ error: "validityDays must be a positive number of days" });
      }
      data.validityDays = days === null ? null : Math.trunc(days);
    }

    if ("expiresAt" in payload) {
      const raw = payload.expiresAt;
      const expires = raw === null || raw === undefined || raw === "" ? null : new Date(raw);
      if (expires && Number.isNaN(expires.getTime())) {
        return res.status(400).json({ error: "expiresAt must be a valid date" });
      }
      data.expiresAt = expires;
    }

    if ("rotatedAt" in payload) {
      const raw = payload.rotatedAt;
      const rotated = raw === null || raw === undefined || raw === "" ? null : new Date(raw);
      if (rotated && Number.isNaN(rotated.getTime())) {
        return res.status(400).json({ error: "rotatedAt must be a valid date" });
      }
      data.rotatedAt = rotated;
    }

    const updated = await prisma.credential.update({
      where: { id },
      data,
      include: CREDENTIAL_INCLUDE,
    });

    return res.json(mapCredential(updated));
  } catch (err) {
    return sendSafeError(res, err, "Unable to update credential");
  }
}

export async function deleteCredential(req, res) {
  try {
    const { id } = req.params;
    await prisma.credential.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    return sendSafeError(res, err, "Unable to delete credential");
  }
}

export async function addCredentialUsage(req, res) {
  try {
    const { id: credentialId } = req.params;
    const { projectId, environment = null, envKey = null, notes = null } = req.body ?? {};

    if (!String(projectId ?? "").trim()) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const credential = await prisma.credential.findUnique({
      where: { id: credentialId },
      select: { id: true },
    });
    if (!credential) {
      return res.status(404).json({ error: "Credential not found" });
    }

    const project = await prisma.project.findUnique({
      where: { id: String(projectId).trim() },
      select: { id: true },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    await prisma.credentialUsage.create({
      data: {
        credentialId,
        projectId: project.id,
        environment: environment ? String(environment).trim() : null,
        envKey: envKey ? String(envKey).trim() : null,
        notes: notes ? String(notes).trim() : null,
      },
    });

    const refreshed = await prisma.credential.findUnique({
      where: { id: credentialId },
      include: CREDENTIAL_INCLUDE,
    });
    return res.status(201).json(mapCredential(refreshed));
  } catch (err) {
    // Unique constraint violations should show a clean message.
    if (String(err?.code || "") === "P2002") {
      err.status = 409;
      err.message = "This credential is already linked to that project/environment/envKey combination";
    }
    return sendSafeError(res, err, "Unable to add credential usage");
  }
}

export async function removeCredentialUsage(req, res) {
  try {
    const { id: credentialId, usageId } = req.params;

    const usage = await prisma.credentialUsage.findUnique({
      where: { id: usageId },
      select: { id: true, credentialId: true },
    });
    if (!usage || usage.credentialId !== credentialId) {
      return res.status(404).json({ error: "Credential usage not found" });
    }

    await prisma.credentialUsage.delete({ where: { id: usageId } });

    const refreshed = await prisma.credential.findUnique({
      where: { id: credentialId },
      include: CREDENTIAL_INCLUDE,
    });
    return res.json(mapCredential(refreshed));
  } catch (err) {
    return sendSafeError(res, err, "Unable to remove credential usage");
  }
}

