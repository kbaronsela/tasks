-- AlterTable
ALTER TABLE "TopicExpense" ADD COLUMN     "assignedUserId" TEXT;

-- AddForeignKey
ALTER TABLE "TopicExpense" ADD CONSTRAINT "TopicExpense_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
