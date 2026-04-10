import { prisma } from "./prisma";

/** Edge: prerequisite → dependent. Returns true if there is a path from `fromTaskId` to `toTaskId`. */
export async function hasPathBetweenTasks(fromTaskId: string, toTaskId: string): Promise<boolean> {
  const visited = new Set<string>();
  const stack = [fromTaskId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === toTaskId) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const dependents = await prisma.taskDependency.findMany({
      where: { dependsOnTaskId: cur },
      select: { taskId: true },
    });
    for (const d of dependents) stack.push(d.taskId);
  }
  return false;
}

/** Adding dependency: `taskId` will depend on `prerequisiteId`. Reject if this would create a cycle. */
export async function wouldCreateDependencyCycle(taskId: string, prerequisiteId: string): Promise<boolean> {
  if (taskId === prerequisiteId) return true;
  return hasPathBetweenTasks(taskId, prerequisiteId);
}
