-- 1. Safe Alter Customer
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Customer' AND column_name='isMerged') THEN
        ALTER TABLE "Customer" ADD COLUMN "isMerged" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Customer' AND column_name='mergedToId') THEN
        ALTER TABLE "Customer" ADD COLUMN "mergedToId" TEXT;
    END IF;
END $$;

-- 2. Safe Alter ServiceUsedProduct
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ServiceUsedProduct' AND column_name='source') THEN
        ALTER TABLE "ServiceUsedProduct" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'technician';
    END IF;
END $$;

-- 3. Safe Create TechnicianStockTransaction
CREATE TABLE IF NOT EXISTS "TechnicianStockTransaction" (
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

-- 4. Safe Create CustomerMergeRequest
CREATE TABLE IF NOT EXISTS "CustomerMergeRequest" (
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

-- 5. Add Foreign Keys (wrapped in DO blocks to avoid duplicate errors)
DO $$ BEGIN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_mergedToId_fkey" FOREIGN KEY ("mergedToId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN END $$;

DO $$ BEGIN
    ALTER TABLE "TechnicianStockTransaction" ADD CONSTRAINT "TechnicianStockTransaction_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN END $$;

DO $$ BEGIN
    ALTER TABLE "TechnicianStockTransaction" ADD CONSTRAINT "TechnicianStockTransaction_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN END $$;

DO $$ BEGIN
    ALTER TABLE "TechnicianStockTransaction" ADD CONSTRAINT "TechnicianStockTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN END $$;

DO $$ BEGIN
    ALTER TABLE "CustomerMergeRequest" ADD CONSTRAINT "CustomerMergeRequest_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN END $$;

DO $$ BEGIN
    ALTER TABLE "CustomerMergeRequest" ADD CONSTRAINT "CustomerMergeRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN END $$;

DO $$ BEGIN
    ALTER TABLE "CustomerMergeRequest" ADD CONSTRAINT "CustomerMergeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN END $$;

-- 6. Add Indexes (wrapped in DO blocks)
DO $$ BEGIN
    CREATE INDEX "TechnicianStockTransaction_technicianId_idx" ON "TechnicianStockTransaction"("technicianId");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN END $$;

DO $$ BEGIN
    CREATE INDEX "TechnicianStockTransaction_sparePartId_idx" ON "TechnicianStockTransaction"("sparePartId");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN END $$;

DO $$ BEGIN
    CREATE INDEX "TechnicianStockTransaction_productId_idx" ON "TechnicianStockTransaction"("productId");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN END $$;

DO $$ BEGIN
    CREATE INDEX "TechnicianStockTransaction_createdAt_idx" ON "TechnicianStockTransaction"("createdAt");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN END $$;

DO $$ BEGIN
    CREATE INDEX "CustomerMergeRequest_sourceId_idx" ON "CustomerMergeRequest"("sourceId");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN END $$;

DO $$ BEGIN
    CREATE INDEX "CustomerMergeRequest_targetId_idx" ON "CustomerMergeRequest"("targetId");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN END $$;

DO $$ BEGIN
    CREATE INDEX "CustomerMergeRequest_status_idx" ON "CustomerMergeRequest"("status");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN END $$;
