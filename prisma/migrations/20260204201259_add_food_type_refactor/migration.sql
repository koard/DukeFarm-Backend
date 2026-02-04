/*
  Warnings:

  - You are about to drop the column `ingredients` on the `feed_formulas` table. All the data in the column will be lost.
  - You are about to drop the column `instruction` on the `feed_formulas` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "FoodType" AS ENUM ('FRESH', 'PELLET', 'SUPPLEMENT');

-- AlterTable
ALTER TABLE "feed_formulas" DROP COLUMN "ingredients",
DROP COLUMN "instruction",
ADD COLUMN     "food_type" "FoodType" NOT NULL DEFAULT 'FRESH',
ADD COLUMN     "nutrients" TEXT,
ADD COLUMN     "usage" TEXT;
