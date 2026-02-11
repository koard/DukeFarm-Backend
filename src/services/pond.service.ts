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
     * Create a new cycle (implicitly or explicitly).
     * Note: Usually created via first FarmDataEntry if no active cycle links?
     * Or explicit start? Logic in FarmDataEntryService will handle auto-creation.
     */
};
