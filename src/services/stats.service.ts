import { prisma } from '../clients/prisma';
import { decimalToNumber } from '../utils/number';

export type CycleStats = {
  cycleId: string;
  pondId: string;
  totalFeedKg: number;
  firstWeightKg: number | null;
  lastWeightKg: number | null;
  fcr: number | null;
  survivalRatePct: number | null;
};

type CycleStatsInput = {
  cycleId: string;
  pondId: string;
  initialStockCount: number | null;
};

const getCycleStats = async ({
  cycleId,
  pondId,
  initialStockCount,
}: CycleStatsInput): Promise<CycleStats> => {
  const [feedAggregate, mortalityAggregate, firstMeasurement, lastMeasurement] = await Promise.all([
    prisma.feeding.aggregate({
      where: { productionCycleId: cycleId },
      _sum: { quantityKg: true },
    }),
    prisma.mortality.aggregate({
      where: { productionCycleId: cycleId },
      _sum: { count: true },
    }),
    prisma.growthMeasurement.findFirst({
      where: { productionCycleId: cycleId },
      orderBy: { measurementDate: 'asc' },
      select: { averageWeightKg: true },
    }),
    prisma.growthMeasurement.findFirst({
      where: { productionCycleId: cycleId },
      orderBy: { measurementDate: 'desc' },
      select: { averageWeightKg: true },
    }),
  ]);

  const totalFeedKg = decimalToNumber(feedAggregate._sum.quantityKg) ?? 0;
  const firstWeightKg = decimalToNumber(firstMeasurement?.averageWeightKg);
  const lastWeightKg = decimalToNumber(lastMeasurement?.averageWeightKg);
  const mortalityCount = mortalityAggregate._sum.count ?? 0;

  const estimatedStockCount =
    initialStockCount === null ? null : Math.max(initialStockCount - mortalityCount, 0);

  const biomassGainKg =
    firstWeightKg !== null &&
    lastWeightKg !== null &&
    estimatedStockCount !== null &&
    lastWeightKg > firstWeightKg
      ? (lastWeightKg - firstWeightKg) * estimatedStockCount
      : null;

  const fcr = biomassGainKg && biomassGainKg > 0 ? totalFeedKg / biomassGainKg : null;

  const survivalRatePct =
    initialStockCount && initialStockCount > 0 && estimatedStockCount !== null
      ? (estimatedStockCount / initialStockCount) * 100
      : null;

  return {
    cycleId,
    pondId,
    totalFeedKg,
    firstWeightKg,
    lastWeightKg,
    fcr,
    survivalRatePct,
  };
};

export const StatsService = {
  getCycleStats,
};
