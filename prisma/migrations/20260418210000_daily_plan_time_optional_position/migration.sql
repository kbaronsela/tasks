-- AlterTable: position + nullable timeMin
ALTER TABLE "DailyPlanItem" ADD COLUMN "position" INTEGER;

UPDATE "DailyPlanItem" d SET "position" = sub.pos
FROM (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", day
      ORDER BY CASE WHEN "timeMin" IS NULL THEN 1 ELSE 0 END, "timeMin" ASC, "createdAt" ASC
    ) - 1 AS pos
  FROM "DailyPlanItem"
) sub
WHERE d.id = sub.id;

ALTER TABLE "DailyPlanItem" ALTER COLUMN "position" SET NOT NULL;

ALTER TABLE "DailyPlanItem" ALTER COLUMN "timeMin" DROP NOT NULL;

CREATE INDEX "DailyPlanItem_userId_day_position_idx" ON "DailyPlanItem"("userId", "day", "position");
