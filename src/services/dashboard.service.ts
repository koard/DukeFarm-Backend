import { FarmTypeValue, FARM_TYPE_VALUES } from '../types/farm';
import { FarmType } from '@prisma/client';
import { NurserySmallDashboardService } from './nursery-small-dashboard.service';
import { NurseryLargeDashboardService } from './nursery-large-dashboard.service';
import { GrowoutDashboardService } from './growout-dashboard.service';
import { createHttpError } from '../utils/httpError';



import { AdminDashboardService } from './admin-dashboard.service';

const getDashboard = async (userId: string, role: string, group: string, pondId?: string): Promise<any> => {
  // If Admin, utilize AdminDashboardService
  if (role === 'ADMIN') {
    // group (farmType) and year (implicit or param? Let's parse year if passed, or default current)
    // The current signature only has userId and group. We need role.
    // Assuming group comes as query param 'farmType'.
    // We might need year? Let's assume current year for now or pass 'year' param if updated.
    // For now, hardcode 2025 or current year.
    const year = new Date().getFullYear();
    // Need to cast group to FarmType
    // parseFarmTypeParam handles validation.

    // Correction: group is FarmTypeValue.

    // We need to import FarmType enum from prisma
    const farmType = Object.values(FarmType).find(k => k === group) as FarmType;
    if (!farmType) throw createHttpError(400, "Invalid farm type for admin dashboard");

    return AdminDashboardService.getDashboardStats(farmType, year);

  }

  // Existing Logic for Farmers
  const farmType = group as FarmTypeValue; // Cast safely or validate
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
