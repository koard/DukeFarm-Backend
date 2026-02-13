/*
  Warnings:

  - You are about to drop the column `declaredPondCount` on the `farmer_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "farmer_profiles" DROP COLUMN "declaredPondCount",
ADD COLUMN     "declared_pond_count" INTEGER;
