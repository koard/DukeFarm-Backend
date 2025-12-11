import { FarmTypeValue, FARM_TYPE_VALUES } from '../types/farm';
import { FarmType } from '@prisma/client';
import { NurserySmallDashboardService } from './nursery-small-dashboard.service';
import { NurseryLargeDashboardService } from './nursery-large-dashboard.service';
import { GrowoutDashboardService } from './growout-dashboard.service';
import { createHttpError } from '../utils/httpError';



const getDashboard = async (userId: string, group: FarmTypeValue): Promise<any> => {
  switch (group) {
    case FarmType.SMALL:
      return NurserySmallDashboardService.getDashboard(userId);
    case FarmType.LARGE:
      return NurseryLargeDashboardService.getDashboard(userId);
    case FarmType.MARKET:
      return GrowoutDashboardService.getDashboard(userId);
    default:
      throw createHttpError(400, `Unknown group type: ${group}`);
  }
};

const parseFarmTypeParam = (raw: string | undefined): FarmTypeValue => {
  if (!raw) {
    throw new Error('Missing farm type');
  }

  const value = raw.toUpperCase();
  if ((FARM_TYPE_VALUES as readonly string[]).includes(value)) {
    return value as FarmTypeValue;
  }

  throw new Error(`Unsupported farm type: ${raw}`);
};

export const DashboardService = {
  getDashboard,
  parseFarmTypeParam,
};
