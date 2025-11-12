-- CreateTable
CREATE TABLE "ServiceUsedProduct" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityUsed" INTEGER NOT NULL,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedBy" TEXT NOT NULL,

    CONSTRAINT "ServiceUsedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceUsedProduct_requestId_idx" ON "ServiceUsedProduct"("requestId");

-- CreateIndex
CREATE INDEX "ServiceUsedProduct_productId_idx" ON "ServiceUsedProduct"("productId");

-- AddForeignKey
ALTER TABLE "ServiceUsedProduct" ADD CONSTRAINT "ServiceUsedProduct_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceUsedProduct" ADD CONSTRAINT "ServiceUsedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceUsedProduct" ADD CONSTRAINT "ServiceUsedProduct_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
