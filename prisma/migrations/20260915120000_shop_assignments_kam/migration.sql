-- Affectation des boutiques aux KAM (un seul responsable actif par boutique).
-- La table conserve l'historique : unassignedAt marque la fin d'un mandat.

CREATE TABLE "ShopAssignment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kamUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "ShopAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShopAssignment_shopId_idx" ON "ShopAssignment"("shopId");
CREATE INDEX "ShopAssignment_kamUserId_idx" ON "ShopAssignment"("kamUserId");

ALTER TABLE "ShopAssignment" ADD CONSTRAINT "ShopAssignment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopAssignment" ADD CONSTRAINT "ShopAssignment_kamUserId_fkey" FOREIGN KEY ("kamUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopAssignment" ADD CONSTRAINT "ShopAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
