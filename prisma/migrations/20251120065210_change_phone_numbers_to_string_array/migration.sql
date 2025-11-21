/*
  Warnings:

  - The `phoneNumbers` column on the `Customer` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "phoneNumbers",
ADD COLUMN     "phoneNumbers" TEXT[];
