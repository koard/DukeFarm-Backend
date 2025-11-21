/*
  Warnings:

  - You are about to drop the column `farm_name` on the `farmer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `farm_role` on the `farmer_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "farmer_profiles" DROP COLUMN "farm_name",
DROP COLUMN "farm_role",
ADD COLUMN     "farm_latitude" DOUBLE PRECISION,
ADD COLUMN     "farm_longitude" DOUBLE PRECISION;
