-- Reset existing fish age stages and seed the new age windows.
DELETE FROM "fish_age_stages";

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
	(
		'2dfb8cb1-51e0-4598-b7b8-f0ef6d87f4b0',
		'FINGERLING',
		'FNG_TUM',
		'ปลาตุ้ม (7-10 วัน)',
		7,
		10,
		NULL,
		NULL,
		'Newly hatched fingerlings acclimating from yolk absorption to external feed'
	),
	(
		'0a6f7c3c-bad9-4aff-9e77-60ea2f0dc0cf',
		'FATTENING',
		'FAT_NIO',
		'ปลานิ้ว (11-30 วัน)',
		11,
		30,
		NULL,
		NULL,
		'Fingerlings developing fins and appetite, prepared for transfer into nursery ponds'
	),
	(
		'67c6c451-119e-404b-a398-74f0f43ad39d',
		'MARKET',
		'MKT_TALAD',
		'ปลาตลาด (31-180 วัน / 2-6 เดือน)',
		31,
		180,
		60,
		180,
		'Grow-out phase; harvest begins once fish cross 60 days (~2 months) and finishes by 6 months'
	);