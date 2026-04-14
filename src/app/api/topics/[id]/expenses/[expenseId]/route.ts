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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; expenseId: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;
  const { id: topicId, expenseId } = await ctx.params;

  if (!(await isTopicMember(topicId, session.userId))) {
    return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
  }

  const existing = await prisma.topicExpense.findFirst({
    where: { id: expenseId, topicId },
  });
  if (!existing) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
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

  const data: {
    amount?: string;
    currency?: string;
    description?: string | null;
    spentAt?: Date;
    assignedUserId?: string | null;
  } = {};

  if (body.amount !== undefined) {
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
    data.amount = amountNum.toFixed(2);
  }
  if (body.currency !== undefined) {
    data.currency = String(body.currency).trim().slice(0, 8) || "ILS";
  }
  if (body.description !== undefined) {
    data.description = String(body.description).trim() || null;
  }
  if (body.spentAt !== undefined && String(body.spentAt).trim()) {
    const d = new Date(String(body.spentAt));
    if (!Number.isNaN(d.getTime())) data.spentAt = d;
  }
  if (body.assignedUserId !== undefined) {
    if (body.assignedUserId === null || !String(body.assignedUserId).trim()) {
      data.assignedUserId = null;
    } else {
      const aid = String(body.assignedUserId).trim();
      if (!(await isTopicMember(topicId, aid))) {
        return NextResponse.json({ error: "משתמש משויך חייב להיות חבר בנושא" }, { status: 400 });
      }
      data.assignedUserId = aid;
    }
  }

  const row = await prisma.topicExpense.update({
    where: { id: expenseId },
    data,
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ expense: mapExpense(row) });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; expenseId: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;
  const { id: topicId, expenseId } = await ctx.params;

  if (!(await isTopicMember(topicId, session.userId))) {
    return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
  }

  const existing = await prisma.topicExpense.findFirst({
    where: { id: expenseId, topicId },
  });
  if (!existing) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  await prisma.topicExpense.delete({ where: { id: expenseId } });
  return NextResponse.json({ ok: true });
}
