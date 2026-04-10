import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { getPublicBaseUrl } from "@/lib/invite-url";

const INVITE_DAYS = 7;

/** הזמנה גנרית אחת: קישור בלי מייל, טקסט אחיד להעתקה */
export async function POST(_req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  await prisma.invitation.deleteMany({
    where: {
      invitedById: session.userId,
      email: null,
      usedAt: null,
    },
  });

  const baseUrl = getPublicBaseUrl(_req);
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  const token = randomBytes(24).toString("hex");

  await prisma.invitation.create({
    data: {
      email: null,
      token,
      expiresAt,
      invitedById: session.userId,
    },
  });

  const inviteUrl = `${baseUrl}/register?invite=${encodeURIComponent(token)}`;

  return NextResponse.json({
    inviteUrl,
    results: [{ ok: true as const, inviteUrl }],
  });
}
