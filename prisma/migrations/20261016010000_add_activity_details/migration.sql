-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "period" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "estimated_cost" DECIMAL(12,2),
ADD COLUMN     "description" TEXT;
