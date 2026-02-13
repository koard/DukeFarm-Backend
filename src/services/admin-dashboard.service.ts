
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

    // Total Ponds: Sum declaredPondCount from FarmerProfile for farmers with this farmType (Primary OR Cultivation)
    const profileAgg = await prisma.farmerProfile.aggregate({
        where: {
            user: {
                role: 'FARMER',
                OR: [
                    { farmerProfile: { primaryFarmType: farmType } },
                    { cultivationTypes: { some: { farmType: farmType } } }
                ]
            }
        },
        _sum: { declaredPondCount: true }
    });
    const totalPonds = profileAgg._sum.declaredPondCount || 0;

    // Total Fish (Sum of latest fishRemaining from all active cycles/entries of this farmType)
    // We can group by user or fetch all latest entries.
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

    const latestEntries = await Promise.all(farmerIds.map(userId =>
        prisma.farmDataEntry.findFirst({
            where: { userId, farmType },
            orderBy: { recordedAt: 'desc' },
            select: { fishRemaining: true }
        })
    ));

    totalFish = latestEntries.reduce((sum, entry) => sum + (entry?.fishRemaining || 0), 0);


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
    const survivalMap = new Map<string, { totalRate: number; count: number }>();
    months.forEach(m => survivalMap.set(m, { totalRate: 0, count: 0 }));

    // We need to calculate the "Survival Rate" for each month.
    // Logic: For each month, look at the status of ALL active farms at that time.
    // Status at Month M = The latest entry of a farmer where recordedAt <= End of Month M of this Year.

    const fishEntries = await prisma.farmDataEntry.findMany({
        where: {
            farmType,
            userId: { in: farmerIds },
            OR: [
                { fishRemaining: { not: null } },
                { fishReleased: { not: null } }
            ],
            recordedAt: { lte: endDate } // Up to end of this year
        },
        select: { userId: true, fishRemaining: true, fishReleased: true, recordedAt: true },
        orderBy: { recordedAt: 'asc' }
    });

    // Group entries by User
    const userEntriesMap = new Map<string, typeof fishEntries>();
    fishEntries.forEach(e => {
        if (!userEntriesMap.has(e.userId)) userEntriesMap.set(e.userId, []);
        userEntriesMap.get(e.userId)?.push(e);
    });

    // For each month, calculate avg survival
    months.forEach((monthName, monthIndex) => {
        const monthEnd = new Date(year, monthIndex + 1, 0); // Last day of month
        let monthlySumRate = 0;
        let monthlyCount = 0;

        userEntriesMap.forEach((entries) => {
            // Find latest entry for this user <= monthEnd
            const entriesUntilNow = entries.filter(e => e.recordedAt <= monthEnd);
            if (entriesUntilNow.length > 0) {
                const latestEntry = entriesUntilNow[entriesUntilNow.length - 1]; // Last one due to sort

                // Heuristic for Initial: Max fishReleased or fishRemaining
                const maxCount = Math.max(
                    ...entriesUntilNow.map(e => e.fishReleased || 0),
                    ...entriesUntilNow.map(e => e.fishRemaining || 0)
                );

                if (maxCount > 0 && latestEntry && latestEntry.fishRemaining !== null) {
                    const currentCount = latestEntry.fishRemaining;
                    // Survival Rate %
                    const rate = (currentCount / maxCount) * 100;
                    monthlySumRate += rate;
                    monthlyCount++;
                }
            }
        });

        if (monthlyCount > 0) {
            survivalMap.set(monthName, { totalRate: monthlySumRate, count: monthlyCount });
        }
    });

    const survivalChart: MonthlyChartData[] = months.map(m => {
        const data = survivalMap.get(m);
        return {
            month: m,
            value: data && data.count > 0 ? parseFloat((data.totalRate / data.count).toFixed(2)) : 0
        };
    });


    // 3. Ranking Tables

    // Top 5 Survival Current (Based on latest entry of active farmers)
    const survivalRanking: RankingItem[] = [];

    for (const userId of farmerIds) {
        const userEntries = await prisma.farmDataEntry.findMany({
            where: { userId, farmType },
            orderBy: { recordedAt: 'asc' },
            select: { fishRemaining: true, fishReleased: true, recordedAt: true }
        });

        if (userEntries.length > 0) {
            // Simple Heuristic: Max fish count seen = Initial?
            const initials = userEntries.map(e => e.fishReleased || 0).filter(c => c > 0);
            const remainings = userEntries.map(e => e.fishRemaining || 0).filter(c => c >= 0);

            let initial = Math.max(...initials);
            if (initial === 0) initial = Math.max(...remainings, 1);

            const lastEntry = userEntries[userEntries.length - 1];
            const current = lastEntry?.fishRemaining ?? 0;

            // Survival Rate
            // Displaying absolute number as per mock? Mock showed '250' which looks like Count, but header says Rate. 
            // Let's use current count for now matching legacy logic behavior if strict rate isn't required by type.
            // Wait, type says `survivalRate: number`.

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
