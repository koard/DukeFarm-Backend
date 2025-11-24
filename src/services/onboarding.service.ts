import {
  RegistrationStatus,
  UserRole,
  FarmerProfile as FarmerProfileModel,
  ResearcherProfile as ResearcherProfileModel,
} from '@prisma/client';
import { prisma } from '../clients/prisma';
import { createHttpError } from '../utils/httpError';

const SUPPORTED_ONBOARDING_ROLES: UserRole[] = [UserRole.FARMER, UserRole.RESEARCHER];

type FarmerProfilePayload = {
  firstName: string;
  lastName: string;
  phone: string;
  primaryFarmType: 'NURSERY_SMALL' | 'NURSERY_LARGE' | 'GROWOUT';
  declaredPondCount: number | null;
  farmLatitude: number;
  farmLongitude: number;
};

type ResearcherProfilePayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organization: string;
  department: string | null;
  jobTitle: string | null;
};

type RoleSelectionResult = {
  id: string;
  role: UserRole;
  registrationStatus: RegistrationStatus;
};

type ProfileResult<TProfile> = {
  profile: TProfile;
  user: RoleSelectionResult;
};

const selectRole = async (userId: string, role: UserRole): Promise<RoleSelectionResult> => {
  if (!SUPPORTED_ONBOARDING_ROLES.includes(role)) {
    throw createHttpError(400, 'role must be FARMER or RESEARCHER');
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        role,
        registrationStatus: RegistrationStatus.PENDING,
      },
      select: { id: true, role: true, registrationStatus: true },
    });

    if (role === UserRole.FARMER) {
      await tx.researcherProfile.deleteMany({ where: { userId } });
    } else {
      await tx.farmerProfile.deleteMany({ where: { userId } });
    }

    return user;
  });

  return result;
};

const completeFarmerProfile = async (
  userId: string,
  payload: FarmerProfilePayload,
): Promise<ProfileResult<FarmerProfileModel>> => {
  const result = await prisma.$transaction(async (tx) => {
    const profile = await tx.farmerProfile.upsert({
      where: { userId },
      update: payload,
      create: {
        userId,
        ...payload,
      },
    });

    await tx.researcherProfile.deleteMany({ where: { userId } });

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        role: UserRole.FARMER,
        registrationStatus: RegistrationStatus.COMPLETED,
      },
      select: { id: true, role: true, registrationStatus: true },
    });

    return { profile, user };
  });

  return result;
};

const completeResearcherProfile = async (
  userId: string,
  payload: ResearcherProfilePayload,
): Promise<ProfileResult<ResearcherProfileModel>> => {
  const result = await prisma.$transaction(async (tx) => {
    const profile = await tx.researcherProfile.upsert({
      where: { userId },
      update: payload,
      create: {
        userId,
        ...payload,
      },
    });

    await tx.farmerProfile.deleteMany({ where: { userId } });

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        role: UserRole.RESEARCHER,
        registrationStatus: RegistrationStatus.COMPLETED,
      },
      select: { id: true, role: true, registrationStatus: true },
    });

    return { profile, user };
  });

  return result;
};

export const OnboardingService = {
  selectRole,
  completeFarmerProfile,
  completeResearcherProfile,
};
