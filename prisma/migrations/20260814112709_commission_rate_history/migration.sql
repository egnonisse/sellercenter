-- CreateTable
CREATE TABLE "CommissionRateHistory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "rate" DOUBLE PRECISION NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionRateHistory_categoryId_validFrom_idx" ON "CommissionRateHistory"("categoryId", "validFrom");

-- AddForeignKey
ALTER TABLE "CommissionRateHistory" ADD CONSTRAINT "CommissionRateHistory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRateHistory" ADD CONSTRAINT "CommissionRateHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
