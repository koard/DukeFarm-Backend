
import { PrismaClient, FarmType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const farmType = FarmType.SMALL;

    console.log('--- Checking Data for Admin Dashboard (SMALL) ---');

    const farmers = await prisma.user.count({
        where: {
            role: 'FARMER',
            registrationStatus: 'COMPLETED',
            OR: [
                { farmerProfile: { primaryFarmType: farmType } },
                { cultivationTypes: { some: { farmType: farmType } } }
            ]
        }
    });
    console.log(`Total Farmers (SMALL): ${farmers}`);

    const allFarmers = await prisma.user.findMany({
        where: { role: 'FARMER' },
        include: { farmerProfile: true }
    });
    console.log('Sample Farmer Profile:', allFarmers[0]?.farmerProfile);

    const cultivationTypes = await prisma.farmerCultivationType.findMany({
        where: { farmType },
        select: { pondsInStage: true }
    });
    const totalPonds = cultivationTypes.reduce((sum, ct) => sum + (ct.pondsInStage || 0), 0);
    console.log(`Total Ponds (cultivationTypes): ${totalPonds}`);

    const profilesPonds = await prisma.farmerProfile.aggregate({
        where: { primaryFarmType: farmType },
        _sum: { declaredPondCount: true }
    });
    console.log(`Total Ponds (profiles): ${profilesPonds._sum.declaredPondCount}`);

    const feedAgg = await prisma.farmDataEntry.aggregate({
        where: { farmType },
        _sum: { foodAmountKg: true }
    });
    console.log(`Total Feed: ${feedAgg._sum.foodAmountKg}`);

    const entries = await prisma.farmDataEntry.count({ where: { farmType } });
    console.log(`Total FarmDataEntries: ${entries}`);

    const years = await prisma.farmDataEntry.findMany({
        where: { farmType },
        select: { recordedAt: true }
    });
    console.log('Record Years:', years.map(y => y.recordedAt.getFullYear()));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
