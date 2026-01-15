/*
  Warnings:

  - You are about to drop the column `description` on the `feed_formulas` table. All the data in the column will be lost.
  - The `recommendations` column on the `feed_formulas` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "feed_formulas" DROP COLUMN "description",
ADD COLUMN     "ingredients" JSONB,
ADD COLUMN     "instructions" JSONB,
DROP COLUMN "recommendations",
ADD COLUMN     "recommendations" JSONB;
