import { FarmTypeValue, FARM_TYPE_VALUES } from '../types/farm';
import { FarmType } from '@prisma/client';
import { NurserySmallDashboardService } from './nursery-small-dashboard.service';
import { NurseryLargeDashboardService } from './nursery-large-dashboard.service';
import { GrowoutDashboardService } from './growout-dashboard.service';
import { createHttpError } from '../utils/httpError';



import { AdminDashboardService } from './admin-dashboard.service';

const getDashboard = async (userId: string, role: string, group: string, pondId?: string, year?: number): Promise<any> => {
  // If Admin, utilize AdminDashboardService
  if (role === 'ADMIN') {
    const dashboardYear = year || new Date().getFullYear();

    const farmType = Object.values(FarmType).find(k => k === group) as FarmType;
    if (!farmType) throw createHttpError(400, "Invalid farm type for admin dashboard");

    return AdminDashboardService.getDashboardStats(farmType, dashboardYear);
  }

  // Existing Logic for Farmers
  const farmType = group as FarmTypeValue;
  switch (farmType) {
    case FarmType.SMALL:
      return NurserySmallDashboardService.getDashboard(userId, pondId);
    case FarmType.LARGE:
      return NurseryLargeDashboardService.getDashboard(userId, pondId);
    case FarmType.MARKET:
      return GrowoutDashboardService.getDashboard(userId, pondId);
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
