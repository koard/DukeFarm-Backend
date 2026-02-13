/*
  Warnings:

  - You are about to drop the column `fish_count` on the `farm_data_entries` table. All the data in the column will be lost.
  - You are about to drop the column `fish_count_text` on the `farm_data_entries` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "farm_data_entries" DROP COLUMN "fish_count",
DROP COLUMN "fish_count_text",
ADD COLUMN     "fish_released" INTEGER;
