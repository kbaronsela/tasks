import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; name?: string; inviteToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();
  const inviteToken = body.inviteToken?.trim();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "מלא אימייל, שם וסיסמה" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "סיסמה באורך מינימום 6 תווים" }, { status: 400 });
  }

  let invitationId: string | null = null;
  if (inviteToken) {
    const inv = await prisma.invitation.findUnique({
      where: { token: inviteToken },
    });
    if (!inv || inv.usedAt || inv.expiresAt < new Date()) {
      return NextResponse.json({ error: "ההזמנה לא תקפה או שפגה" }, { status: 400 });
    }
    if (inv.email != null && inv.email !== email) {
      return NextResponse.json({ error: "האימייל חייב להתאים לכתובת בהזמנה" }, { status: 400 });
    }
    invitationId = inv.id;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "כתובת האימייל כבר רשומה" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  if (invitationId) {
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { usedAt: new Date() },
    });
  }

  await createSession({ userId: user.id, email: user.email, name: user.name });
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
}
