-- AlterTable
ALTER TABLE "Installation" ADD COLUMN "lastSpunChangeAt" TIMESTAMP(3);
ALTER TABLE "Installation" ADD COLUMN "nextSpunChangeAt" TIMESTAMP(3);
