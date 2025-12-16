/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Disease` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Disease_name_key" ON "Disease"("name");
