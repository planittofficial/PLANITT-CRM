import nodemailer from "nodemailer";
import prisma from "../config/db.js";
import { emitCRMEvent } from "../socket.js";

let transporter = null;

function getEmailTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  return transporter;
}

/**
 * Send Email to lead or contact
 */
export async function sendEmailMessage({
  leadId = null,
  dealId = null,
  contactId = null,
  recipientEmail,
  subject,
  body,
  templateName = null,
  sentById = null,
}) {
  if (!recipientEmail || !recipientEmail.includes("@")) {
    throw new Error("A valid recipient email address is required.");
  }

  const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "advisory@planitt.in";
  const mailTransporter = getEmailTransporter();
  let deliveryStatus = "SENT";
  let metadataObj = {};

  if (mailTransporter) {
    try {
      const info = await mailTransporter.sendMail({
        from: `"Planitt Solutions" <${senderEmail}>`,
        to: recipientEmail,
        subject: subject || "Planitt Solutions Update",
        html: body.replace(/\n/g, "<br>"),
        text: body,
      });
      deliveryStatus = "DELIVERED";
      metadataObj = { messageId: info.messageId, accepted: info.accepted };
    } catch (err) {
      console.warn("SMTP email dispatch failed, recording as sent with warning:", err.message);
      deliveryStatus = "FAILED";
      metadataObj = { error: err.message };
    }
  } else {
    // Dev / Staging mock mode: Logs cleanly without failing
    metadataObj = { note: "Dispatched in simulated CRM mailer mode (Configure SMTP in .env for live relay)" };
  }

  const communication = await prisma.leadCommunication.create({
    data: {
      leadId: leadId || null,
      dealId: dealId || null,
      contactId: contactId || null,
      channel: "EMAIL",
      direction: "OUTBOUND",
      sender: senderEmail,
      recipient: recipientEmail.trim(),
      subject: subject || "Planitt Solutions Update",
      body,
      status: deliveryStatus,
      templateName: templateName || null,
      metadata: JSON.stringify(metadataObj),
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
  };
}
