-- CreateTable
CREATE TABLE "farm_data_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "farm_type" "FarmType" NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "fish_age_label" TEXT NOT NULL,
    "pond_type" "PondType",
    "pond_count" INTEGER,
    "fish_count" INTEGER,
    "fish_count_text" TEXT,
    "weather_temperature_c" DOUBLE PRECISION,
    "weather_rain_mm" DOUBLE PRECISION,
    "weather_humidity_pct" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farm_data_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "farm_data_entries_user_id_recorded_at_idx" ON "farm_data_entries"("user_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "farm_data_entries"
  ADD CONSTRAINT "farm_data_entries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
