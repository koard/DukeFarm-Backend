import { prisma } from '../clients/prisma';

type ResearcherListItem = {
  no: number;
  userId: string;
  fullName: string;
  phone: string;
  organization: string;
  department: string | null;
  registeredAt: string;
};

type PaginationParams = {
  page: number;
  limit: number;
};

type ResearcherListResponse = {
  data: ResearcherListItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
};

type ResearchSurveyListItem = {
  no: number;
  surveyId: string;
  surveyDate: string;
  surveyType: string;
  farmerName: string;
  farmType: string;
  pondCount: number;
  createdAt: string;
};

type ResearchSurveyListResponse = {
  data: ResearchSurveyListItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
};

type ResearchSurveyDetail = {
  surveyId: string;
  surveyDate: string;
  surveyType: string;
  conductedBy: string | null;
  partnerOrganization: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  farmer: {
    userId: string;
    fullName: string;
    phone: string;
    farmCoordinates: string | null;
    totalFarmAreaM2: string | null;
    pondCount: number | null;
  };
  farmData: {
    ageRange: string | null;
    pondType: string | null;
    pondCount: number | null;
    fishCount: number | null;
  };
  feedingData: {
    feedType: string | null;
    feedAmountKg: string | null;
  };
  waterQuality: {
    dissolvedOxygenMgL: number | null;
    temperatureC: number | null;
    ph: number | null;
    alkalinityMgL: number | null;
    ammoniaMgL: number | null;
  };
};

const getResearcherList = async (params: PaginationParams): Promise<ResearcherListResponse> => {
  const { page, limit } = params;
  const skip = (page - 1) * limit;

  const [researchers, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: 'RESEARCHER',
        registrationStatus: 'COMPLETED',
      },
      include: {
        researcherProfile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.user.count({
      where: {
        role: 'RESEARCHER',
        registrationStatus: 'COMPLETED',
      },
    }),
  ]);

  const data: ResearcherListItem[] = researchers.map((researcher, index) => ({
    no: skip + index + 1,
    userId: researcher.id,
    fullName: researcher.researcherProfile
      ? `${researcher.researcherProfile.firstName} ${researcher.researcherProfile.lastName}`
      : researcher.displayName || 'N/A',
    phone: researcher.researcherProfile?.phone || '-',
    organization: researcher.researcherProfile?.organization || '-',
    department: researcher.researcherProfile?.department || null,
    registeredAt: researcher.createdAt.toISOString(),
  }));

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: totalCount,
      itemsPerPage: limit,
    },
  };
};

const getResearchSurveysByResearcher = async (
  researcherId: string,
  params: PaginationParams,
): Promise<ResearchSurveyListResponse> => {
  const { page, limit } = params;
  const skip = (page - 1) * limit;

  // Get surveys conducted by this researcher
  const [surveys, totalCount] = await Promise.all([
    prisma.researchSurvey.findMany({
      where: {
        conductedBy: researcherId,
      },
      include: {
        productionCycle: true,
      },
      orderBy: {
        surveyDate: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.researchSurvey.count({
      where: {
        conductedBy: researcherId,
      },
    }),
  ]);

  const data: ResearchSurveyListItem[] = surveys.map((survey, index) => {
    // Note: Since Pond relation is removed, we cannot easily traverse to Farmer.
    // This is a breaking change accepted as part of "Delete Pond" request.
    // We return placeholders.
    return {
      no: skip + index + 1,
      surveyId: survey.id,
      surveyDate: survey.surveyDate.toISOString(),
      surveyType: survey.surveyType,
      farmerName: 'Unknown (Legacy Link Broken)',
      farmType: survey.productionCycle.farmType || 'Unknown',
      pondCount: 0,
      createdAt: survey.createdAt.toISOString(),
    };
  });

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: totalCount,
      itemsPerPage: limit,
    },
  };
};

const getResearchSurveyDetail = async (surveyId: string): Promise<ResearchSurveyDetail | null> => {
  const survey = await prisma.researchSurvey.findUnique({
    where: { id: surveyId },
    include: {
      productionCycle: true,
    },
  });

  if (!survey) {
    return null;
  }

  // Note: Deep relations broken by Pond deletion
  const payload = (survey.dataPayload as any) || {};

  return {
    surveyId: survey.id,
    surveyDate: survey.surveyDate.toISOString(),
    surveyType: survey.surveyType,
    conductedBy: survey.conductedBy,
    partnerOrganization: survey.partnerOrganization,
    notes: survey.notes,
    createdAt: survey.createdAt.toISOString(),
    updatedAt: survey.updatedAt.toISOString(),
    farmer: {
      userId: '',
      fullName: 'Unknown',
      phone: '-',
      farmCoordinates: null,
      totalFarmAreaM2: null,
      pondCount: null,
    },
    farmData: {
      ageRange: payload.farmData?.ageRange || null,
      pondType: null, // Removed
      pondCount: payload.farmData?.pondCount || null,
      fishCount: survey.productionCycle.initialStockCount || null,
    },
    feedingData: {
      feedType: payload.feedingData?.feedType || null,
      feedAmountKg: payload.feedingData?.feedAmountKg || null,
    },
    waterQuality: {
      dissolvedOxygenMgL: payload.waterQuality?.dissolvedOxygenMgL || null,
      temperatureC: payload.waterQuality?.temperatureC || null,
      ph: payload.waterQuality?.ph || null,
      alkalinityMgL: payload.waterQuality?.alkalinityMgL || null,
      ammoniaMgL: payload.waterQuality?.ammoniaMgL || null,
    },
  };
};

export const ResearcherService = {
  getResearcherList,
  getResearchSurveysByResearcher,
  getResearchSurveyDetail,
};
