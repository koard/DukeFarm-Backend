import { NextFunction, Request, Response } from 'express';
import { LineAuthService } from '../services/lineAuth.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../clients/prisma';
import { createHttpError } from '../utils/httpError';
import { FarmType, Prisma, UserRole } from '@prisma/client';

const getLineLoginUrl = (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleParam = req.query.role as string | undefined;
    let role: UserRole | undefined;

    if (roleParam) {
      const normalized = roleParam.toUpperCase();
      if (normalized === 'FARMER') {
        role = UserRole.FARMER;
      } else if (normalized === 'RESEARCHER') {
        role = UserRole.RESEARCHER;
      } else {
        return res.status(400).json({ message: 'Invalid role parameter. Must be FARMER or RESEARCHER' });
      }
    }

    const { url } = LineAuthService.createLoginUrl(role);
    res.json({ url });
  } catch (error) {
    next(error);
  }
};

const handleLineCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error: lineError } = req.query;

    if (lineError) {
      return res.status(400).json({ message: `LINE error: ${lineError}` });
    }

    if (!code) {
      return res.status(400).json({ message: 'Missing authorization code' });
    }

    const result = await LineAuthService.handleCallback(code as string, state as string | undefined);
    
    // Fetch full user data with profile
    const fullUserData = await prisma.user.findUnique({
      where: { id: result.user.id },
      select: {
        id: true,
        lineUserId: true,
        displayName: true,
        pictureUrl: true,
        role: true,
        registrationStatus: true,
        createdAt: true,
        farmerProfile: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            primaryFarmType: true,
            declaredPondCount: true,
            farmLatitude: true,
            farmLongitude: true,
            farmAreaRai: true,
          },
        },
        researcherProfile: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            organization: true,
            department: true,
            jobTitle: true,
          },
        },
      },
    });
    
    // Redirect to frontend with query parameters
    const { env } = await import('../config/env');
    const userJson = JSON.stringify(fullUserData);
    
    const params = new URLSearchParams({
      token: result.token,
      user: userJson,
      registrationStatus: result.user.registrationStatus,
      role: result.user.role.toLowerCase(),
    });

    const redirectUrl = `${env.frontendCallbackUrl}?${params.toString()}`;
    res.redirect(redirectUrl);
  } catch (error) {
    next(error);
  }
};

const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw createHttpError(401, 'Unauthorized');
    }

    const userData = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        lineUserId: true,
        displayName: true,
        pictureUrl: true,
        role: true,
        registrationStatus: true,
        createdAt: true,
        farmerProfile: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            primaryFarmType: true,
            declaredPondCount: true,
            farmLatitude: true,
            farmLongitude: true,
            farmAreaRai: true,
          },
        },
        researcherProfile: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            organization: true,
            department: true,
            jobTitle: true,
          },
        },
        cultivationTypes: {
          select: {
            farmType: true,
            cultivatedAreaRai: true,
            pondsInStage: true,
          },
        },
      },
    });

    if (!userData) {
      throw createHttpError(404, 'User not found');
    }

    const decimalToNumber = (value?: Prisma.Decimal | null) =>
      value !== null && value !== undefined ? Number(value) : null;

    const { cultivationTypes = [], farmerProfile, ...rest } = userData;

    const farmTypesSet = new Set<FarmType>();
    cultivationTypes.forEach((ct) => {
      if (ct.farmType) {
        farmTypesSet.add(ct.farmType);
      }
    });
    if (farmerProfile?.primaryFarmType) {
      farmTypesSet.add(farmerProfile.primaryFarmType);
    }

    const farmTypes = Array.from(farmTypesSet);

    const totalAreaFromStages = cultivationTypes.reduce((sum, ct) => {
      if (!ct.cultivatedAreaRai) return sum;
      return sum + Number(ct.cultivatedAreaRai);
    }, 0);

    const totalFarmAreaRai = (() => {
      const profileArea = decimalToNumber(farmerProfile?.farmAreaRai);
      if (profileArea && profileArea > 0) {
        return profileArea;
      }
      return totalAreaFromStages > 0 ? totalAreaFromStages : null;
    })();

    const totalPondCount = (() => {
      if (typeof farmerProfile?.declaredPondCount === 'number') {
        return farmerProfile.declaredPondCount;
      }
      const pondsFromStages = cultivationTypes.reduce((sum, ct) => sum + (ct.pondsInStage ?? 0), 0);
      return pondsFromStages > 0 ? pondsFromStages : null;
    })();

    const enhancedFarmerProfile = farmerProfile
      ? {
          ...farmerProfile,
          farmAreaRai: decimalToNumber(farmerProfile.farmAreaRai),
          farmTypes,
          totalFarmAreaRai,
          totalPondCount,
        }
      : null;

    res.json({ data: { ...rest, farmerProfile: enhancedFarmerProfile } });
  } catch (error) {
    next(error);
  }
};

export const LineAuthController = {
  getLineLoginUrl,
  handleLineCallback,
  getMe,
};
