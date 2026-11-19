import prisma from "../config/db.js";
import { emitCRMEvent } from "../socket.js";

/**
 * Format phone number into international format without '+' or special characters.
 * Defaults 10-digit Indian numbers to '91xxxxxxxxxx'.
 */
export function formatPhoneNumber(phone) {
  if (!phone) return "";
  const cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  return cleaned;
}

/**
 * Send WhatsApp message or generate wa.me link with logged communication
 */
export async function sendWhatsAppMessage({
  leadId = null,
  dealId = null,
  contactId = null,
  recipientPhone,
  body,
  templateName = null,
  sentById = null,
}) {
  const cleanPhone = formatPhoneNumber(recipientPhone);
  if (!cleanPhone) {
    throw new Error("Recipient phone number is required and must contain digits.");
  }

  const token = process.env.WHATSAPP_API_TOKEN || process.env.META_WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_ID;

  let deliveryStatus = "SENT";
  let providerUsed = "wa_me";
  let metadataObj = {};

  if (token && phoneId) {
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: { preview_url: true, body },
        }),
      });

      const data = await response.json();
      if (response.ok && data.messages?.[0]?.id) {
        deliveryStatus = "DELIVERED";
        providerUsed = "meta_cloud_api";
        metadataObj = { messageId: data.messages[0].id };
      } else {
        deliveryStatus = "FAILED";
        metadataObj = { error: data.error?.message || "WhatsApp API error" };
      }
    } catch (err) {
      console.warn("WhatsApp Cloud API delivery failed, falling back to direct link:", err.message);
      deliveryStatus = "SENT";
    }
  }

  const waMeUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(body)}`;

  // Create communication record in database
  const communication = await prisma.leadCommunication.create({
    data: {
      leadId: leadId || null,
      dealId: dealId || null,
      contactId: contactId || null,
      channel: "WHATSAPP",
      direction: "OUTBOUND",
      sender: "Planitt Operations",
      recipient: cleanPhone,
      body,
      status: deliveryStatus,
      templateName: templateName || null,
      metadata: JSON.stringify({ ...metadataObj, waMeUrl, provider: providerUsed }),
      sentById: sentById || null,
    },
    include: {
      sentBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  emitCRMEvent("crm:communication_new", communication);

  return {
    success: true,
    communication,
    waMeUrl,
    provider: providerUsed,
  };
}

/**
 * Handle incoming WhatsApp Webhook message
 */
export async function handleWhatsAppWebhook(payload) {
  try {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    if (!message) return null;

    const fromPhone = formatPhoneNumber(message.from);
    const bodyText = message.text?.body || message.button?.text || "Media received";

    // Try finding matching lead or contact
    const matchingLead = await prisma.lead.findFirst({
      where: {
        OR: [
          { phone: { contains: message.from } },
          { phone: { contains: fromPhone.slice(-10) } },
        ],
      },
    });

    const communication = await prisma.leadCommunication.create({
      data: {
        leadId: matchingLead?.id || null,
        channel: "WHATSAPP",
        direction: "INBOUND",
        sender: fromPhone,
        recipient: "Planitt CRM",
        body: bodyText,
        status: "RECEIVED",
        metadata: JSON.stringify({ rawMessageId: message.id, timestamp: message.timestamp }),
      },
    });

    emitCRMEvent("crm:communication_new", communication);
    return communication;
  } catch (err) {
    console.error("Error processing inbound WhatsApp webhook:", err.message);
    return null;
  }
}
