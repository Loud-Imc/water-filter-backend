-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "ServiceUsedProduct" ADD COLUMN     "productCategoryId" TEXT,
ADD COLUMN     "sparePartId" TEXT;

-- AlterTable
ALTER TABLE "StockHistory" ADD COLUMN     "productCategoryId" TEXT;

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePartGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePartGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePart" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "groupId" TEXT,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "hasWarranty" BOOLEAN NOT NULL DEFAULT false,
    "warrantyMonths" INTEGER,
    "warrantyYears" INTEGER,
    "company" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOMTemplate" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BOMTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOMTemplateItem" (
    "id" TEXT NOT NULL,
    "bomTemplateId" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BOMTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bomTemplateId" TEXT NOT NULL,
    "assembledBy" TEXT NOT NULL,
    "assembledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "totalCost" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "AssemblyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyUsedPart" (
    "id" TEXT NOT NULL,
    "assemblyHistoryId" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "quantityUsed" INTEGER NOT NULL,
    "costAtTime" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "AssemblyUsedPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePartStockHistory" (
    "id" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparePartStockHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStockHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductStockHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");

-- CreateIndex
CREATE INDEX "ProductCategory_name_idx" ON "ProductCategory"("name");

-- CreateIndex
CREATE INDEX "ProductCategory_isActive_idx" ON "ProductCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SparePartGroup_name_key" ON "SparePartGroup"("name");

-- CreateIndex
CREATE INDEX "SparePartGroup_name_idx" ON "SparePartGroup"("name");

-- CreateIndex
CREATE INDEX "SparePartGroup_isActive_idx" ON "SparePartGroup"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SparePart_name_key" ON "SparePart"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SparePart_sku_key" ON "SparePart"("sku");

-- CreateIndex
CREATE INDEX "SparePart_name_idx" ON "SparePart"("name");

-- CreateIndex
CREATE INDEX "SparePart_sku_idx" ON "SparePart"("sku");

-- CreateIndex
CREATE INDEX "SparePart_groupId_idx" ON "SparePart"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "BOMTemplate_productId_key" ON "BOMTemplate"("productId");

-- CreateIndex
CREATE INDEX "BOMTemplate_productId_idx" ON "BOMTemplate"("productId");

-- CreateIndex
CREATE INDEX "BOMTemplate_isActive_idx" ON "BOMTemplate"("isActive");

-- CreateIndex
CREATE INDEX "BOMTemplateItem_bomTemplateId_idx" ON "BOMTemplateItem"("bomTemplateId");

-- CreateIndex
CREATE INDEX "BOMTemplateItem_sparePartId_idx" ON "BOMTemplateItem"("sparePartId");

-- CreateIndex
CREATE UNIQUE INDEX "BOMTemplateItem_bomTemplateId_sparePartId_key" ON "BOMTemplateItem"("bomTemplateId", "sparePartId");

-- CreateIndex
CREATE INDEX "AssemblyHistory_productId_idx" ON "AssemblyHistory"("productId");

-- CreateIndex
CREATE INDEX "AssemblyHistory_bomTemplateId_idx" ON "AssemblyHistory"("bomTemplateId");

-- CreateIndex
CREATE INDEX "AssemblyHistory_assembledBy_idx" ON "AssemblyHistory"("assembledBy");

-- CreateIndex
CREATE INDEX "AssemblyHistory_assembledAt_idx" ON "AssemblyHistory"("assembledAt");

-- CreateIndex
CREATE INDEX "AssemblyUsedPart_assemblyHistoryId_idx" ON "AssemblyUsedPart"("assemblyHistoryId");

-- CreateIndex
CREATE INDEX "AssemblyUsedPart_sparePartId_idx" ON "AssemblyUsedPart"("sparePartId");

-- CreateIndex
CREATE INDEX "SparePartStockHistory_sparePartId_idx" ON "SparePartStockHistory"("sparePartId");

-- CreateIndex
CREATE INDEX "SparePartStockHistory_createdAt_idx" ON "SparePartStockHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ProductStockHistory_productId_idx" ON "ProductStockHistory"("productId");

-- CreateIndex
CREATE INDEX "ProductStockHistory_createdAt_idx" ON "ProductStockHistory"("createdAt");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- AddForeignKey
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SparePartGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOMTemplate" ADD CONSTRAINT "BOMTemplate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOMTemplateItem" ADD CONSTRAINT "BOMTemplateItem_bomTemplateId_fkey" FOREIGN KEY ("bomTemplateId") REFERENCES "BOMTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOMTemplateItem" ADD CONSTRAINT "BOMTemplateItem_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyHistory" ADD CONSTRAINT "AssemblyHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyHistory" ADD CONSTRAINT "AssemblyHistory_bomTemplateId_fkey" FOREIGN KEY ("bomTemplateId") REFERENCES "BOMTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyHistory" ADD CONSTRAINT "AssemblyHistory_assembledBy_fkey" FOREIGN KEY ("assembledBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyUsedPart" ADD CONSTRAINT "AssemblyUsedPart_assemblyHistoryId_fkey" FOREIGN KEY ("assemblyHistoryId") REFERENCES "AssemblyHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyUsedPart" ADD CONSTRAINT "AssemblyUsedPart_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartStockHistory" ADD CONSTRAINT "SparePartStockHistory_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStockHistory" ADD CONSTRAINT "ProductStockHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockHistory" ADD CONSTRAINT "StockHistory_productCategoryId_fkey" FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceUsedProduct" ADD CONSTRAINT "ServiceUsedProduct_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceUsedProduct" ADD CONSTRAINT "ServiceUsedProduct_productCategoryId_fkey" FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
