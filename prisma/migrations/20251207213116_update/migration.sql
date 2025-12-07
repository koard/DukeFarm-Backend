/*
  Warnings:

  - The values [NURSERY_SMALL,NURSERY_LARGE,GROWOUT] on the enum `FarmType` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "HarvestReadinessStatus" AS ENUM ('UNKNOWN', 'TOO_EARLY', 'OPTIMAL', 'LATE');

-- CreateEnum
CREATE TYPE "DiseaseCaseStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DiseaseSeverity" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- AlterEnum
BEGIN;
CREATE TYPE "FarmType_new" AS ENUM ('FINGERLING', 'FATTENING', 'MARKET');
ALTER TABLE "farms" ALTER COLUMN "farm_type" TYPE "FarmType_new" USING ("farm_type"::text::"FarmType_new");
ALTER TABLE "feed_formulas" ALTER COLUMN "farm_type" TYPE "FarmType_new" USING ("farm_type"::text::"FarmType_new");
ALTER TABLE "farmer_profiles" ALTER COLUMN "primary_farm_type" TYPE "FarmType_new" USING ("primary_farm_type"::text::"FarmType_new");
ALTER TABLE "farm_data_entries" ALTER COLUMN "farm_type" TYPE "FarmType_new" USING ("farm_type"::text::"FarmType_new");
ALTER TYPE "FarmType" RENAME TO "FarmType_old";
ALTER TYPE "FarmType_new" RENAME TO "FarmType";
DROP TYPE "FarmType_old";
COMMIT;

-- AlterTable
ALTER TABLE "farm_data_entries" ADD COLUMN     "cultivation_type_id" UUID,
ADD COLUMN     "fish_age_days" INTEGER,
ADD COLUMN     "fish_age_stage_id" UUID,
ADD COLUMN     "harvest_status" "HarvestReadinessStatus",
ADD COLUMN     "harvest_status_reason" TEXT;

-- AlterTable
ALTER TABLE "farmer_profiles" ADD COLUMN     "farm_area_rai" DECIMAL(10,2),
ADD COLUMN     "ponds_per_rai" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "production_cycles" ADD COLUMN     "farm_type" "FarmType";

-- AlterTable
ALTER TABLE "treatments" ADD COLUMN     "disease_case_id" UUID;

-- CreateTable
CREATE TABLE "farmer_cultivation_types" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "farm_type" "FarmType" NOT NULL,
    "cultivated_area_rai" DECIMAL(10,2),
    "ponds_in_stage" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farmer_cultivation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fish_age_stages" (
    "id" UUID NOT NULL,
    "farm_type" "FarmType" NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "min_day" INTEGER NOT NULL,
    "max_day" INTEGER,
    "harvest_start_day" INTEGER,
    "harvest_end_day" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fish_age_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disease_cases" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "production_cycle_id" UUID,
    "cultivation_type_id" UUID,
    "farm_type" "FarmType",
    "fish_age_stage_id" UUID,
    "reported_at" TIMESTAMP(3) NOT NULL,
    "disease_name" TEXT NOT NULL,
    "symptoms" TEXT,
    "severity" "DiseaseSeverity" NOT NULL DEFAULT 'MODERATE',
    "status" "DiseaseCaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disease_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disease_photos" (
    "id" UUID NOT NULL,
    "disease_case_id" UUID NOT NULL,
    "photo_url" TEXT NOT NULL,
    "caption" TEXT,
    "captured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disease_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "farmer_cultivation_types_user_id_idx" ON "farmer_cultivation_types"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "farmer_cultivation_types_user_id_farm_type_key" ON "farmer_cultivation_types"("user_id", "farm_type");

-- CreateIndex
CREATE UNIQUE INDEX "fish_age_stages_farm_type_code_key" ON "fish_age_stages"("farm_type", "code");

-- CreateIndex
CREATE INDEX "disease_cases_user_id_reported_at_idx" ON "disease_cases"("user_id", "reported_at");

-- CreateIndex
CREATE INDEX "disease_cases_production_cycle_id_idx" ON "disease_cases"("production_cycle_id");

-- CreateIndex
CREATE INDEX "disease_cases_cultivation_type_id_idx" ON "disease_cases"("cultivation_type_id");

-- CreateIndex
CREATE INDEX "disease_photos_disease_case_id_idx" ON "disease_photos"("disease_case_id");

-- CreateIndex
CREATE INDEX "farm_data_entries_cultivation_type_id_idx" ON "farm_data_entries"("cultivation_type_id");

-- CreateIndex
CREATE INDEX "farm_data_entries_fish_age_stage_id_idx" ON "farm_data_entries"("fish_age_stage_id");

-- CreateIndex
CREATE INDEX "treatments_disease_case_id_idx" ON "treatments"("disease_case_id");

-- AddForeignKey
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_disease_case_id_fkey" FOREIGN KEY ("disease_case_id") REFERENCES "disease_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_cultivation_types" ADD CONSTRAINT "farmer_cultivation_types_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_data_entries" ADD CONSTRAINT "farm_data_entries_cultivation_type_id_fkey" FOREIGN KEY ("cultivation_type_id") REFERENCES "farmer_cultivation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_data_entries" ADD CONSTRAINT "farm_data_entries_fish_age_stage_id_fkey" FOREIGN KEY ("fish_age_stage_id") REFERENCES "fish_age_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disease_cases" ADD CONSTRAINT "disease_cases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disease_cases" ADD CONSTRAINT "disease_cases_production_cycle_id_fkey" FOREIGN KEY ("production_cycle_id") REFERENCES "production_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disease_cases" ADD CONSTRAINT "disease_cases_cultivation_type_id_fkey" FOREIGN KEY ("cultivation_type_id") REFERENCES "farmer_cultivation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disease_cases" ADD CONSTRAINT "disease_cases_fish_age_stage_id_fkey" FOREIGN KEY ("fish_age_stage_id") REFERENCES "fish_age_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disease_photos" ADD CONSTRAINT "disease_photos_disease_case_id_fkey" FOREIGN KEY ("disease_case_id") REFERENCES "disease_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
