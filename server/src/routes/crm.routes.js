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
  getOmnichannelTemplates,
  sendWhatsApp,
  sendEmail,
  getCommunications,
  handleWhatsAppWebhookEndpoint,
} from "../controllers/crm.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public Webhooks for Meta WhatsApp Cloud API
router.get("/omnichannel/webhook/whatsapp", handleWhatsAppWebhookEndpoint);
router.post("/omnichannel/webhook/whatsapp", handleWhatsAppWebhookEndpoint);

router.use(authMiddleware);

// Omnichannel WhatsApp & Email
router.get("/omnichannel/templates", getOmnichannelTemplates);
router.post("/omnichannel/send-whatsapp", sendWhatsApp);
router.post("/omnichannel/send-email", sendEmail);
router.get("/communications", getCommunications);

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
