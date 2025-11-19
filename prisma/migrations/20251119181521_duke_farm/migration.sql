-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FARMER', 'RESEARCHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "FarmType" AS ENUM ('NURSERY_SMALL', 'NURSERY_LARGE', 'GROWOUT');

-- CreateEnum
CREATE TYPE "PondType" AS ENUM ('EARTHEN', 'CONCRETE');

-- CreateEnum
CREATE TYPE "ProductionCycleStatus" AS ENUM ('PLANNING', 'STOCKING', 'GROWOUT', 'HARVEST_READY', 'HARVESTED', 'ABORTED');

-- CreateEnum
CREATE TYPE "LoginProvider" AS ENUM ('LOCAL', 'LINE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "line_user_id" TEXT,
    "display_name" TEXT,
    "picture_url" TEXT,
    "login_provider" "LoginProvider" NOT NULL DEFAULT 'LINE',
    "role" "UserRole" NOT NULL DEFAULT 'FARMER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "farm_type" "FarmType" NOT NULL,
    "address" TEXT,
    "province" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "area_m2" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ponds" (
    "id" UUID NOT NULL,
    "farm_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "pond_type" "PondType" NOT NULL,
    "area_m2" DECIMAL(10,2),
    "max_depth_m" DECIMAL(10,2),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ponds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_cycles" (
    "id" UUID NOT NULL,
    "pond_id" UUID NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "status" "ProductionCycleStatus" NOT NULL DEFAULT 'PLANNING',
    "initial_stock_count" INTEGER,
    "initial_avg_weight_kg" DECIMAL(8,3),
    "target_harvest_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_records" (
    "id" UUID NOT NULL,
    "production_cycle_id" UUID NOT NULL,
    "record_date" TIMESTAMP(3) NOT NULL,
    "water_temperature_c" DOUBLE PRECISION,
    "dissolved_oxygen_mg_l" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "ammonia_mg_l" DOUBLE PRECISION,
    "nitrite_mg_l" DOUBLE PRECISION,
    "weather_summary" TEXT,
    "feeding_behavior" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_types" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "pellet_size_mm" DOUBLE PRECISION,
    "protein_percent" DOUBLE PRECISION,
    "lipid_percent" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_formulas" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_stage" TEXT,
    "farm_id" UUID,
    "owner_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_formula_ingredients" (
    "id" UUID NOT NULL,
    "feed_formula_id" UUID NOT NULL,
    "feed_type_id" UUID NOT NULL,
    "inclusion_pct" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_formula_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedings" (
    "id" UUID NOT NULL,
    "production_cycle_id" UUID NOT NULL,
    "feed_type_id" UUID,
    "feed_formula_id" UUID,
    "feeding_time" TIMESTAMP(3) NOT NULL,
    "quantity_kg" DECIMAL(10,2) NOT NULL,
    "moisture_percent" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_measurements" (
    "id" UUID NOT NULL,
    "production_cycle_id" UUID NOT NULL,
    "measurement_date" TIMESTAMP(3) NOT NULL,
    "sample_size" INTEGER,
    "average_weight_kg" DECIMAL(8,3),
    "length_cm" DOUBLE PRECISION,
    "survival_rate_percent" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortalities" (
    "id" UUID NOT NULL,
    "production_cycle_id" UUID NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "cause" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mortalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatments" (
    "id" UUID NOT NULL,
    "production_cycle_id" UUID NOT NULL,
    "treatment_date" TIMESTAMP(3) NOT NULL,
    "treatment_type" TEXT NOT NULL,
    "product_name" TEXT,
    "dosage" TEXT,
    "administered_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treatments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_surveys" (
    "id" UUID NOT NULL,
    "production_cycle_id" UUID NOT NULL,
    "survey_date" TIMESTAMP(3) NOT NULL,
    "survey_type" TEXT NOT NULL,
    "conducted_by" TEXT,
    "partner_organization" TEXT,
    "data_payload" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_line_user_id_key" ON "users"("line_user_id");

-- CreateIndex
CREATE INDEX "farms_owner_id_idx" ON "farms"("owner_id");

-- CreateIndex
CREATE INDEX "ponds_farm_id_idx" ON "ponds"("farm_id");

-- CreateIndex
CREATE INDEX "production_cycles_pond_id_idx" ON "production_cycles"("pond_id");

-- CreateIndex
CREATE INDEX "production_cycles_status_idx" ON "production_cycles"("status");

-- CreateIndex
CREATE INDEX "daily_records_production_cycle_id_record_date_idx" ON "daily_records"("production_cycle_id", "record_date");

-- CreateIndex
CREATE UNIQUE INDEX "feed_types_name_brand_key" ON "feed_types"("name", "brand");

-- CreateIndex
CREATE UNIQUE INDEX "feed_formula_ingredients_feed_formula_id_feed_type_id_key" ON "feed_formula_ingredients"("feed_formula_id", "feed_type_id");

-- CreateIndex
CREATE INDEX "feedings_production_cycle_id_feeding_time_idx" ON "feedings"("production_cycle_id", "feeding_time");

-- CreateIndex
CREATE INDEX "growth_measurements_production_cycle_id_measurement_date_idx" ON "growth_measurements"("production_cycle_id", "measurement_date");

-- CreateIndex
CREATE INDEX "mortalities_production_cycle_id_event_date_idx" ON "mortalities"("production_cycle_id", "event_date");

-- CreateIndex
CREATE INDEX "treatments_production_cycle_id_treatment_date_idx" ON "treatments"("production_cycle_id", "treatment_date");

-- CreateIndex
CREATE INDEX "research_surveys_production_cycle_id_survey_date_idx" ON "research_surveys"("production_cycle_id", "survey_date");

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ponds" ADD CONSTRAINT "ponds_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_cycles" ADD CONSTRAINT "production_cycles_pond_id_fkey" FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_records" ADD CONSTRAINT "daily_records_production_cycle_id_fkey" FOREIGN KEY ("production_cycle_id") REFERENCES "production_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_formulas" ADD CONSTRAINT "feed_formulas_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_formulas" ADD CONSTRAINT "feed_formulas_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_formula_ingredients" ADD CONSTRAINT "feed_formula_ingredients_feed_formula_id_fkey" FOREIGN KEY ("feed_formula_id") REFERENCES "feed_formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_formula_ingredients" ADD CONSTRAINT "feed_formula_ingredients_feed_type_id_fkey" FOREIGN KEY ("feed_type_id") REFERENCES "feed_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedings" ADD CONSTRAINT "feedings_production_cycle_id_fkey" FOREIGN KEY ("production_cycle_id") REFERENCES "production_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedings" ADD CONSTRAINT "feedings_feed_type_id_fkey" FOREIGN KEY ("feed_type_id") REFERENCES "feed_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedings" ADD CONSTRAINT "feedings_feed_formula_id_fkey" FOREIGN KEY ("feed_formula_id") REFERENCES "feed_formulas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_measurements" ADD CONSTRAINT "growth_measurements_production_cycle_id_fkey" FOREIGN KEY ("production_cycle_id") REFERENCES "production_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortalities" ADD CONSTRAINT "mortalities_production_cycle_id_fkey" FOREIGN KEY ("production_cycle_id") REFERENCES "production_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_production_cycle_id_fkey" FOREIGN KEY ("production_cycle_id") REFERENCES "production_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_surveys" ADD CONSTRAINT "research_surveys_production_cycle_id_fkey" FOREIGN KEY ("production_cycle_id") REFERENCES "production_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
