-- CreateTable
CREATE TABLE "ponds" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "pond_type" "PondType" NOT NULL,
    "width_m" DECIMAL(10,2) NOT NULL,
    "length_m" DECIMAL(10,2) NOT NULL,
    "depth_m" DECIMAL(10,2) NOT NULL,
    "volume_m3" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ponds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ponds_profile_id_idx" ON "ponds"("profile_id");

-- AddForeignKey
ALTER TABLE "ponds" ADD CONSTRAINT "ponds_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "farmer_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
