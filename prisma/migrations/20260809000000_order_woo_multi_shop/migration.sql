-- DropIndex
DROP INDEX "Order_wooId_key";

-- CreateIndex
CREATE INDEX "Order_wooId_idx" ON "Order"("wooId");

-- CreateIndex
CREATE INDEX "Order_shopId_status_idx" ON "Order"("shopId", "status");
