import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { getPublicBaseUrl } from "@/lib/invite-url";
import { isValidEmail, parseEmailList } from "@/lib/parse-emails";
import { sendInviteEmail } from "@/lib/send-invite-email";

const INVITE_DAYS = 7;

export async function POST(req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  let body: { emails?: string; emailsRaw?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const raw = String(body.emailsRaw ?? body.emails ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "הזיני לפחות כתובת מייל אחת" }, { status: 400 });
  }

  const parsed = parseEmailList(raw);
  const inviter = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { name: true },
  });

  const baseUrl = getPublicBaseUrl(req);
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

  type Row = {
    email: string;
    ok: boolean;
    emailSent?: boolean;
    inviteUrl?: string;
    error?: string;
  };

  const results: Row[] = [];

  for (const email of parsed) {
    if (!isValidEmail(email)) {
      results.push({ email, ok: false, error: "פורמט מייל לא תקין" });
      continue;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      results.push({ email, ok: false, error: "כבר רשומים במערכת" });
      continue;
    }

    await prisma.invitation.deleteMany({
      where: { email, usedAt: null },
    });

    const token = randomBytes(24).toString("hex");
    await prisma.invitation.create({
      data: {
        email,
        token,
        expiresAt,
        invitedById: session.userId,
      },
    });

    const inviteUrl = `${baseUrl}/register?invite=${encodeURIComponent(token)}`;
    const sendResult = await sendInviteEmail({
      to: email,
      inviteUrl,
      inviterName: inviter.name,
    });

    results.push({
      email,
      ok: true,
      emailSent: sendResult.sent,
      inviteUrl,
    });
  }

  return NextResponse.json({ results });
}
