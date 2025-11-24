/*
  Warnings:

  - Added the required column `primary_farm_type` to the `farmer_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "farmer_profiles" ADD COLUMN     "primary_farm_type" "FarmType" NOT NULL;
