import {
  RegistrationStatus,
  UserRole,
  FarmerProfile as FarmerProfileModel,
  ResearcherProfile as ResearcherProfileModel,
  FarmType,
  PondType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../clients/prisma';
import { createHttpError } from '../utils/httpError';

const SUPPORTED_ONBOARDING_ROLES: UserRole[] = [UserRole.FARMER, UserRole.RESEARCHER];

type PondInput = {
  pondType: PondType;
  farmType: FarmType;
  widthM: number;
  lengthM: number;
  depthM: number;
  volumeM3: number;
};

type FarmerProfilePayload = {
  firstName: string;
  lastName: string;
  phone: string;
  farmTypes: FarmType[];
  declaredPondCount: number | null;
  recordedPondCount: number | null;
  farmLatitude: number;
  farmLongitude: number;
  farmAreaRai: number | null;
  pondsPerRai: number | null;
  ponds: PondInput[];
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

type FarmerProfileResult = ProfileResult<FarmerProfileModel & { selectedFarmTypes: FarmType[] }>;

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

const syncFarmerCultivationTypes = async (
  tx: Prisma.TransactionClient,
  userId: string,
  farmTypes: FarmType[],
) => {
  const uniqueTypes = Array.from(new Set(farmTypes));
  if (!uniqueTypes.length) {
    throw createHttpError(400, 'At least one cultivation type is required');
  }

  const existing = await tx.farmerCultivationType.findMany({ where: { userId } });
  const deletions = existing
    .filter((record) => !uniqueTypes.includes(record.farmType))
    .map((record) => record.id);

  if (deletions.length > 0) {
    await tx.farmerCultivationType.deleteMany({ where: { id: { in: deletions } } });
  }

  await Promise.all(
    uniqueTypes.map((farmType) =>
      tx.farmerCultivationType.upsert({
        where: {
          farmer_cultivation_type_user_stage_unique: {
            userId,
            farmType,
          },
        },
        update: {},
        create: {
          userId,
          farmType,
        },
      }),
    ),
  );

  return uniqueTypes;
};

const completeFarmerProfile = async (
  userId: string,
  payload: FarmerProfilePayload,
): Promise<FarmerProfileResult> => {
  const farmTypes = payload.farmTypes.length ? payload.farmTypes : [FarmType.SMALL];
  const primaryFarmType = farmTypes[0] ?? FarmType.SMALL;
  const profileFields = {
    firstName: payload.firstName,
    lastName: payload.lastName,
    phone: payload.phone,
    declaredPondCount: payload.declaredPondCount,
    recordedPondCount: payload.recordedPondCount,
    farmLatitude: payload.farmLatitude,
    farmLongitude: payload.farmLongitude,
    farmAreaRai: payload.farmAreaRai,
    pondsPerRai: payload.pondsPerRai,
  };

  const result = await prisma.$transaction(async (tx) => {
    const profile = await tx.farmerProfile.upsert({
      where: { userId },
      update: {
        ...profileFields,
        primaryFarmType,
      },
      create: {
        userId,
        ...profileFields,
        primaryFarmType,
      },
    });

    // Delete existing ponds and create new ones
    await tx.pond.deleteMany({ where: { profileId: userId } });
    const createdPonds = await Promise.all(
      payload.ponds.map((pond) =>
        tx.pond.create({
          data: {
            profileId: userId,
            pondType: pond.pondType,
            farmType: pond.farmType,
            widthM: pond.widthM,
            lengthM: pond.lengthM,
            depthM: pond.depthM,
            volumeM3: pond.volumeM3,
          },
        }),
      ),
    );

    const cultivatedTypes = await syncFarmerCultivationTypes(tx, userId, farmTypes);
    await tx.researcherProfile.deleteMany({ where: { userId } });

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        role: UserRole.FARMER,
        registrationStatus: RegistrationStatus.COMPLETED,
      },
      select: { id: true, role: true, registrationStatus: true },
    });

    return { profile: { ...profile, selectedFarmTypes: cultivatedTypes, ponds: createdPonds }, user };
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
