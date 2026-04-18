-- CreateTable
CREATE TABLE "DailyPlanItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "timeMin" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyPlanItem_userId_day_idx" ON "DailyPlanItem"("userId", "day");

-- AddForeignKey
ALTER TABLE "DailyPlanItem" ADD CONSTRAINT "DailyPlanItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
