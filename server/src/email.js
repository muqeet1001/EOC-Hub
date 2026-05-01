import nodemailer from "nodemailer";
import { readBooleanEnv, readEnv, readNumberEnv } from "./env.js";

let transporter;

function smtpConfigured() {
  return Boolean(readEnv("SMTP_HOST") && readEnv("SMTP_USER") && readEnv("SMTP_PASS"));
}

function readSmtpPassword() {
  const password = readEnv("SMTP_PASS");
  const host = readEnv("SMTP_HOST");

  if (host === "smtp.gmail.com") {
    return password.replace(/\s+/g, "");
  }

  return password;
}

function getTransporter() {
  if (!transporter) {
    const port = readNumberEnv("SMTP_PORT", 587);
    transporter = nodemailer.createTransport({
      host: readEnv("SMTP_HOST"),
      port,
      secure: readEnv("SMTP_SECURE") === "true" || port === 465,
      auth: {
        user: readEnv("SMTP_USER"),
        pass: readSmtpPassword(),
      },
    });
  }

  return transporter;
}

export function getMailerStatus() {
  return smtpConfigured() ? "configured" : "not_configured";
}

function emailTestModeEnabled() {
  return readBooleanEnv("EMAIL_TEST_MODE", false);
}

function getTestEmailRecipient() {
  return readEnv("EMAIL_TEST_RECIPIENT");
}

function resolveDeliveryAddress(recipient) {
  const testRecipient = getTestEmailRecipient();

  if (emailTestModeEnabled() && testRecipient) {
    return {
      address: testRecipient,
      testMode: true,
    };
  }

  return {
    address: recipient.email,
    testMode: false,
  };
}

function buildCircularHtml({ recipient, circular, cellName, testMode }) {
  const summaryParagraphs = escapeHtml(circular.description)
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join("");

  const attachmentNote = circular.fileName
    ? `<p><strong>Attachment:</strong> ${escapeHtml(circular.fileName)}</p>`
    : "";

  const testModeNote = testMode
    ? `<p><strong>Testing mode:</strong> This message was redirected from ${escapeHtml(
        recipient.email || "the member address on file",
      )}.</p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; color: #172033; line-height: 1.6;">
      <p>Dear ${escapeHtml(recipient.name)},</p>
      <p>A new circular has been shared for <strong>${escapeHtml(cellName)}</strong>.</p>
      ${testModeNote}
      <p><strong>Title:</strong> ${escapeHtml(circular.title)}</p>
      ${summaryParagraphs || "<p>Please see the attached circular.</p>"}
      ${attachmentNote}
      <p>Regards,<br>EOC Administration</p>
    </div>
  `;
}

export async function sendCircularEmail({ recipient, circular, cellName, attachment }) {
  const { address: deliveryAddress, testMode } = resolveDeliveryAddress(recipient);

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

  const fileLine = circular.fileName ? `\nAttachment: ${circular.fileName}` : "";
  const text = [
    `Dear ${recipient.name},`,
    "",
    `A new circular has been shared for ${cellName}.`,
    testMode
      ? `Testing mode: original recipient was ${recipient.email || "not available"}.`
      : "",
    "",
    `Title: ${circular.title}`,
    circular.description,
    fileLine.trim(),
    "",
    "Regards,",
    "EOC Administration",
  ]
    .filter(Boolean)
    .join("\n");

  const html = buildCircularHtml({ recipient, circular, cellName, testMode });

  try {
    const info = await getTransporter().sendMail({
      from: readEnv("SMTP_FROM") || readEnv("SMTP_USER"),
      to: deliveryAddress,
      subject: `[${cellName}] ${circular.title}`,
      text,
      html,
      attachments: attachment
        ? [
            {
              filename: attachment.fileName,
              content: attachment.buffer,
              contentType: attachment.fileMimeType,
            },
          ]
        : [],
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
