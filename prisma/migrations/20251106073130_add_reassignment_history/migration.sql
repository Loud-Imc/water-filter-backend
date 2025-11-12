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

-- CreateIndex
CREATE INDEX "ReassignmentHistory_requestId_idx" ON "ReassignmentHistory"("requestId");

-- CreateIndex
CREATE INDEX "ReassignmentHistory_previousTechId_idx" ON "ReassignmentHistory"("previousTechId");

-- CreateIndex
CREATE INDEX "ReassignmentHistory_newTechId_idx" ON "ReassignmentHistory"("newTechId");

-- AddForeignKey
ALTER TABLE "ReassignmentHistory" ADD CONSTRAINT "ReassignmentHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentHistory" ADD CONSTRAINT "ReassignmentHistory_reassignedBy_fkey" FOREIGN KEY ("reassignedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentHistory" ADD CONSTRAINT "ReassignmentHistory_previousTechId_fkey" FOREIGN KEY ("previousTechId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentHistory" ADD CONSTRAINT "ReassignmentHistory_newTechId_fkey" FOREIGN KEY ("newTechId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
