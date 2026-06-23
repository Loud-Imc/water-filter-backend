-- AlterTable
ALTER TABLE "ServiceUsedProduct" ADD COLUMN     "externalName" TEXT,
ADD COLUMN     "externalPrice" DOUBLE PRECISION,
ADD COLUMN     "externalWarrantyMonths" INTEGER,
ADD COLUMN     "isExternal" BOOLEAN NOT NULL DEFAULT false;
