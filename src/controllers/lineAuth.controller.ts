import { NextFunction, Request, Response } from 'express';
import { LineAuthService } from '../services/lineAuth.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../clients/prisma';
import { createHttpError } from '../utils/httpError';

const getLineLoginUrl = (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = LineAuthService.createLoginUrl();
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
    res.json(result);
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

    if (!userData) {
      throw createHttpError(404, 'User not found');
    }

    res.json({ data: userData });
  } catch (error) {
    next(error);
  }
};

export const LineAuthController = {
  getLineLoginUrl,
  handleLineCallback,
  getMe,
};
