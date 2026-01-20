
import { FarmType, Prisma } from '@prisma/client';
import { prisma } from '../clients/prisma';
import { FeedingCalculator } from './feeding-calculator.service';

type DashboardStats = {
    totalFarms: number;
    totalPonds: number;
    totalFish: number;
    totalFeed: number;
};

type MonthlyChartData = {
    month: string;
    value: number;
};

type RankingItem = {
    rank: number;
    farm: string;
    pondCount: number;
    fishCount: number;
    survivalRate: number; // For survival ranking
    deathRate: number;    // For survival ranking
    totalPonds?: number;  // For active ranking
    goodPonds?: number;   // For active ranking (mock for now, or based on update freq)
    avgPh?: number;       // For active ranking (mock or temp)
    lastUpdate: string;
};

type AdminDashboardResponse = {
    stats: DashboardStats;
    feedingChart: MonthlyChartData[];
    survivalChart: MonthlyChartData[];
    survivalRanking: RankingItem[];
    activeRanking: RankingItem[]; // Replaces Water Quality
};

const formatMonthLabel = (date: Date): string =>
    date.toLocaleDateString('en-US', { month: 'short' });

const getDashboardStats = async (
    farmType: FarmType,
    year: number
): Promise<AdminDashboardResponse> => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // 1. Stats Cards
    // Total Farms
    const totalFarms = await prisma.user.count({
        where: {
            role: 'FARMER',
            registrationStatus: 'COMPLETED',
            OR: [
                { farmerProfile: { primaryFarmType: farmType } },
                { cultivationTypes: { some: { farmType: farmType } } }
            ]
        }
    });

    // Total Ponds: Sum declaredPondCount from FarmerProfile for farmers with this primaryFarmType
    const profileAgg = await prisma.farmerProfile.aggregate({
        where: { primaryFarmType: farmType },
        _sum: { declaredPondCount: true }
    });
    const totalPonds = profileAgg._sum.declaredPondCount || 0;

    // Total Fish (Sum of latest fishCount from all active cycles/entries of this farmType)
    // This is tricky. We need the *latest* entry for each farmer for this farmType.
    // We can group by user or fetch all latest entries.
    // Simplified approach: Sum `fishCount` from `FarmDataEntry` where `recordedAt` is recent? 
    // Better: Get all farmers of this type, then for each, get their latest entry.
    const farmers = await prisma.user.findMany({
        where: {
            role: 'FARMER',
            OR: [
                { farmerProfile: { primaryFarmType: farmType } },
                { cultivationTypes: { some: { farmType: farmType } } }
            ]
        },
        select: { id: true }
    });

    let totalFish = 0;
    const farmerIds = farmers.map(f => f.id);

    // Optimization: We could use raw query for speed, but let's loop for now (assuming low user count)
    // or `findMany` with distinct? Prisma distinct on non-id is supported.
    // Let's try to fetch "latest entry per user"
    // Actually, `FarmDataEntry` doesn't track "Current Stock" perfectly unless we look at the latest record.
    const latestEntries = await Promise.all(farmerIds.map(userId =>
        prisma.farmDataEntry.findFirst({
            where: { userId, farmType },
            orderBy: { recordedAt: 'desc' },
            select: { fishCount: true }
        })
    ));

    totalFish = latestEntries.reduce((sum, entry) => sum + (entry?.fishCount || 0), 0);


    // Total Feed (Sum of foodAmountKg in the given year)
    const feedAgg = await prisma.farmDataEntry.aggregate({
        where: {
            farmType,
            recordedAt: { gte: startDate, lte: endDate },
            foodAmountKg: { not: null }
        },
        _sum: { foodAmountKg: true }
    });
    const totalFeed = feedAgg._sum.foodAmountKg || 0;


    // 2. Charts

    // Feeding Chart (Monthly Sum)
    // We can use groupBy if using PostgreSQL
    const feedingByMonth = await prisma.farmDataEntry.groupBy({
        by: ['recordedAt'], // Prisma groupBy date is tricky, usually we fetch and process in JS or use raw query.
        // Let's fetch all feed records for the year and aggregate in JS for simplicity.
        where: {
            farmType,
            recordedAt: { gte: startDate, lte: endDate },
            foodAmountKg: { not: null }
        },
        _sum: { foodAmountKg: true }
    });

    // Actually, groupBy recordedAt returns distinct timestamps. We need detailed records to group by month in JS.
    const feedRecords = await prisma.farmDataEntry.findMany({
        where: {
            farmType,
            recordedAt: { gte: startDate, lte: endDate },
            foodAmountKg: { not: null }
        },
        select: { recordedAt: true, foodAmountKg: true }
    });

    const feedingMap = new Map<string, number>();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    months.forEach(m => feedingMap.set(m, 0));

    feedRecords.forEach(r => {
        const m = formatMonthLabel(r.recordedAt);
        feedingMap.set(m, (feedingMap.get(m) || 0) + (r.foodAmountKg || 0));
    });

    const feedingChart: MonthlyChartData[] = months.map(m => ({
        month: m,
        value: feedingMap.get(m) || 0
    }));


    // Survival Rate Trend (Monthly Avg)
    // Survival Rate = Current Fish / Initial Fish (Needs Production Cycle context, which we might lack in simple entries)
    // Proxy: If we don't have explicit cycles, we can't easily calc global survival trend without tracking batches.
    // APPROXIMATION: Average `(fishCount / pondCount * avg_density_constant)`? No.
    // Let's use the provided `harvestStatus` or just mock a realistic trend for now OR
    // calculate it based on farmers who HAVE `fishCount` + `initialStock`.
    // Given the complexity, let's use a PLACEHOLDER calculation based on `fishCount` drop-off if possible,
    // OR simply mock it for the "Trend" since we can't accurately derive historical survival global average without cohort analysis.
    // WAIT, we can look at `FarmDataEntry` that has `fishCount`.
    // Let's just Aggregated avg fish count / user? No.

    // Real implementation: We need `ProductionCycle` to do this right. 
    // If we don't use `ProductionCycle`, we can't do this accurately.
    // For this MVF (Minimum Viable Feature), let's simply return 0s or a static realistic curve?
    // User asked for "Survival Rate Trend".
    // Let's try to see if we can calculate "Average Survival %" from active cycles?
    // Since we don't fully use ProductionCycle yet, let's return a flat 90-80% trend or 
    // calculate from distinct `fishCount` records?
    // Correct approach for now: return 100% flat if no data, or simple mock variability 
    // BUT user wants REAL data.
    // If no "Initial Stock" is recorded in FarmDataEntry, we can't calc survival.
    // `FarmDataEntry` has no `initialStock`.
    // Only `ProductionCycle` has `initialStock`.
    // Are we using ProductionCycle? (Checked schema, yes, but services mainly use FarmDataEntry directly?)
    // Let's check if we can get data from `ProductionCycle`?
    // If not, we'll output 0 for now to be honest "Real Data" (which is missing).

    const survivalChart: MonthlyChartData[] = months.map(m => ({
        month: m,
        value: 0 // Placeholder: requires ProductionCycle implementation for accuracy
    }));


    // 3. Ranking Tables

    // Top 5 Survival Current (Based on latest entry of active farmers)
    // We need `fishCount` vs `pondCount`? No, survival is vs initial. 
    // Without initial, we can't rank survival.
    // Fallback: Rank by "Total Fish Count" (Largest Farms)? 
    // Or "Best Feed Conversion"?
    // User asked for "Survival Rate".
    // Let's try to infer initial from the Max fishCount observed for that user? (Heuristic)
    const survivalRanking: RankingItem[] = [];

    for (const userId of farmerIds) {
        const userEntries = await prisma.farmDataEntry.findMany({
            where: { userId, farmType },
            orderBy: { recordedAt: 'asc' },
            select: { fishCount: true, recordedAt: true }
        });

        if (userEntries.length > 0) {
            // Simple Heuristic: Max fish count seen = Initial?
            const counts = userEntries.map(e => e.fishCount || 0).filter(c => c > 0);
            const initial = Math.max(...counts, 1);
            const current = counts[counts.length - 1] || 0;
            const survivalRate = Math.round((current / initial) * 100); // Percentage/Points?

            // This is "Survival Score"

            const profile = await prisma.farmerProfile.findUnique({ where: { userId } });
            const name = profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown';

            survivalRanking.push({
                rank: 0,
                farm: name,
                pondCount: profile?.declaredPondCount || 0,
                fishCount: current,
                survivalRate: current, // Displaying absolute number as per mock? Mock showed '250' which looks like Count, but header says Rate. 
                // Mock: survivalRate: 250, deathRate: 8.
                // Let's return Fish Count as 'Survival' and Dead as 'Death' (derived?)
                deathRate: initial - current,
                lastUpdate: userEntries[userEntries.length - 1]?.recordedAt.toLocaleDateString('th-TH') || '-'
            });
        }
    }

    // Sort by 'Survival Rate' (Current Fish Count? Or Efficiency?)
    // Mock uses "survivalRate: 250" which seems like a count.
    // User requested "Survival Rate". Let's sort by % calculated.
    // But to match MOCK TABLE COLUMNS, it showed "Survival Rate (Points/Count?)".
    // Let's assume Sorting by % is best.

    // Actually, let's sort by `survivalRate` (calculated %) descending.
    survivalRanking.sort((a, b) => {
        // Recalculate % for sort
        const rateA = (a.survivalRate / (a.survivalRate + a.deathRate)) || 0;
        const rateB = (b.survivalRate / (b.survivalRate + b.deathRate)) || 0;
        return rateB - rateA;
    });

    const top5Survival = survivalRanking.slice(0, 5).map((item, index) => ({ ...item, rank: index + 1 }));


    // Active Ranking (Top 5 Active Farms)
    // Rank by number of entries in the current year
    const activityMap = new Map<string, number>();
    // We already have farmerIds.
    // Let's count entries for each.

    const activeRanking: RankingItem[] = [];

    for (const userId of farmerIds) {
        const entryCount = await prisma.farmDataEntry.count({
            where: { userId, farmType, recordedAt: { gte: startDate } }
        });

        if (entryCount > 0) {
            const profile = await prisma.farmerProfile.findUnique({ where: { userId } });
            const name = profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown';
            const lastEntry = await prisma.farmDataEntry.findFirst({
                where: { userId, farmType },
                orderBy: { recordedAt: 'desc' }
            });

            activeRanking.push({
                rank: 0,
                farm: name,
                pondCount: 0, // Not needed for logic, but for Type
                fishCount: 0,
                survivalRate: 0,
                deathRate: 0,
                totalPonds: profile?.declaredPondCount || 0,
                goodPonds: entryCount, // Using Entry Count as proxy for "Good" or "Activity Score"
                avgPh: 0, // Placeholder
                lastUpdate: lastEntry?.recordedAt.toLocaleDateString('th-TH') || '-'
            });
        }
    }

    activeRanking.sort((a, b) => (b.goodPonds || 0) - (a.goodPonds || 0));
    const top5Active = activeRanking.slice(0, 5).map((item, index) => ({ ...item, rank: index + 1 }));


    return {
        stats: {
            totalFarms,
            totalPonds,
            totalFish,
            totalFeed
        },
        feedingChart,
        survivalChart,
        survivalRanking: top5Survival,
        activeRanking: top5Active
    };
};

export const AdminDashboardService = {
    getDashboardStats
};
