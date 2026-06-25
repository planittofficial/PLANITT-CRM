import prisma from "../config/db.js";
import { emitCRMEvent } from "../socket.js";
import { sendSafeError } from "../middleware/error.middleware.js";

// ─── Default categories & items (auto-seeded on first access) ────────────────

const DEFAULT_CHECKLIST_SEED = [
  {
    name: "Employment",
    sortOrder: 0,
    items: [
      "Offer Letter",
      "Appointment Letter",
      "Employment Agreement",
      "NDA",
      "Job Description",
    ],
  },
  {
    name: "Payroll",
    sortOrder: 1,
    items: [
      "Salary Structure Explained",
      "First Salary Paid",
      "Payslip Shared",
      "Bank Details Verified",
      "PF Registration",
      "ESIC Registration",
      "Form 16 Shared",
    ],
  },
  {
    name: "Identity",
    sortOrder: 2,
    items: [
      "Aadhaar Verified",
      "PAN Verified",
      "Employee ID Card Issued",
      "Official Email Created",
    ],
  },
  {
    name: "Company Assets",
    sortOrder: 3,
    items: [
      "Laptop Issued",
      "Mouse Issued",
      "Keyboard Issued",
      "Access Card Issued",
      "SIM Card Issued",
    ],
  },
  {
    name: "System Access",
    sortOrder: 4,
    items: [
      "CRM Access",
      "GitHub Access",
      "Slack Access",
      "Google Workspace",
      "VPN Access",
      "Database Access",
    ],
  },
  {
    name: "Training",
    sortOrder: 5,
    items: [
      "Company Induction",
      "Security Training",
      "Product Training",
      "Team Introduction",
      "HR Orientation",
    ],
  },
];

async function ensureChecklistSeed() {
  const count = await prisma.checklistCategory.count();
  if (count > 0) return;

  for (const cat of DEFAULT_CHECKLIST_SEED) {
    await prisma.checklistCategory.create({
      data: {
        name: cat.name,
        sortOrder: cat.sortOrder,
        items: {
          create: cat.items.map((name, index) => ({
            name,
            sortOrder: index,
          })),
        },
      },
    });
  }
}

/**
 * Ensure every ADMIN user has EmployeeChecklist records for every ChecklistItem.
 * Creates missing records with PENDING status.
 */
async function ensureEmployeeRecords(employeeId) {
  const allItems = await prisma.checklistItem.findMany({ select: { id: true } });
  if (allItems.length === 0) return;

  const existing = await prisma.employeeChecklist.findMany({
    where: { employeeId },
    select: { checklistItemId: true },
  });

  const existingSet = new Set(existing.map((r) => r.checklistItemId));
  const missing = allItems.filter((item) => !existingSet.has(item.id));

  if (missing.length > 0) {
    await prisma.employeeChecklist.createMany({
      data: missing.map((item) => ({
        employeeId,
        checklistItemId: item.id,
        status: "PENDING",
      })),
      skipDuplicates: true,
    });
  }
}

async function ensureAllAdminRecords() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  for (const admin of admins) {
    await ensureEmployeeRecords(admin.id);
  }
}

async function logActivity({ employeeId, checklistItemId, action, details, actorId }) {
  await prisma.checklistActivity.create({
    data: { employeeId, checklistItemId, action, details, actorId },
  });
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /checklist
 * Lists all ADMIN users with their overall checklist completion stats.
 * SUPERADMIN sees all admins; ADMIN sees only their own.
 */
export async function getChecklistAdmins(req, res) {
  try {
    await ensureChecklistSeed();
    await ensureAllAdminRecords();

    const role = req.user.role;
    const userId = req.user.userId;

    const whereClause = role === "ADMIN" ? { id: userId, role: "ADMIN" } : { role: "ADMIN" };

    const admins = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        authProvider: true,
        role: true,
        designation: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
        checklistRecords: {
          select: { status: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = admins.map((admin) => {
      const total = admin.checklistRecords.length;
      const completed = admin.checklistRecords.filter((r) => r.status === "COMPLETED").length;
      return {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        avatarUrl: admin.avatarUrl,
        authProvider: admin.authProvider,
        role: admin.role,
        designation: admin.designation,
        department: admin.department,
        createdAt: admin.createdAt,
        totalItems: total,
        completedItems: completed,
        completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    return res.json(result);
  } catch (err) {
    return sendSafeError(res, err, "Failed to load checklist admins");
  }
}

/**
 * GET /checklist/:employeeId
 * Returns full categorized checklist for an employee.
 * ADMINs can only view their own checklist.
 */
export async function getEmployeeChecklist(req, res) {
  try {
    const { employeeId } = req.params;
    const role = req.user.role;
    const userId = req.user.userId;

    if (role === "ADMIN" && userId !== employeeId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        authProvider: true,
        role: true,
        designation: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    await ensureEmployeeRecords(employeeId);

    const categories = await prisma.checklistCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            records: {
              where: { employeeId },
              include: {
                updatedBy: {
                  select: { id: true, name: true, role: true },
                },
              },
            },
          },
        },
      },
    });

    const categoryDetails = categories.map((cat) => {
      const items = cat.items.map((item) => {
        const record = item.records[0] ?? null;
        return {
          id: record?.id ?? null,
          employeeId,
          checklistItemId: item.id,
          status: record?.status ?? "PENDING",
          note: record?.note ?? null,
          completedAt: record?.completedAt ?? null,
          updatedAt: record?.updatedAt ?? null,
          updatedBy: record?.updatedBy ?? null,
          checklistItem: {
            id: item.id,
            name: item.name,
            sortOrder: item.sortOrder,
            categoryId: item.categoryId,
          },
        };
      });

      const totalItems = items.length;
      const completedItems = items.filter((i) => i.status === "COMPLETED").length;

      return {
        id: cat.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
        items,
        totalItems,
        completedItems,
      };
    });

    const allItems = categoryDetails.flatMap((c) => c.items);
    const totalItems = allItems.length;
    const completedItems = allItems.filter((i) => i.status === "COMPLETED").length;

    return res.json({
      employee: {
        ...employee,
        totalItems,
        completedItems,
        completionPercent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      },
      categories: categoryDetails,
    });
  } catch (err) {
    return sendSafeError(res, err, "Failed to load employee checklist");
  }
}

/**
 * PATCH /checklist/items/:recordId
 * Toggle checklist item status. Body: { status, note? }
 * ADMINs can only mark COMPLETED + add notes on their own checklist.
 */
export async function toggleChecklistItem(req, res) {
  try {
    const { recordId } = req.params;
    const { status, note } = req.body;
    const role = req.user.role;
    const userId = req.user.userId;

    const record = await prisma.employeeChecklist.findUnique({
      where: { id: recordId },
      include: {
        checklistItem: { select: { name: true } },
      },
    });

    if (!record) {
      return res.status(404).json({ error: "Checklist record not found" });
    }

    if (role === "ADMIN") {
      if (record.employeeId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (status && status !== "COMPLETED" && status !== "PENDING") {
        return res.status(400).json({ error: "Invalid status" });
      }
    }

    const updateData = {};
    if (status) {
      updateData.status = status;
      updateData.completedAt = status === "COMPLETED" ? new Date() : null;
    }
    if (note !== undefined) {
      updateData.note = note;
    }
    updateData.updatedById = userId;

    const updated = await prisma.employeeChecklist.update({
      where: { id: recordId },
      data: updateData,
      include: {
        updatedBy: { select: { id: true, name: true, role: true } },
        checklistItem: { select: { id: true, name: true, sortOrder: true, categoryId: true } },
      },
    });

    const actionLabel = status === "COMPLETED" ? "marked complete" : status === "PENDING" ? "marked pending" : "updated note";
    await logActivity({
      employeeId: record.employeeId,
      checklistItemId: record.checklistItemId,
      action: `${record.checklistItem.name} ${actionLabel}`,
      details: note || null,
      actorId: userId,
    });

    emitCRMEvent("checklist:updated", { employeeId: record.employeeId });

    return res.json(updated);
  } catch (err) {
    return sendSafeError(res, err, "Failed to update checklist item");
  }
}

/**
 * POST /checklist/:employeeId/reset
 * Reset all checklist items to PENDING. SUPERADMIN only.
 */
export async function resetEmployeeChecklist(req, res) {
  try {
    const { employeeId } = req.params;
    const userId = req.user.userId;

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    await prisma.employeeChecklist.updateMany({
      where: { employeeId },
      data: { status: "PENDING", completedAt: null, note: null, updatedById: userId },
    });

    await logActivity({
      employeeId,
      checklistItemId: null,
      action: "Entire checklist reset",
      details: null,
      actorId: userId,
    });

    emitCRMEvent("checklist:updated", { employeeId });

    return res.json({ message: "Checklist reset successfully" });
  } catch (err) {
    return sendSafeError(res, err, "Failed to reset checklist");
  }
}

// ─── Category CRUD (SUPERADMIN only) ─────────────────────────────────────────

/**
 * POST /checklist/categories
 * Body: { name, sortOrder? }
 */
export async function createCategory(req, res) {
  try {
    const { name, sortOrder } = req.body;
    const userId = req.user.userId;

    if (!name?.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const maxOrder = await prisma.checklistCategory.aggregate({ _max: { sortOrder: true } });
    const newOrder = sortOrder ?? ((maxOrder._max.sortOrder ?? -1) + 1);

    const category = await prisma.checklistCategory.create({
      data: { name: name.trim(), sortOrder: newOrder },
    });

    await logActivity({
      employeeId: userId,
      checklistItemId: null,
      action: `Category "${name.trim()}" created`,
      details: null,
      actorId: userId,
    });

    return res.status(201).json(category);
  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Category with this name already exists" });
    }
    return sendSafeError(res, err, "Failed to create category");
  }
}

/**
 * PATCH /checklist/categories/:categoryId
 * Body: { name?, sortOrder? }
 */
export async function updateCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const { name, sortOrder } = req.body;
    const userId = req.user.userId;

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const category = await prisma.checklistCategory.update({
      where: { id: categoryId },
      data: updateData,
    });

    await logActivity({
      employeeId: userId,
      checklistItemId: null,
      action: `Category "${category.name}" updated`,
      details: null,
      actorId: userId,
    });

    return res.json(category);
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Category not found" });
    }
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Category with this name already exists" });
    }
    return sendSafeError(res, err, "Failed to update category");
  }
}

/**
 * DELETE /checklist/categories/:categoryId
 */
export async function deleteCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const userId = req.user.userId;

    const category = await prisma.checklistCategory.findUnique({
      where: { id: categoryId },
      select: { name: true },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    await prisma.checklistCategory.delete({ where: { id: categoryId } });

    await logActivity({
      employeeId: userId,
      checklistItemId: null,
      action: `Category "${category.name}" deleted`,
      details: null,
      actorId: userId,
    });

    return res.json({ message: "Category deleted" });
  } catch (err) {
    return sendSafeError(res, err, "Failed to delete category");
  }
}

// ─── Item CRUD (SUPERADMIN only) ─────────────────────────────────────────────

/**
 * POST /checklist/categories/:categoryId/items
 * Body: { name, sortOrder? }
 */
export async function createItem(req, res) {
  try {
    const { categoryId } = req.params;
    const { name, sortOrder } = req.body;
    const userId = req.user.userId;

    if (!name?.trim()) {
      return res.status(400).json({ error: "Item name is required" });
    }

    const category = await prisma.checklistCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const maxOrder = await prisma.checklistItem.aggregate({
      where: { categoryId },
      _max: { sortOrder: true },
    });
    const newOrder = sortOrder ?? ((maxOrder._max.sortOrder ?? -1) + 1);

    const item = await prisma.checklistItem.create({
      data: { categoryId, name: name.trim(), sortOrder: newOrder },
    });

    // Auto-create PENDING records for all ADMIN users
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.employeeChecklist.createMany({
        data: admins.map((admin) => ({
          employeeId: admin.id,
          checklistItemId: item.id,
          status: "PENDING",
        })),
        skipDuplicates: true,
      });
    }

    await logActivity({
      employeeId: userId,
      checklistItemId: item.id,
      action: `Item "${name.trim()}" added to ${category.name}`,
      details: null,
      actorId: userId,
    });

    return res.status(201).json(item);
  } catch (err) {
    return sendSafeError(res, err, "Failed to create checklist item");
  }
}

/**
 * PATCH /checklist/items/:itemId/details
 * Body: { name?, sortOrder? }
 */
export async function updateItem(req, res) {
  try {
    const { itemId } = req.params;
    const { name, sortOrder } = req.body;
    const userId = req.user.userId;

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const item = await prisma.checklistItem.update({
      where: { id: itemId },
      data: updateData,
    });

    await logActivity({
      employeeId: userId,
      checklistItemId: item.id,
      action: `Item "${item.name}" updated`,
      details: null,
      actorId: userId,
    });

    return res.json(item);
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Item not found" });
    }
    return sendSafeError(res, err, "Failed to update item");
  }
}

/**
 * DELETE /checklist/items/:itemId
 */
export async function deleteItem(req, res) {
  try {
    const { itemId } = req.params;
    const userId = req.user.userId;

    const item = await prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: { name: true },
    });

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    await prisma.checklistItem.delete({ where: { id: itemId } });

    await logActivity({
      employeeId: userId,
      checklistItemId: null,
      action: `Item "${item.name}" deleted`,
      details: null,
      actorId: userId,
    });

    return res.json({ message: "Item deleted" });
  } catch (err) {
    return sendSafeError(res, err, "Failed to delete item");
  }
}

// ─── Activity Log ────────────────────────────────────────────────────────────

/**
 * GET /checklist/activity?employeeId=&limit=&offset=
 */
export async function getChecklistActivity(req, res) {
  try {
    const { employeeId, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 25, 1), 100);
    const offset = Math.max(parseInt(rawOffset, 10) || 0, 0);

    const where = {};
    if (employeeId) where.employeeId = employeeId;

    const [items, total] = await Promise.all([
      prisma.checklistActivity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.checklistActivity.count({ where }),
    ]);

    return res.json({
      items,
      total,
      hasMore: offset + limit < total,
      nextOffset: offset + limit,
    });
  } catch (err) {
    return sendSafeError(res, err, "Failed to load checklist activity");
  }
}
