import prisma from "../config/db.js";
import { sendSafeError } from "../middleware/error.middleware.js";
import { mapCredentialExpiry } from "../utils/credential-expiry.js";
import { normalizeEnvKey, normalizeEnvironment, usageDisplayName, usageLinkKey } from "../utils/credential-usage.js";

function mapCredential(row) {
  return {
    ...mapCredentialExpiry(row),
    usages: (row.usages ?? []).map((usage) => ({
      ...usage,
      displayName: usageDisplayName(usage),
    })),
  };
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

async function refreshCredential(credentialId) {
  const row = await prisma.credential.findUnique({
    where: { id: credentialId },
    include: CREDENTIAL_INCLUDE,
  });
  return row ? mapCredential(row) : null;
}

function parseValidityDays(raw) {
  const days = raw === null || raw === undefined || raw === "" ? null : Number(raw);
  if (days !== null && (!Number.isFinite(days) || days <= 0 || days > 3650)) {
    const error = new Error("validityDays must be a positive number of days");
    error.status = 400;
    throw error;
  }
  return days === null ? null : Math.trunc(days);
}

function parseOptionalDate(raw, fieldName) {
  const value = raw === null || raw === undefined || raw === "" ? null : new Date(raw);
  if (value && Number.isNaN(value.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    error.status = 400;
    throw error;
  }
  return value;
}

function normalizeUsageInput(raw = {}) {
  const projectId = String(raw.projectId ?? "").trim() || null;
  const projectName = String(raw.projectName ?? "").trim() || null;

  if (!projectId && !projectName) {
    const error = new Error("Each project link needs a CRM project or a custom project name");
    error.status = 400;
    throw error;
  }

  return {
    projectId,
    projectName,
    environment: normalizeEnvironment(raw.environment),
    envKey: normalizeEnvKey(raw.envKey),
    notes: raw.notes ? String(raw.notes).trim() : null,
  };
}

async function assertProjectsExist(projectIds) {
  if (!projectIds.length) return;
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true },
  });
  if (projects.length !== projectIds.length) {
    const error = new Error("One or more project ids are invalid");
    error.status = 400;
    throw error;
  }
  return projects;
}

async function createUsageRows(credentialId, usageInputs, defaults = {}) {
  const normalized = usageInputs.map((input) => {
    const row = normalizeUsageInput({
      ...defaults,
      ...input,
    });
    if (row.projectId && row.projectName) {
      // Prefer CRM project link; custom label is optional override only when no projectId.
      row.projectName = null;
    }
    return row;
  });

  const unique = new Map();
  for (const row of normalized) {
    unique.set(usageLinkKey(row), row);
  }
  const rows = Array.from(unique.values());
  if (!rows.length) return [];

  const projectIds = rows.map((row) => row.projectId).filter(Boolean);
  const projects = await assertProjectsExist(projectIds);
  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));

  const existing = await prisma.credentialUsage.findMany({
    where: { credentialId },
    include: { project: { select: { id: true, name: true } } },
  });
  const existingKeys = new Set(existing.map((row) => usageLinkKey(row)));

  const toCreate = rows
    .filter((row) => !existingKeys.has(usageLinkKey(row)))
    .map((row) => ({
      credentialId,
      projectId: row.projectId,
      projectName: row.projectId ? (row.projectName ?? projectNameById.get(row.projectId) ?? null) : row.projectName,
      environment: row.environment,
      envKey: row.envKey,
      notes: row.notes,
    }));

  if (toCreate.length) {
    await prisma.credentialUsage.createMany({ data: toCreate });
  }

  return toCreate;
}

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

export async function getCredentialsForProject(req, res) {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const usages = await prisma.credentialUsage.findMany({
      where: {
        OR: [{ projectId }, { projectName: project.name }],
      },
      include: {
        credential: {
          include: CREDENTIAL_INCLUDE,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const byCredential = new Map();
    for (const usage of usages) {
      const mapped = mapCredential(usage.credential);
      if (!byCredential.has(mapped.id)) {
        byCredential.set(mapped.id, mapped);
      }
    }

    return res.json({
      project,
      credentials: Array.from(byCredential.values()),
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch project credentials");
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
      projectLinks = [],
      projectIds = [],
      customProjectNames = [],
    } = req.body ?? {};

    if (!String(name ?? "").trim()) {
      return res.status(400).json({ error: "Credential name is required" });
    }

    const days = parseValidityDays(validityDays);
    const expires = parseOptionalDate(expiresAt, "expiresAt");

    const usageInputs = [
      ...(Array.isArray(projectLinks) ? projectLinks : []),
      ...(Array.isArray(projectIds) ? projectIds.map((projectId) => ({ projectId })) : []),
      ...(Array.isArray(customProjectNames)
        ? customProjectNames.map((projectName) => ({ projectName: String(projectName ?? "").trim() })).filter((x) => x.projectName)
        : []),
    ];

    const created = await prisma.credential.create({
      data: {
        name: String(name).trim(),
        provider: provider ? String(provider).trim() : null,
        envKey: envKey ? String(envKey).trim() : null,
        validityDays: days,
        expiresAt: expires,
        notes: notes ? String(notes).trim() : null,
        createdById: req.user?.userId ?? null,
      },
      include: CREDENTIAL_INCLUDE,
    });

    if (usageInputs.length) {
      await createUsageRows(created.id, usageInputs, {
        environment: "PROD",
        envKey: envKey ? String(envKey).trim() : null,
      });
    }

    const refreshed = await refreshCredential(created.id);
    return res.status(201).json(refreshed);
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
      data.validityDays = parseValidityDays(payload.validityDays);
    }

    if ("expiresAt" in payload) {
      data.expiresAt = parseOptionalDate(payload.expiresAt, "expiresAt");
    }

    if ("rotatedAt" in payload) {
      data.rotatedAt = parseOptionalDate(payload.rotatedAt, "rotatedAt");
    }

    await prisma.credential.update({
      where: { id },
      data,
    });

    const refreshed = await refreshCredential(id);
    return res.json(refreshed);
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
    const credential = await prisma.credential.findUnique({
      where: { id: credentialId },
      select: { id: true },
    });
    if (!credential) {
      return res.status(404).json({ error: "Credential not found" });
    }

    await createUsageRows(credentialId, [req.body ?? {}]);
    const refreshed = await refreshCredential(credentialId);
    return res.status(201).json(refreshed);
  } catch (err) {
    if (String(err?.code || "") === "P2002") {
      err.status = 409;
      err.message = "This credential is already linked to that project/environment/envKey combination";
    }
    return sendSafeError(res, err, "Unable to add credential usage");
  }
}

export async function addCredentialUsagesBulk(req, res) {
  try {
    const { id: credentialId } = req.params;
    const { links = [], projectIds = [], customProjectNames = [], environment = "PROD", envKey = null, notes = null } =
      req.body ?? {};

    const credential = await prisma.credential.findUnique({
      where: { id: credentialId },
      select: { id: true, envKey: true },
    });
    if (!credential) {
      return res.status(404).json({ error: "Credential not found" });
    }

    const usageInputs = [
      ...(Array.isArray(links) ? links : []),
      ...(Array.isArray(projectIds) ? projectIds.map((projectId) => ({ projectId })) : []),
      ...(Array.isArray(customProjectNames)
        ? customProjectNames.map((projectName) => ({ projectName: String(projectName ?? "").trim() })).filter((x) => x.projectName)
        : []),
    ];

    if (!usageInputs.length) {
      return res.status(400).json({ error: "Provide at least one project to link" });
    }

    await createUsageRows(credentialId, usageInputs, {
      environment,
      envKey: envKey ?? credential.envKey,
      notes,
    });

    const refreshed = await refreshCredential(credentialId);
    return res.status(201).json(refreshed);
  } catch (err) {
    return sendSafeError(res, err, "Unable to link projects");
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

    const refreshed = await refreshCredential(credentialId);
    return res.json(refreshed);
  } catch (err) {
    return sendSafeError(res, err, "Unable to remove credential usage");
  }
}
