-- CreateEnum
CREATE TYPE "ServicePriority" AS ENUM ('HIGH', 'MEDIUM', 'NORMAL', 'LOW');

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "priority" "ServicePriority" NOT NULL DEFAULT 'NORMAL',
ALTER COLUMN "status" SET DEFAULT 'ASSIGNED';
