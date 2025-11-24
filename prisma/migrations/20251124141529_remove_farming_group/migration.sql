/*
  Warnings:

  - You are about to drop the column `farming_group` on the `farmer_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "farmer_profiles" DROP COLUMN "farming_group";

-- DropEnum
DROP TYPE "FarmingGroup";
