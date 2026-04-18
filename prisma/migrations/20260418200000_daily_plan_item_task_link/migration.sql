-- AlterTable
ALTER TABLE "DailyPlanItem" ADD COLUMN "taskId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DailyPlanItem_userId_taskId_key" ON "DailyPlanItem"("userId", "taskId");

-- AddForeignKey
ALTER TABLE "DailyPlanItem" ADD CONSTRAINT "DailyPlanItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
