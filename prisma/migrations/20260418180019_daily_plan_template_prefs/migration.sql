-- CreateTable
CREATE TABLE "DailyPlanPinnedTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "timeMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPlanPinnedTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPlanHiddenLabel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPlanHiddenLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyPlanPinnedTemplate_userId_idx" ON "DailyPlanPinnedTemplate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPlanPinnedTemplate_userId_label_key" ON "DailyPlanPinnedTemplate"("userId", "label");

-- CreateIndex
CREATE INDEX "DailyPlanHiddenLabel_userId_idx" ON "DailyPlanHiddenLabel"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPlanHiddenLabel_userId_label_key" ON "DailyPlanHiddenLabel"("userId", "label");

-- AddForeignKey
ALTER TABLE "DailyPlanPinnedTemplate" ADD CONSTRAINT "DailyPlanPinnedTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPlanHiddenLabel" ADD CONSTRAINT "DailyPlanHiddenLabel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
