-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('SERVICE', 'INSTALLATION', 'RE_INSTALLATION', 'COMPLAINT', 'ENQUIRY');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'RE_ASSIGNED', 'WORK_COMPLETED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ServicePriority" AS ENUM ('HIGH', 'MEDIUM', 'NORMAL', 'LOW');

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT,
    "district" TEXT,
    "taluk" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentRole" TEXT,
    "permissions" JSONB NOT NULL,
    "immutable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "refreshToken" TEXT,
    "roleId" TEXT NOT NULL,
    "regionId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customPermissions" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "primaryPhone" TEXT NOT NULL,
    "phoneNumbers" TEXT[],
    "email" TEXT,
    "regionId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "googleMapsUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "landmark" TEXT,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "googleMapsUrl" TEXT,
    "installationType" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'ASSIGNED',
    "priority" "ServicePriority" NOT NULL DEFAULT 'NORMAL',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "assignedToId" TEXT,
    "regionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "postWorkReassignCount" INTEGER NOT NULL DEFAULT 0,
    "installationId" TEXT,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgmentComments" TEXT,
    "salesApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" TEXT,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReassignmentHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "reassignedBy" TEXT NOT NULL,
    "previousTechId" TEXT,
    "newTechId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReassignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "notes" TEXT,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkMedia" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approverRole" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "comments" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalHistory_pkey" PRIMARY KEY ("id")
);

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
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
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
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "categoryId" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "hasWarranty" BOOLEAN NOT NULL DEFAULT false,
    "warrantyMonths" INTEGER,
    "warrantyYears" INTEGER,
    "company" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
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
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "AssemblyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyUsedPart" (
    "id" TEXT NOT NULL,
    "assemblyHistoryId" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "quantityUsed" INTEGER NOT NULL,
    "costAtTime" DOUBLE PRECISION NOT NULL,

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

-- CreateTable
CREATE TABLE "ServiceUsedProduct" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT,
    "sparePartId" TEXT,
    "quantityUsed" INTEGER NOT NULL,
    "notes" TEXT,
    "confirmedBy" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceUsedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_name_key" ON "Region"("name");

-- CreateIndex
CREATE INDEX "Region_state_idx" ON "Region"("state");

-- CreateIndex
CREATE INDEX "Region_district_idx" ON "Region"("district");

-- CreateIndex
CREATE INDEX "Region_pincode_idx" ON "Region"("pincode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_primaryPhone_key" ON "Customer"("primaryPhone");

-- CreateIndex
CREATE INDEX "Customer_regionId_idx" ON "Customer"("regionId");

-- CreateIndex
CREATE INDEX "Customer_primaryPhone_idx" ON "Customer"("primaryPhone");

-- CreateIndex
CREATE INDEX "Installation_customerId_idx" ON "Installation"("customerId");

-- CreateIndex
CREATE INDEX "Installation_regionId_idx" ON "Installation"("regionId");

-- CreateIndex
CREATE INDEX "Installation_isActive_idx" ON "Installation"("isActive");

-- CreateIndex
CREATE INDEX "ServiceRequest_installationId_idx" ON "ServiceRequest"("installationId");

-- CreateIndex
CREATE INDEX "ServiceRequest_categoryId_idx" ON "ServiceRequest"("categoryId");

-- CreateIndex
CREATE INDEX "ReassignmentHistory_requestId_idx" ON "ReassignmentHistory"("requestId");

-- CreateIndex
CREATE INDEX "ReassignmentHistory_previousTechId_idx" ON "ReassignmentHistory"("previousTechId");

-- CreateIndex
CREATE INDEX "ReassignmentHistory_newTechId_idx" ON "ReassignmentHistory"("newTechId");

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
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

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
CREATE INDEX "ServiceUsedProduct_requestId_idx" ON "ServiceUsedProduct"("requestId");

-- CreateIndex
CREATE INDEX "ServiceUsedProduct_productId_idx" ON "ServiceUsedProduct"("productId");

-- CreateIndex
CREATE INDEX "ServiceUsedProduct_sparePartId_idx" ON "ServiceUsedProduct"("sparePartId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "SystemSetting_key_idx" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installation" ADD CONSTRAINT "Installation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installation" ADD CONSTRAINT "Installation_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentHistory" ADD CONSTRAINT "ReassignmentHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentHistory" ADD CONSTRAINT "ReassignmentHistory_reassignedBy_fkey" FOREIGN KEY ("reassignedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentHistory" ADD CONSTRAINT "ReassignmentHistory_previousTechId_fkey" FOREIGN KEY ("previousTechId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentHistory" ADD CONSTRAINT "ReassignmentHistory_newTechId_fkey" FOREIGN KEY ("newTechId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkMedia" ADD CONSTRAINT "WorkMedia_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "TechnicianStock" ADD CONSTRAINT "TechnicianStock_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianStock" ADD CONSTRAINT "TechnicianStock_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianStock" ADD CONSTRAINT "TechnicianStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceUsedProduct" ADD CONSTRAINT "ServiceUsedProduct_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceUsedProduct" ADD CONSTRAINT "ServiceUsedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceUsedProduct" ADD CONSTRAINT "ServiceUsedProduct_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceUsedProduct" ADD CONSTRAINT "ServiceUsedProduct_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
