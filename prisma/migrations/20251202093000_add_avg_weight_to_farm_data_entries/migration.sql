-- Add average fish weight column for farm data entries
ALTER TABLE "farm_data_entries"
ADD COLUMN "average_fish_weight_kg" DECIMAL(8,3);
