import express from "express";
import {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  convertLeadToDeal,
  getDeals,
  createDeal,
  updateDeal,
  deleteDeal,
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  getCrmSummary,
} from "../controllers/crm.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

// Leads
router.get("/leads", getLeads);
router.post("/leads", createLead);
router.put("/leads/:id", updateLead);
router.delete("/leads/:id", deleteLead);
router.post("/leads/:id/convert", convertLeadToDeal);

// Deals
router.get("/deals", getDeals);
router.post("/deals", createDeal);
router.put("/deals/:id", updateDeal);
router.delete("/deals/:id", deleteDeal);

// Contacts
router.get("/contacts", getContacts);
router.post("/contacts", createContact);
router.put("/contacts/:id", updateContact);
router.delete("/contacts/:id", deleteContact);

// Metrics
router.get("/summary", getCrmSummary);

export default router;
