import { FarmType, HarvestReadinessStatus, type FishAgeStage } from '@prisma/client';
import { prisma } from '../clients/prisma';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type FishAgeRange = {
  min: number;
  max: number | null;
};

export type AssessFishStageInput = {
  farmType: FarmType;
  recordedAt: Date;
  fishAgeLabel: string;
  productionCycleStartDate?: Date | null;
};

export type FishStageAssessment = {
  fishAgeDays: number | null;
  stage: FishAgeStage | null;
  harvestStatus: HarvestReadinessStatus | null;
  harvestStatusReason: string | null;
};

const normalizeLabel = (label: string): string =>
  label
    .replace(/[()]/g, '')
    .replace(/–|−/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase();

const extractRangeFromLabel = (label: string): FishAgeRange | null => {
  const normalized = normalizeLabel(label);
  const matches = normalized.match(/\d+/g) ?? [];
  const numbers = matches
    .map((match) => Number(match))
    .filter((value): value is number => !Number.isNaN(value));

  if (numbers.length === 0) {
    return null;
  }

  const [first, second] = numbers;
  if (typeof first !== 'number') {
    return null;
  }

  if (typeof second === 'number') {
    return { min: first, max: second };
  }

  const hasOpenEndedSymbol = normalized.includes('>') || normalized.includes('+');

  return {
    min: first,
    max: hasOpenEndedSymbol ? null : first,
  };
};

const estimateDaysFromLabel = (label: string): number | null => {
  const range = extractRangeFromLabel(label);
  if (!range) {
    return null;
  }

  if (range.max !== null) {
    return range.max;
  }

  return range.min;
};

const computeFishAgeDays = (input: AssessFishStageInput): number | null => {
  if (input.productionCycleStartDate) {
    const diffMs = input.recordedAt.getTime() - input.productionCycleStartDate.getTime();
    if (diffMs >= 0) {
      return Math.floor(diffMs / DAY_IN_MS);
    }
  }

  return estimateDaysFromLabel(input.fishAgeLabel);
};

const findStageForAge = async (farmType: FarmType, fishAgeDays: number): Promise<FishAgeStage | null> =>
  prisma.fishAgeStage.findFirst({
    where: {
      farmType,
      minDay: {
        lte: fishAgeDays,
      },
      OR: [
        {
          maxDay: null,
        },
        {
          maxDay: {
            gte: fishAgeDays,
          },
        },
      ],
    },
    orderBy: [
      { maxDay: 'asc' },
      { minDay: 'desc' },
    ],
  });

const deriveHarvestStatus = (
  stage: FishAgeStage | null,
  fishAgeDays: number | null,
): { status: HarvestReadinessStatus | null; reason: string | null } => {
  if (!stage || fishAgeDays === null) {
    return {
      status: HarvestReadinessStatus.UNKNOWN,
      reason: stage
        ? `Unable to evaluate harvest readiness for stage ${stage.displayName}`
        : 'No fish age stage definition matches the supplied data',
    };
  }

  if (!stage.harvestStartDay) {
    return {
      status: HarvestReadinessStatus.UNKNOWN,
      reason: `Stage ${stage.displayName} is not configured with a harvest window`,
    };
  }

  if (fishAgeDays < stage.harvestStartDay) {
    return {
      status: HarvestReadinessStatus.TOO_EARLY,
      reason: `Fish age ${fishAgeDays}d is below the recommended harvest start (${stage.harvestStartDay}d) for stage ${stage.displayName}`,
    };
  }

  if (stage.harvestEndDay && fishAgeDays > stage.harvestEndDay) {
    return {
      status: HarvestReadinessStatus.LATE,
      reason: `Fish age ${fishAgeDays}d exceeds the recommended window (${stage.harvestStartDay}-${stage.harvestEndDay}d) for stage ${stage.displayName}`,
    };
  }

  return {
    status: HarvestReadinessStatus.OPTIMAL,
    reason: stage.harvestEndDay
      ? `Fish age ${fishAgeDays}d sits in the optimal harvest window (${stage.harvestStartDay}-${stage.harvestEndDay}d)`
      : `Fish age ${fishAgeDays}d is past the recommended start (${stage.harvestStartDay}d) and ready for harvest`,
  };
};

const assessFishStage = async (input: AssessFishStageInput): Promise<FishStageAssessment> => {
  const fishAgeDays = computeFishAgeDays(input);

  if (fishAgeDays === null) {
    return {
      fishAgeDays: null,
      stage: null,
      harvestStatus: HarvestReadinessStatus.UNKNOWN,
      harvestStatusReason: 'Unable to determine fish age from the label or production cycle start date',
    };
  }

  const stage = await findStageForAge(input.farmType, fishAgeDays);
  const { status, reason } = deriveHarvestStatus(stage, fishAgeDays);

  return {
    fishAgeDays,
    stage,
    harvestStatus: status,
    harvestStatusReason: reason,
  };
};

export const FishStageService = {
  assessFishStage,
  estimateDaysFromLabel,
};
