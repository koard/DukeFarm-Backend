-- AlterTable
ALTER TABLE "farm_data_entries" ADD COLUMN     "pond_id" UUID;

-- AlterTable
ALTER TABLE "ponds" ADD COLUMN     "farm_type" "FarmType" NOT NULL DEFAULT 'SMALL';

-- CreateIndex
CREATE INDEX "farm_data_entries_pond_id_idx" ON "farm_data_entries"("pond_id");

-- AddForeignKey
ALTER TABLE "farm_data_entries" ADD CONSTRAINT "farm_data_entries_pond_id_fkey" FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
