import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ valid: false, error: "חסר טוקן" }, { status: 400 });
  }

  const inv = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!inv || inv.usedAt || inv.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, error: "ההזמנה לא תקפה או שפגה" });
  }

  return NextResponse.json({ valid: true, email: inv.email });
}
