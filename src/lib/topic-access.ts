import { prisma } from "./prisma";

export async function isTopicMember(topicId: string, userId: string): Promise<boolean> {
  const row = await prisma.topicUser.findUnique({
    where: { topicId_userId: { topicId, userId } },
  });
  return Boolean(row);
}
