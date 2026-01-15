import { FarmType } from '@prisma/client';
import { prisma } from '../clients/prisma';

type CreateFeedFormulaInput = {
  name: string;
  targetStage: string;
  farmType?: FarmType | null;
  ingredients?: string;
  instruction?: string;
  recommendations?: string;
  createdBy: string; // Admin user ID
};

type UpdateFeedFormulaInput = {
  name?: string;
  targetStage?: string;
  farmType?: FarmType | null;
  ingredients?: string;
  instruction?: string;
  recommendations?: string;
};

type FeedFormulaListItem = {
  id: string;
  name: string;
  targetStage: string;
  farmType: string | null;
  ingredients: string | null;
  instruction: string | null;
  recommendations: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type PaginationParams = {
  page: number;
  limit: number;
};

type FeedFormulaListResponse = {
  data: FeedFormulaListItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
};

const createFeedFormula = async (input: CreateFeedFormulaInput) => {
  const formula = await prisma.feedFormula.create({
    data: {
      name: input.name,
      targetStage: input.targetStage,
      farmType: input.farmType ?? null,
      ingredients: input.ingredients || null,
      instruction: input.instruction || null,
      recommendations: input.recommendations || null,
      ownerId: input.createdBy,
    },
  });

  return {
    id: formula.id,
    name: formula.name,
    targetStage: formula.targetStage,
    ingredients: formula.ingredients,
    instruction: formula.instruction,
    recommendations: formula.recommendations,
    createdBy: formula.ownerId || '',
    createdAt: formula.createdAt.toISOString(),
    updatedAt: formula.updatedAt.toISOString(),
  };
};

const getFeedFormulaList = async (params: PaginationParams): Promise<FeedFormulaListResponse> => {
  const { page, limit } = params;
  const skip = (page - 1) * limit;

  const [formulas, totalCount] = await Promise.all([
    prisma.feedFormula.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.feedFormula.count(),
  ]);

  const data: FeedFormulaListItem[] = formulas.map((formula) => ({
    id: formula.id,
    name: formula.name,
    targetStage: formula.targetStage || '',
    farmType: formula.farmType,
    ingredients: formula.ingredients,
    instruction: formula.instruction,
    recommendations: formula.recommendations,
    createdBy: formula.ownerId || '',
    createdAt: formula.createdAt.toISOString(),
    updatedAt: formula.updatedAt.toISOString(),
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

const getFeedFormulaById = async (id: string) => {
  const formula = await prisma.feedFormula.findUnique({
    where: { id },
  });

  if (!formula) {
    return null;
  }

  return {
    id: formula.id,
    name: formula.name,
    targetStage: formula.targetStage,
    farmType: formula.farmType,
    ingredients: formula.ingredients,
    instruction: formula.instruction,
    recommendations: formula.recommendations,
    createdBy: formula.ownerId || '',
    createdAt: formula.createdAt.toISOString(),
    updatedAt: formula.updatedAt.toISOString(),
  };
};

const updateFeedFormula = async (id: string, input: UpdateFeedFormulaInput) => {
  const formula = await prisma.feedFormula.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.targetStage && { targetStage: input.targetStage }),
      ...(input.farmType !== undefined && { farmType: input.farmType ?? null }),
      ...(input.ingredients !== undefined && { ingredients: input.ingredients || null }),
      ...(input.instruction !== undefined && { instruction: input.instruction || null }),
      ...(input.recommendations !== undefined && { recommendations: input.recommendations || null }),
    },
  });

  return {
    id: formula.id,
    name: formula.name,
    targetStage: formula.targetStage,
    farmType: formula.farmType,
    ingredients: formula.ingredients,
    instruction: formula.instruction,
    recommendations: formula.recommendations,
    createdBy: formula.ownerId || '',
    createdAt: formula.createdAt.toISOString(),
    updatedAt: formula.updatedAt.toISOString(),
  };
};

const deleteFeedFormula = async (id: string) => {
  await prisma.feedFormula.delete({
    where: { id },
  });

  return { success: true };
};

export const FeedFormulaService = {
  createFeedFormula,
  getFeedFormulaList,
  getFeedFormulaById,
  updateFeedFormula,
  deleteFeedFormula,
};
