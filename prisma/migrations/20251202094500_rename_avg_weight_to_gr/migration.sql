ALTER TABLE "farm_data_entries"
RENAME COLUMN "average_fish_weight_kg" TO "average_fish_weight_gr";

ALTER TABLE "farm_data_entries"
ALTER COLUMN "average_fish_weight_gr" TYPE DECIMAL(10,2);
