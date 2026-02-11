-- AlterTable
ALTER TABLE "farm_data_entries" ADD COLUMN     "production_cycle_id" UUID;

-- AlterTable
ALTER TABLE "production_cycles" ADD COLUMN     "pond_id" UUID;

-- CreateIndex
CREATE INDEX "production_cycles_pond_id_idx" ON "production_cycles"("pond_id");

-- AddForeignKey
ALTER TABLE "production_cycles" ADD CONSTRAINT "production_cycles_pond_id_fkey" FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_data_entries" ADD CONSTRAINT "farm_data_entries_production_cycle_id_fkey" FOREIGN KEY ("production_cycle_id") REFERENCES "production_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
