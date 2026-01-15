/*
  Warnings:

  - You are about to drop the column `instructions` on the `feed_formulas` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "farm_data_entries" ADD COLUMN     "food_amount_kg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "feed_formulas" DROP COLUMN "instructions",
ADD COLUMN     "instruction" TEXT,
ALTER COLUMN "ingredients" SET DATA TYPE TEXT,
ALTER COLUMN "recommendations" SET DATA TYPE TEXT;
