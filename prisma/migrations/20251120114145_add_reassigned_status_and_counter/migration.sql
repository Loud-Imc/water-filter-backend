-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'RE_ASSIGNED';

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "postWorkReassignCount" INTEGER NOT NULL DEFAULT 0;
