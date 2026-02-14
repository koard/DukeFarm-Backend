import { PrismaClient, ProductionCycleStatus, FarmType } from '@prisma/client';
import createHttpError from 'http-errors';

const prisma = new PrismaClient();

export const PondService = {
    /**
     * Get the currently active production cycle for a pond.
     */
    getActiveCycle: async (pondId: string) => {
        const cycle = await prisma.productionCycle.findFirst({
            where: {
                pondId,
                status: {
                    in: [
                        ProductionCycleStatus.PLANNING,
                        ProductionCycleStatus.STOCKING,
                        ProductionCycleStatus.GROWOUT,
                        ProductionCycleStatus.HARVEST_READY
                    ]
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return cycle;
    },

    /**
     * Close the currently active cycle (e.g. before starting a new one).
     */
    closeActiveCycle: async (pondId: string) => {
        const activeCycle = await PondService.getActiveCycle(pondId);
        if (!activeCycle) {
            throw createHttpError(404, 'No active production cycle found for this pond');
        }

        // Set status to HARVESTED (or ABORTED?) - usually Start New Cycle implies previous one ended normal or abnormal.
        // For now, let's set to HARVESTED as default closure, or allow passing status.
        // User requirement: "Start New Cycle" -> closes previous.
        return prisma.productionCycle.update({
            where: { id: activeCycle.id },
            data: {
                status: ProductionCycleStatus.HARVESTED,
                endDate: new Date(),
            }
        });
    },

    /**
     * List all production cycles for a pond (newest first).
     */
    listCycles: async (pondId: string) => {
        return prisma.productionCycle.findMany({
            where: { pondId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                startDate: true,
                endDate: true,
                status: true,
                farmType: true,
                createdAt: true,
            }
        });
    },

    /**
     * Count total production cycles for a pond.
     */
    countCycles: async (pondId: string) => {
        return prisma.productionCycle.count({
            where: { pondId }
        });
    },

    /**
     * Start a new production cycle for a pond.
     * Closes any active cycle first, then creates a new one.
     */
    startNewCycle: async (pondId: string, farmType?: FarmType) => {
        // Close active cycle if exists
        const activeCycle = await PondService.getActiveCycle(pondId);
        if (activeCycle) {
            await prisma.productionCycle.update({
                where: { id: activeCycle.id },
                data: {
                    status: ProductionCycleStatus.HARVESTED,
                    endDate: new Date(),
                }
            });
        }

        // Create new cycle in PLANNING status (waiting for first data entry)
        return prisma.productionCycle.create({
            data: {
                pondId,
                startDate: new Date(), // placeholder, will be updated on first record
                status: ProductionCycleStatus.PLANNING,
                ...(farmType ? { farmType } : {}),
            }
        });
    },
};
