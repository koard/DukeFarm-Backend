-- AlterTable
ALTER TABLE "farm_data_entries" ADD COLUMN     "feed_formula_name" TEXT,
ADD COLUMN     "fish_remaining" INTEGER,
ADD COLUMN     "food_cost_baht" DOUBLE PRECISION,
ADD COLUMN     "medicine_cost_baht" DOUBLE PRECISION,
ADD COLUMN     "medicine_name" TEXT,
ADD COLUMN     "supplement_name" TEXT;
