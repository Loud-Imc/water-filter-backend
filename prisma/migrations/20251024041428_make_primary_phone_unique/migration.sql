/*
  Warnings:

  - A unique constraint covering the columns `[primaryPhone]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Customer_primaryPhone_key" ON "Customer"("primaryPhone");
