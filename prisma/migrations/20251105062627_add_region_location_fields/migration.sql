/*
  Warnings:

  - Added the required column `updatedAt` to the `Region` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Region" ADD COLUMN     "city" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Region_state_idx" ON "Region"("state");

-- CreateIndex
CREATE INDEX "Region_district_idx" ON "Region"("district");

-- CreateIndex
CREATE INDEX "Region_pincode_idx" ON "Region"("pincode");
