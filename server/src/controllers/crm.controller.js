import prisma from "../config/db.js";
import { emitCRMEvent, emitNotification } from "../socket.js";

// ─────────────────────────────────────────────
// LEADS
// ─────────────────────────────────────────────

export async function getLeads(req, res) {
  try {
    const { status, search } = req.query;
    const where = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatarUrl: true, role: true },
        },
      },
    });

    res.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Failed to fetch leads" });
  }
}

export async function createLead(req, res) {
  try {
    const { name, email, phone, company, status, source, value, notes, assignedToId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Lead name is required" });
    }

    const lead = await prisma.lead.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        status: status || "NEW",
        source: source || "WEBSITE",
        value: value ? Number(value) : 0,
        notes: notes?.trim() || null,
        assignedToId: assignedToId || req.user.id,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatarUrl: true, role: true },
        },
      },
    });

    emitCRMEvent("crm:lead_created", lead);

    if (lead.assignedToId && lead.assignedToId !== req.user.id) {
      emitNotification(lead.assignedToId, {
        id: `lead_${lead.id}`,
        type: "LEAD_ASSIGNED",
        title: "New Lead Assigned",
        message: `${lead.name} (${lead.company || "Independent"}) has been assigned to you.`,
        href: "/crm",
        priority: "HIGH",
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    res.status(201).json(lead);
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({ error: "Failed to create lead" });
  }
}

export async function updateLead(req, res) {
  try {
    const { id } = req.params;
    const { name, email, phone, company, status, source, value, notes, assignedToId } = req.body;

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(company !== undefined ? { company: company?.trim() || null } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(source !== undefined ? { source } : {}),
        ...(value !== undefined ? { value: Number(value) } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
        ...(assignedToId !== undefined ? { assignedToId: assignedToId || null } : {}),
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatarUrl: true, role: true },
        },
      },
    });

    emitCRMEvent("crm:lead_updated", updated);
    res.json(updated);
  } catch (error) {
    console.error("Error updating lead:", error);
    res.status(500).json({ error: "Failed to update lead" });
  }
}

export async function deleteLead(req, res) {
  try {
    const { id } = req.params;
    await prisma.lead.delete({ where: { id } });
    emitCRMEvent("crm:lead_deleted", { id });
    res.json({ success: true, message: "Lead deleted" });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({ error: "Failed to delete lead" });
  }
}

export async function convertLeadToDeal(req, res) {
  try {
    const { id } = req.params;
    const { dealTitle, dealValue, currency, stage, expectedCloseDate, projectId } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // 1. Create or link Contact
    let contact = null;
    if (lead.email) {
      contact = await prisma.contact.findUnique({ where: { email: lead.email } });
    }
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          notes: `Converted from lead: ${lead.notes || ""}`,
        },
      });
    }

    // 2. Create Deal
    const deal = await prisma.deal.create({
      data: {
        title: dealTitle?.trim() || `${lead.name} Deal`,
        value: dealValue ? Number(dealValue) : (lead.value || 0),
        currency: currency || "INR",
        stage: stage || "QUALIFIED",
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        leadId: lead.id,
        contactId: contact.id,
        assignedToId: lead.assignedToId || req.user.id,
        projectId: projectId || null,
        notes: lead.notes,
      },
      include: {
        lead: true,
        contact: true,
        assignedTo: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // 3. Mark Lead as CONVERTED
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "CONVERTED" },
    });

    emitCRMEvent("crm:deal_created", deal);
    res.status(201).json({ deal, contact });
  } catch (error) {
    console.error("Error converting lead to deal:", error);
    res.status(500).json({ error: "Failed to convert lead to deal" });
  }
}

// ─────────────────────────────────────────────
// DEALS
// ─────────────────────────────────────────────

export async function getDeals(req, res) {
  try {
    const { stage, projectId } = req.query;
    const where = {};

    if (stage && stage !== "ALL") {
      where.stage = stage;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    const deals = await prisma.deal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { id: true, name: true, company: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        project: { select: { id: true, name: true } },
        assignedTo: {
          select: { id: true, name: true, email: true, avatarUrl: true, role: true },
        },
      },
    });

    res.json(deals);
  } catch (error) {
    console.error("Error fetching deals:", error);
    res.status(500).json({ error: "Failed to fetch deals" });
  }
}

export async function createDeal(req, res) {
  try {
    const { title, value, currency, stage, probability, expectedCloseDate, notes, leadId, contactId, assignedToId, projectId } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Deal title is required" });
    }

    const deal = await prisma.deal.create({
      data: {
        title: title.trim(),
        value: value ? Number(value) : 0,
        currency: currency || "INR",
        stage: stage || "LEAD",
        probability: probability !== undefined ? Number(probability) : 20,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        notes: notes?.trim() || null,
        leadId: leadId || null,
        contactId: contactId || null,
        assignedToId: assignedToId || req.user.id,
        projectId: projectId || null,
      },
      include: {
        lead: { select: { id: true, name: true, company: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        project: { select: { id: true, name: true } },
        assignedTo: {
          select: { id: true, name: true, email: true, avatarUrl: true, role: true },
        },
      },
    });

    emitCRMEvent("crm:deal_created", deal);
    res.status(201).json(deal);
  } catch (error) {
    console.error("Error creating deal:", error);
    res.status(500).json({ error: "Failed to create deal" });
  }
}

export async function updateDeal(req, res) {
  try {
    const { id } = req.params;
    const { title, value, currency, stage, probability, expectedCloseDate, notes, leadId, contactId, assignedToId, projectId } = req.body;

    const existing = await prisma.deal.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Deal not found" });
    }

    const updated = await prisma.deal.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(value !== undefined ? { value: Number(value) } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(stage !== undefined ? { stage } : {}),
        ...(probability !== undefined ? { probability: Number(probability) } : {}),
        ...(expectedCloseDate !== undefined ? { expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
        ...(leadId !== undefined ? { leadId: leadId || null } : {}),
        ...(contactId !== undefined ? { contactId: contactId || null } : {}),
        ...(assignedToId !== undefined ? { assignedToId: assignedToId || null } : {}),
        ...(projectId !== undefined ? { projectId: projectId || null } : {}),
      },
      include: {
        lead: { select: { id: true, name: true, company: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        project: { select: { id: true, name: true } },
        assignedTo: {
          select: { id: true, name: true, email: true, avatarUrl: true, role: true },
        },
      },
    });

    emitCRMEvent("crm:deal_updated", updated);

    if (stage === "WON" && existing.stage !== "WON") {
      emitCRMEvent("crm:deal_won", updated);
      if (updated.assignedToId) {
        emitNotification(updated.assignedToId, {
          id: `deal_won_${updated.id}`,
          type: "DEAL_WON",
          title: "Deal Closed: WON! 🎉",
          message: `${updated.title} worth ${updated.currency} ${updated.value.toLocaleString()} has been marked as WON!`,
          href: "/crm",
          priority: "HIGH",
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating deal:", error);
    res.status(500).json({ error: "Failed to update deal" });
  }
}

export async function deleteDeal(req, res) {
  try {
    const { id } = req.params;
    await prisma.deal.delete({ where: { id } });
    emitCRMEvent("crm:deal_deleted", { id });
    res.json({ success: true, message: "Deal deleted" });
  } catch (error) {
    console.error("Error deleting deal:", error);
    res.status(500).json({ error: "Failed to delete deal" });
  }
}

// ─────────────────────────────────────────────
// CONTACTS
// ─────────────────────────────────────────────

export async function getContacts(req, res) {
  try {
    const { search } = req.query;
    const where = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
      ];
    }

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        deals: {
          select: { id: true, title: true, value: true, stage: true },
        },
      },
    });

    res.json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
}

export async function createContact(req, res) {
  try {
    const { name, email, phone, company, designation, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Contact name is required" });
    }

    const contact = await prisma.contact.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        designation: designation?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    res.status(201).json(contact);
  } catch (error) {
    console.error("Error creating contact:", error);
    res.status(500).json({ error: "Failed to create contact" });
  }
}

export async function updateContact(req, res) {
  try {
    const { id } = req.params;
    const { name, email, phone, company, designation, notes } = req.body;

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(company !== undefined ? { company: company?.trim() || null } : {}),
        ...(designation !== undefined ? { designation: designation?.trim() || null } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      },
    });

    res.json(contact);
  } catch (error) {
    console.error("Error updating contact:", error);
    res.status(500).json({ error: "Failed to update contact" });
  }
}

export async function deleteContact(req, res) {
  try {
    const { id } = req.params;
    await prisma.contact.delete({ where: { id } });
    res.json({ success: true, message: "Contact deleted" });
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({ error: "Failed to delete contact" });
  }
}

// ─────────────────────────────────────────────
// CRM SUMMARY & PIPELINE METRICS
// ─────────────────────────────────────────────

export async function getCrmSummary(req, res) {
  try {
    const [leads, deals, contacts] = await Promise.all([
      prisma.lead.findMany(),
      prisma.deal.findMany(),
      prisma.contact.count(),
    ]);

    const totalPipelineValue = deals
      .filter((d) => d.stage !== "LOST")
      .reduce((sum, d) => sum + (d.value || 0), 0);

    const wonValue = deals
      .filter((d) => d.stage === "WON")
      .reduce((sum, d) => sum + (d.value || 0), 0);

    const stageBreakdown = {
      LEAD: deals.filter((d) => d.stage === "LEAD").length,
      CONTACTED: deals.filter((d) => d.stage === "CONTACTED").length,
      PROPOSAL: deals.filter((d) => d.stage === "PROPOSAL").length,
      NEGOTIATION: deals.filter((d) => d.stage === "NEGOTIATION").length,
      WON: deals.filter((d) => d.stage === "WON").length,
      LOST: deals.filter((d) => d.stage === "LOST").length,
    };

    const leadStatusBreakdown = {
      NEW: leads.filter((l) => l.status === "NEW").length,
      CONTACTED: leads.filter((l) => l.status === "CONTACTED").length,
      QUALIFIED: leads.filter((l) => l.status === "QUALIFIED").length,
      PROPOSAL_SENT: leads.filter((l) => l.status === "PROPOSAL_SENT").length,
      CONVERTED: leads.filter((l) => l.status === "CONVERTED").length,
      LOST: leads.filter((l) => l.status === "LOST").length,
    };

    res.json({
      totalLeads: leads.length,
      totalDeals: deals.length,
      totalContacts: contacts,
      totalPipelineValue,
      wonValue,
      stageBreakdown,
      leadStatusBreakdown,
    });
  } catch (error) {
    console.error("Error fetching CRM summary:", error);
    res.status(500).json({ error: "Failed to fetch CRM summary" });
  }
}
