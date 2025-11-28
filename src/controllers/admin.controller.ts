import { NextFunction, Request, Response } from 'express';
import { prisma } from '../clients/prisma';
import { createHttpError } from '../utils/httpError';
import { signJwt } from '../utils/jwt';
import crypto from 'crypto';
import { UserRole } from '@prisma/client';

/**
 * Admin login with email and password
 * Email is stored in ResearcherProfile for admin users
 */
const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      throw createHttpError(400, 'Email and password are required');
    }

    // Find user by email in ResearcherProfile (admins use researcher profile for email)
    const researcherProfile = await prisma.researcherProfile.findFirst({
      where: {
        email: email.toLowerCase().trim(),
      },
      include: {
        user: true,
      },
    });

    if (!researcherProfile) {
      throw createHttpError(401, 'Invalid email or password');
    }

    const user = researcherProfile.user;

    // Check if user is ADMIN
    if (user.role !== UserRole.ADMIN) {
      throw createHttpError(403, 'Access denied. Admin role required.');
    }

    // Hash the provided password and compare
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    if (user.passwordHash !== hashedPassword) {
      throw createHttpError(401, 'Invalid email or password');
    }

    // Generate JWT token
    const tokenPayload = {
      sub: user.id,
      provider: 'LOCAL' as const,
      displayName: user.displayName || `${researcherProfile.firstName} ${researcherProfile.lastName}`,
      role: user.role,
      registrationStatus: user.registrationStatus,
    };

    const token = signJwt(tokenPayload);

    // Return token and user data
    res.json({
      data: {
        token,
        user: {
          id: user.id,
          email: researcherProfile.email,
          displayName: user.displayName || `${researcherProfile.firstName} ${researcherProfile.lastName}`,
          role: user.role,
          registrationStatus: user.registrationStatus,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create admin user (for initial setup)
 * This endpoint should be protected or removed after creating admin users
 */
const createAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, phone, organization } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName || !phone || !organization) {
      throw createHttpError(400, 'All fields are required: email, password, firstName, lastName, phone, organization');
    }

    // Check if email already exists
    const existingProfile = await prisma.researcherProfile.findFirst({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingProfile) {
      throw createHttpError(409, 'Email already exists');
    }

    // Hash password
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    // Create user and researcher profile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          passwordHash: hashedPassword,
          displayName: `${firstName} ${lastName}`,
          loginProvider: 'LOCAL',
          role: UserRole.ADMIN,
          registrationStatus: 'COMPLETED',
        },
      });

      const profile = await tx.researcherProfile.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          email: email.toLowerCase().trim(),
          phone,
          organization,
          department: req.body.department || null,
          jobTitle: req.body.jobTitle || 'Administrator',
        },
      });

      return { user, profile };
    });

    res.status(201).json({
      data: {
        id: result.user.id,
        email: result.profile.email,
        displayName: result.user.displayName,
        role: result.user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const AdminController = {
  login,
  createAdmin,
};
