/*
  Warnings:

  - You are about to alter the column `totalCost` on the `AssemblyHistory` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `costAtTime` on the `AssemblyUsedPart` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - The `phoneNumbers` column on the `Customer` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `price` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to drop the column `productCategoryId` on the `ServiceUsedProduct` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `SparePart` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to drop the `StockHistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ServiceUsedProduct" DROP CONSTRAINT "ServiceUsedProduct_productCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceUsedProduct" DROP CONSTRAINT "ServiceUsedProduct_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockHistory" DROP CONSTRAINT "StockHistory_productCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockHistory" DROP CONSTRAINT "StockHistory_productId_fkey";

-- AlterTable
ALTER TABLE "AssemblyHistory" ALTER COLUMN "totalCost" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "AssemblyUsedPart" ALTER COLUMN "costAtTime" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "phoneNumbers",
ADD COLUMN     "phoneNumbers" JSONB;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ServiceUsedProduct" DROP COLUMN "productCategoryId",
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SparePart" ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION;

-- DropTable
DROP TABLE "public"."StockHistory";

-- CreateTable
CREATE TABLE "TechnicianStock" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "sparePartId" TEXT,
    "productId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicianStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechnicianStock_technicianId_idx" ON "TechnicianStock"("technicianId");

-- CreateIndex
CREATE INDEX "TechnicianStock_sparePartId_idx" ON "TechnicianStock"("sparePartId");

-- CreateIndex
CREATE INDEX "TechnicianStock_productId_idx" ON "TechnicianStock"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianStock_technicianId_sparePartId_key" ON "TechnicianStock"("technicianId", "sparePartId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianStock_technicianId_productId_key" ON "TechnicianStock"("technicianId", "productId");

-- CreateIndex
CREATE INDEX "ServiceUsedProduct_sparePartId_idx" ON "ServiceUsedProduct"("sparePartId");

-- AddForeignKey
ALTER TABLE "TechnicianStock" ADD CONSTRAINT "TechnicianStock_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianStock" ADD CONSTRAINT "TechnicianStock_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianStock" ADD CONSTRAINT "TechnicianStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceUsedProduct" ADD CONSTRAINT "ServiceUsedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
