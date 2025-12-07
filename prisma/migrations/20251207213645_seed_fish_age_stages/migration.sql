INSERT INTO "fish_age_stages" (
	"id",
	"farm_type",
	"code",
	"display_name",
	"min_day",
	"max_day",
	"harvest_start_day",
	"harvest_end_day",
	"description"
)
VALUES
	('d1a5f6ce-6408-43db-8bf1-4a3d983e87a1', 'FINGERLING', 'FNG_START', 'Fingerling Hatch (0-10 d)', 0, 10, NULL, NULL, 'Newly hatched fry acclimation and yolk absorption'),
	('b500c4fd-2c7f-45d2-ac20-0d5ac35d5711', 'FINGERLING', 'FNG_FEED', 'Fingerling Intensive Feed (11-25 d)', 11, 25, NULL, NULL, 'Transition to powdered feed, focus on rapid weight gain'),
	('9cf9c58d-8b67-47f8-af38-75f8c1b88bfc', 'FINGERLING', 'FNG_TRANSFER', 'Fingerling Transfer Ready (26-45 d)', 26, 45, 40, 45, 'Prepare for movement into grow-out ponds once ≥ 5 g'),
	('0d9937a9-3ad5-48b9-8624-3c07be5b4c68', 'FATTENING', 'FAT_JUVENILE', 'Juvenile Grow (45-70 d)', 45, 70, NULL, NULL, 'Recently transferred juveniles, high protein floating pellets'),
	('7f47c4a5-f80c-47ce-b306-26f7c9f4e8aa', 'FATTENING', 'FAT_GROWTH', 'Grow-out Development (71-100 d)', 71, 100, NULL, NULL, 'Steady biomass accumulation, monitor pond density'),
	('04b59d99-da5f-4d8d-9d8d-9d7f5703e252', 'FATTENING', 'FAT_READY', 'Pre-Market Conditioning (101-120 d)', 101, 120, 110, 125, 'Conditioning period with stable feeding rate prior to market stage'),
	('983a5794-7c82-4298-8bee-7a5779bd51d5', 'MARKET', 'MKT_EARLY', 'Market Grow Early (120-160 d)', 120, 160, NULL, NULL, 'Fish entering market size range, monitor feed conversion closely'),
	('d8a4c5d2-a6c0-4e23-b986-69147ada8eb8', 'MARKET', 'MKT_PEAK', 'Market Peak Weight (161-200 d)', 161, 200, 170, 200, 'Ideal harvest window for premium weight fish'),
	('1b64c0d4-05dc-43f2-884d-09ea41573f69', 'MARKET', 'MKT_HARVEST', 'Extended Holding (>200 d)', 201, NULL, 205, NULL, 'Extended holding or staggered harvest window for contract delivery')
ON CONFLICT ("farm_type", "code") DO UPDATE SET
	"display_name" = EXCLUDED."display_name",
	"min_day" = EXCLUDED."min_day",
	"max_day" = EXCLUDED."max_day",
	"harvest_start_day" = EXCLUDED."harvest_start_day",
	"harvest_end_day" = EXCLUDED."harvest_end_day",
	"description" = EXCLUDED."description",
	"updated_at" = CURRENT_TIMESTAMP;