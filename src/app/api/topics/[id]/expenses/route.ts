import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { isTopicMember } from "@/lib/topic-access";

function mapExpense(e: {
  id: string;
  amount: { toString(): string };
  currency: string;
  description: string | null;
  spentAt: Date;
  createdAt: Date;
  assignedUser: {
    id: string;
    name: string;
    email: string;
  } | null;
}) {
  return {
    id: e.id,
    amount: e.amount.toString(),
    currency: e.currency,
    description: e.description,
    spentAt: e.spentAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
    assignedUser: e.assignedUser,
  };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;
  const { id: topicId } = await ctx.params;

  if (!(await isTopicMember(topicId, session.userId))) {
    return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
  }

  const rows = await prisma.topicExpense.findMany({
    where: { topicId },
    orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ expenses: rows.map(mapExpense) });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;
  const { id: topicId } = await ctx.params;

  if (!(await isTopicMember(topicId, session.userId))) {
    return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
  }

  let body: {
    amount?: unknown;
    currency?: unknown;
    description?: unknown;
    spentAt?: unknown;
    assignedUserId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  let assignedUserId: string | null = null;
  if (body.assignedUserId != null && String(body.assignedUserId).trim()) {
    const aid = String(body.assignedUserId).trim();
    if (!(await isTopicMember(topicId, aid))) {
      return NextResponse.json({ error: "משתמש משויך חייב להיות חבר בנושא" }, { status: 400 });
    }
    assignedUserId = aid;
  }

  const raw = body.amount;
  const amountNum =
    typeof raw === "number" && Number.isFinite(raw)
      ? raw
      : typeof raw === "string"
        ? parseFloat(raw.replace(",", "."))
        : NaN;
  if (!Number.isFinite(amountNum) || amountNum < 0) {
    return NextResponse.json({ error: "סכום לא תקין" }, { status: 400 });
  }

  const currency = String(body.currency ?? "ILS").trim().slice(0, 8) || "ILS";
  const description = body.description != null ? String(body.description).trim() || null : null;

  let spentAt = new Date();
  if (body.spentAt != null && String(body.spentAt).trim()) {
    const d = new Date(String(body.spentAt));
    if (!Number.isNaN(d.getTime())) spentAt = d;
  }

  const row = await prisma.topicExpense.create({
    data: {
      topicId,
      amount: amountNum.toFixed(2),
      currency,
      description,
      spentAt,
      createdById: session.userId,
      assignedUserId,
    },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ expense: mapExpense(row) });
}
