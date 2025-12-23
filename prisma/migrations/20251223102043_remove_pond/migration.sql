/*
  Warnings:

  - You are about to drop the column `pond_id` on the `production_cycles` table. All the data in the column will be lost.
  - You are about to drop the `ponds` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ponds" DROP CONSTRAINT "ponds_farm_id_fkey";

-- DropForeignKey
ALTER TABLE "production_cycles" DROP CONSTRAINT "production_cycles_pond_id_fkey";

-- DropIndex
DROP INDEX "production_cycles_pond_id_idx";

-- AlterTable
ALTER TABLE "production_cycles" DROP COLUMN "pond_id";

-- DropTable
DROP TABLE "ponds";
