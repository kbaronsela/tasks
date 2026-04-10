import type { Prisma } from "@prisma/client";

export type TaskApiInclude = {
  topic: { select: { id: true; title: true; color: true } };
  users: { include: { user: { select: { id: true; name: true; email: true } } } };
  dependsOn: { include: { dependsOn: { select: { id: true; title: true; done: true } } } };
};

export type TaskWithApiRelations = Prisma.TaskGetPayload<{ include: TaskApiInclude }>;

export function toTaskApiJson(t: TaskWithApiRelations, sessionUserId: string) {
  const assignedToMe = t.users.some((u) => u.userId === sessionUserId);
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    done: t.done,
    doneAt: t.doneAt,
    scheduledAt: t.scheduledAt,
    dueAt: t.dueAt,
    createdAt: t.createdAt,
    topic: t.topic,
    users: t.users.map((u) => u.user),
    assignedToMe,
    prerequisites: t.dependsOn.map((d) => ({
      id: d.dependsOn.id,
      title: d.dependsOn.title,
      done: d.dependsOn.done,
    })),
  };
}
