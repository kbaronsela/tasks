-- CreateTable
CREATE TABLE "TopicExpense" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "description" TEXT,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "TopicExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicProfessional" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicProfessional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicEvent" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicShoppingItem" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicPackingItem" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "packed" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicPackingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicExpense_topicId_spentAt_idx" ON "TopicExpense"("topicId", "spentAt");

-- CreateIndex
CREATE INDEX "TopicProfessional_topicId_idx" ON "TopicProfessional"("topicId");

-- CreateIndex
CREATE INDEX "TopicEvent_topicId_startsAt_idx" ON "TopicEvent"("topicId", "startsAt");

-- CreateIndex
CREATE INDEX "TopicShoppingItem_topicId_idx" ON "TopicShoppingItem"("topicId");

-- CreateIndex
CREATE INDEX "TopicPackingItem_topicId_idx" ON "TopicPackingItem"("topicId");

-- AddForeignKey
ALTER TABLE "TopicExpense" ADD CONSTRAINT "TopicExpense_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicExpense" ADD CONSTRAINT "TopicExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicProfessional" ADD CONSTRAINT "TopicProfessional_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicEvent" ADD CONSTRAINT "TopicEvent_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicShoppingItem" ADD CONSTRAINT "TopicShoppingItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicPackingItem" ADD CONSTRAINT "TopicPackingItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
