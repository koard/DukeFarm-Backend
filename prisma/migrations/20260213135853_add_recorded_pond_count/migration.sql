/*
  Warnings:

  - You are about to drop the column `declared_pond_count` on the `farmer_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "farmer_profiles" DROP COLUMN "declared_pond_count",
ADD COLUMN     "declaredPondCount" INTEGER,
ADD COLUMN     "recorded_pond_count" INTEGER;
