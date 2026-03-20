jest.mock('../../clients/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

import { OnboardingService } from '../../services/onboarding.service';
import { prisma } from '../../clients/prisma';

const mockTransaction = prisma.$transaction as jest.Mock;

describe('OnboardingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('selectRole should reject unsupported role', async () => {
    await expect(OnboardingService.selectRole('u1', 'ADMIN' as any)).rejects.toThrow(
      'role must be FARMER or RESEARCHER',
    );
  });

  it('selectRole should update role and delete opposite profile', async () => {
    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        user: {
          update: jest.fn().mockResolvedValue({
            id: 'u1',
            role: 'FARMER',
            registrationStatus: 'PENDING',
          }),
        },
        researcherProfile: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        farmerProfile: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      return cb(tx);
    });

    const result = await OnboardingService.selectRole('u1', 'FARMER' as any);

    expect(result.role).toBe('FARMER');
    expect(result.registrationStatus).toBe('PENDING');
  });

  it('selectRole should delete farmer profile when selecting RESEARCHER role', async () => {
    const deleteFarmerProfile = jest.fn().mockResolvedValue({ count: 1 });
    const deleteResearcherProfile = jest.fn().mockResolvedValue({ count: 0 });

    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        user: {
          update: jest.fn().mockResolvedValue({
            id: 'u1',
            role: 'RESEARCHER',
            registrationStatus: 'PENDING',
          }),
        },
        researcherProfile: { deleteMany: deleteResearcherProfile },
        farmerProfile: { deleteMany: deleteFarmerProfile },
      };
      return cb(tx);
    });

    const result = await OnboardingService.selectRole('u1', 'RESEARCHER' as any);

    expect(result.role).toBe('RESEARCHER');
    expect(deleteFarmerProfile).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(deleteResearcherProfile).not.toHaveBeenCalled();
  });

  it('completeFarmerProfile should create profile, ponds, and cultivation types', async () => {
    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        farmerProfile: {
          upsert: jest.fn().mockResolvedValue({ userId: 'u1', firstName: 'A' }),
          deleteMany: jest.fn(),
        },
        pond: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          create: jest.fn().mockResolvedValue({ id: 'pond-1' }),
        },
        farmerCultivationType: {
          findMany: jest.fn().mockResolvedValue([]),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          upsert: jest.fn().mockResolvedValue({ id: 'ct-1' }),
        },
        researcherProfile: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        user: {
          update: jest.fn().mockResolvedValue({
            id: 'u1',
            role: 'FARMER',
            registrationStatus: 'COMPLETED',
          }),
        },
      };
      return cb(tx);
    });

    const result = await OnboardingService.completeFarmerProfile('u1', {
      firstName: 'A',
      lastName: 'B',
      phone: '0800000000',
      farmTypes: ['SMALL' as any],
      declaredPondCount: 1,
      recordedPondCount: 1,
      farmLatitude: 13.7,
      farmLongitude: 100.5,
      farmAreaRai: 2,
      pondsPerRai: 1,
      ponds: [
        {
          pondType: 'EARTHEN' as any,
          farmType: 'SMALL' as any,
          widthM: 10,
          lengthM: 20,
          depthM: 1,
          volumeM3: 200,
        },
      ],
    });

    expect(result.user.role).toBe('FARMER');
    expect(result.profile.selectedFarmTypes).toContain('SMALL');
  });

  it('completeFarmerProfile should throw when farmTypes are empty and remove obsolete cultivation types', async () => {
    const deleteCultivation = jest.fn().mockResolvedValue({ count: 1 });
    const upsertCultivation = jest.fn().mockResolvedValue({ id: 'ct-new' });

    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        farmerProfile: {
          upsert: jest.fn().mockResolvedValue({ userId: 'u1', firstName: 'A' }),
          deleteMany: jest.fn(),
        },
        pond: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue({ id: 'pond-1' }),
        },
        farmerCultivationType: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'ct-old', farmType: 'LARGE' },
            { id: 'ct-keep', farmType: 'SMALL' },
          ]),
          deleteMany: deleteCultivation,
          upsert: upsertCultivation,
        },
        researcherProfile: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        user: {
          update: jest.fn().mockResolvedValue({
            id: 'u1',
            role: 'FARMER',
            registrationStatus: 'COMPLETED',
          }),
        },
      };
      return cb(tx);
    });

    const result = await OnboardingService.completeFarmerProfile('u1', {
      firstName: 'A',
      lastName: 'B',
      phone: '0800000000',
      farmTypes: [],
      declaredPondCount: 1,
      recordedPondCount: 1,
      farmLatitude: 13.7,
      farmLongitude: 100.5,
      farmAreaRai: 2,
      pondsPerRai: 1,
      ponds: [],
    });

    expect(deleteCultivation).toHaveBeenCalledWith({ where: { id: { in: ['ct-old'] } } });
    expect(upsertCultivation).toHaveBeenCalled();
    expect(result.profile.selectedFarmTypes).toEqual(['SMALL']);
  });


  it('completeResearcherProfile should upsert profile and complete registration', async () => {
    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        researcherProfile: {
          upsert: jest.fn().mockResolvedValue({ userId: 'u1', email: 'r@example.com' }),
        },
        farmerProfile: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        user: {
          update: jest.fn().mockResolvedValue({
            id: 'u1',
            role: 'RESEARCHER',
            registrationStatus: 'COMPLETED',
          }),
        },
      };
      return cb(tx);
    });

    const result = await OnboardingService.completeResearcherProfile('u1', {
      firstName: 'R',
      lastName: 'One',
      email: 'r@example.com',
      phone: '0900000000',
      organization: 'KU',
      department: null,
      jobTitle: null,
    });

    expect(result.user.role).toBe('RESEARCHER');
    expect(result.profile.email).toBe('r@example.com');
  });
});
