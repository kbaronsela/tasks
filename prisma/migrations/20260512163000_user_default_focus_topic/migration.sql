-- AlterTable
ALTER TABLE "User" ADD COLUMN "defaultFocusTopicId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultFocusTopicId_fkey" FOREIGN KEY ("defaultFocusTopicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
