-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "isMerged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mergedToId" TEXT;

-- AlterTable
ALTER TABLE "ServiceUsedProduct" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'technician';

-- CreateTable
CREATE TABLE "TechnicianStockTransaction" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "sparePartId" TEXT,
    "productId" TEXT,
    "quantity" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicianStockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMergeRequest" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "adminNotes" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMergeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechnicianStockTransaction_technicianId_idx" ON "TechnicianStockTransaction"("technicianId");

-- CreateIndex
CREATE INDEX "TechnicianStockTransaction_sparePartId_idx" ON "TechnicianStockTransaction"("sparePartId");

-- CreateIndex
CREATE INDEX "TechnicianStockTransaction_productId_idx" ON "TechnicianStockTransaction"("productId");

-- CreateIndex
CREATE INDEX "TechnicianStockTransaction_createdAt_idx" ON "TechnicianStockTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "CustomerMergeRequest_sourceId_idx" ON "CustomerMergeRequest"("sourceId");

-- CreateIndex
CREATE INDEX "CustomerMergeRequest_targetId_idx" ON "CustomerMergeRequest"("targetId");

-- CreateIndex
CREATE INDEX "CustomerMergeRequest_status_idx" ON "CustomerMergeRequest"("status");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_mergedToId_fkey" FOREIGN KEY ("mergedToId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianStockTransaction" ADD CONSTRAINT "TechnicianStockTransaction_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianStockTransaction" ADD CONSTRAINT "TechnicianStockTransaction_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianStockTransaction" ADD CONSTRAINT "TechnicianStockTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeRequest" ADD CONSTRAINT "CustomerMergeRequest_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeRequest" ADD CONSTRAINT "CustomerMergeRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeRequest" ADD CONSTRAINT "CustomerMergeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
