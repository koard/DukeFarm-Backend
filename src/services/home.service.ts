import { FarmTypeValue, FARM_TYPE_VALUES } from '../types/farm';
import { FarmType } from '@prisma/client';
import { NurserySmallDashboardService } from './nursery-small-dashboard.service';
import { createHttpError } from '../utils/httpError';



const getGroupOverview = async (userId: string, group: FarmTypeValue): Promise<any> => {
  switch (group) {
    case FarmType.NURSERY_SMALL:
      return NurserySmallDashboardService.getDashboard(userId);
    case FarmType.NURSERY_LARGE:
    case FarmType.GROWOUT:
      throw createHttpError(501, `Dashboard for ${group} not yet implemented`);
    default:
      throw createHttpError(400, `Unknown group type: ${group}`);
  }
};

const parseGroupParam = (raw: string | undefined): FarmTypeValue => {
  if (!raw) {
    throw new Error('Missing group type');
  }

  const value = raw.toUpperCase();
  if ((FARM_TYPE_VALUES as readonly string[]).includes(value)) {
    return value as FarmTypeValue;
  }

  throw new Error(`Unsupported group type: ${raw}`);
};

export const HomeService = {
  getGroupOverview,
  parseGroupParam,
};
