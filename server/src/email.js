import nodemailer from "nodemailer";

let transporter;
const DEFAULT_TEST_EMAIL_RECIPIENT = "abdul00muqeet@gmail.com";

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

export function getMailerStatus() {
  return smtpConfigured() ? "configured" : "not_configured";
}

export function getTestEmailRecipient() {
  return process.env.TEST_EMAIL_RECIPIENT || DEFAULT_TEST_EMAIL_RECIPIENT;
}

export async function sendCircularEmail({ recipient, circular, cellName }) {
  const testRecipient = getTestEmailRecipient();
  const deliveryAddress = testRecipient || recipient.email;

  if (!deliveryAddress) {
    return {
      status: "skipped",
      sentAt: null,
      error: "Missing recipient email address",
    };
  }

  if (!smtpConfigured()) {
    console.log(
      `[email not configured] Would send circular "${circular.title}" to ${deliveryAddress}`,
    );
    return {
      status: "not_configured",
      sentAt: null,
      error: "SMTP is not configured",
    };
  }

  const fileLine = circular.fileUrl ? `\nCircular PDF: ${circular.fileUrl}` : "";
  const text = [
    `Dear ${recipient.name},`,
    "",
    `A new circular has been shared for ${cellName}.`,
    testRecipient ? `Testing note: original member email was ${recipient.email || "not available"}.` : "",
    "",
    `Title: ${circular.title}`,
    circular.description,
    fileLine.trim(),
    "",
    "Regards,",
    "EOC Admin",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p>Dear ${escapeHtml(recipient.name)},</p>
    <p>A new circular has been shared for <strong>${escapeHtml(cellName)}</strong>.</p>
    ${
      testRecipient
        ? `<p><strong>Testing note:</strong> Original member email was ${escapeHtml(
            recipient.email || "not available",
          )}.</p>`
        : ""
    }
    <p><strong>Title:</strong> ${escapeHtml(circular.title)}</p>
    <p>${escapeHtml(circular.description).replace(/\n/g, "<br>")}</p>
    ${
      circular.fileUrl
        ? `<p><a href="${escapeAttribute(circular.fileUrl)}">Open Circular PDF</a></p>`
        : ""
    }
    <p>Regards,<br>EOC Admin</p>
  `;

  try {
    const info = await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: deliveryAddress,
      subject: `[${cellName}] ${circular.title}`,
      text,
      html,
    });

    return {
      status: "sent",
      sentAt: new Date(),
      messageId: info.messageId ?? "",
      error: "",
    };
  } catch (error) {
    return {
      status: "failed",
      sentAt: null,
      messageId: "",
      error: error.message || "Email failed",
    };
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
