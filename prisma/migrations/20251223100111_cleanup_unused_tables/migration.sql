/*
  Warnings:

  - You are about to drop the `feed_formula_ingredients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `feed_types` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `feedings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `growth_measurements` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mortalities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `treatments` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "feed_formula_ingredients" DROP CONSTRAINT "feed_formula_ingredients_feed_formula_id_fkey";

-- DropForeignKey
ALTER TABLE "feed_formula_ingredients" DROP CONSTRAINT "feed_formula_ingredients_feed_type_id_fkey";

-- DropForeignKey
ALTER TABLE "feedings" DROP CONSTRAINT "feedings_feed_formula_id_fkey";

-- DropForeignKey
ALTER TABLE "feedings" DROP CONSTRAINT "feedings_feed_type_id_fkey";

-- DropForeignKey
ALTER TABLE "feedings" DROP CONSTRAINT "feedings_production_cycle_id_fkey";

-- DropForeignKey
ALTER TABLE "growth_measurements" DROP CONSTRAINT "growth_measurements_production_cycle_id_fkey";

-- DropForeignKey
ALTER TABLE "mortalities" DROP CONSTRAINT "mortalities_production_cycle_id_fkey";

-- DropForeignKey
ALTER TABLE "treatments" DROP CONSTRAINT "treatments_disease_case_id_fkey";

-- DropForeignKey
ALTER TABLE "treatments" DROP CONSTRAINT "treatments_production_cycle_id_fkey";

-- DropTable
DROP TABLE "feed_formula_ingredients";

-- DropTable
DROP TABLE "feed_types";

-- DropTable
DROP TABLE "feedings";

-- DropTable
DROP TABLE "growth_measurements";

-- DropTable
DROP TABLE "mortalities";

-- DropTable
DROP TABLE "treatments";
