import nodemailer from "nodemailer";

type SendResult = { sent: true } | { sent: false; reason: string };

export async function sendInviteEmail(params: {
  to: string;
  inviteUrl: string;
  inviterName: string;
}): Promise<SendResult> {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) {
    return { sent: false, reason: "לא הוגדרו SMTP_HOST / SMTP_FROM" };
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  const subject = "הזמנה להצטרף לאתר ניהול הדברים";
  const text = `שלום,

${params.inviterName} הזמין/ה אותך להצטרף לאתר ניהול הדברים.

פתח/י את הקישור להרשמה:
${params.inviteUrl}

הקישור תקף למשך מספר ימים.
`;
  const html = `
  <p>שלום,</p>
  <p><strong>${escapeHtml(params.inviterName)}</strong> הזמין/ה אותך להצטרף לאתר ניהול הדברים.</p>
  <p><a href="${escapeHtml(params.inviteUrl)}">לחצי כאן להרשמה</a></p>
  <p style="color:#666;font-size:12px">אם לא ביקשת את ההזמנה, אפשר להתעלם מהמייל.</p>
  `;

  try {
    await transporter.sendMail({
      from,
      to: params.to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאת שליחה";
    return { sent: false, reason: msg };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
