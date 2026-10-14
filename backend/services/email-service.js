// Sends real emails (verification / password-reset codes) through SMTP.
//
// Configure with environment variables (works with a Gmail "App Password"):
//   SMTP_USER   your sending address, e.g. yourapp@gmail.com
//   SMTP_PASS   the 16-character Gmail App Password (NOT your normal password)
//   SMTP_HOST   optional, default smtp.gmail.com
//   SMTP_PORT   optional, default 465
//   SMTP_FROM   optional, default "LUCOUS <SMTP_USER>"
//
// If SMTP_USER / SMTP_PASS are missing, email is disabled and the server keeps
// its old development behaviour (code printed in the server console).

const nodemailer = require("nodemailer");

let transporter = null;

function isEmailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      // App passwords are shown with spaces; strip them.
      pass: String(process.env.SMTP_PASS).replace(/\s+/g, ""),
    },
  });
  return transporter;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

async function sendOtpEmail(email, code, purpose, ttlMinutes = 10) {
  const isReset = purpose === "RESET";
  const subject = isReset
    ? "Your LUCOUS password reset code"
    : "Your LUCOUS verification code";
  const intro = isReset
    ? "Use this code to reset your LUCOUS password:"
    : "Use this code to verify your email for LUCOUS:";
  const safeCode = escapeHtml(code);

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || `LUCOUS <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    text: `${intro}\n\n${code}\n\nThis code expires in ${ttlMinutes} minutes. If you did not request it, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px">
        <h2 style="margin:0 0 12px">LUCOUS</h2>
        <p style="margin:0 0 16px">${intro}</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:0 0 16px">${safeCode}</p>
        <p style="color:#666;font-size:13px;margin:0">This code expires in ${ttlMinutes} minutes. If you did not request it, you can ignore this email.</p>
      </div>`,
  });
}

module.exports = { isEmailConfigured, sendOtpEmail };
