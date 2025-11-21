import { prisma } from '../clients/prisma';
import { WeatherService } from './weather.service';
import type { CurrentWeather } from './weather.service';
import { FarmTypeValue, FARM_TYPE_VALUES } from '../types/farm';
import { logger } from '../utils/logger';

type FeedingPreset = {
  stageLabel: string;
  biomassRangeKg: string;
  notes: string[];
};

type TemperatureRange = {
  minComfortC: number;
  maxComfortC: number;
};

type GroupPreset = {
  label: string;
  temperatureRange: TemperatureRange;
  feeding: FeedingPreset;
  tips: string[];
};

type DailyRecordSnapshot = {
  recordDate: string;
  waterTemperatureC?: number | null;
  dissolvedOxygenMgL?: number | null;
  ph?: number | null;
  ammoniaMgL?: number | null;
  nitriteMgL?: number | null;
};

type GroupOverview = {
  group: FarmTypeValue;
  hasData: boolean;
  summary: {
    asOf: string;
    averageWaterTemperatureC?: number | null;
    alertLevel: 'ok' | 'warning' | 'critical';
    alertMessage?: string;
    tips: string[];
    weather?: CurrentWeather | null;
  };
  feedingRecommendation: FeedingPreset;
  recentDailyRecords: DailyRecordSnapshot[];
};

const GROUP_PRESETS: Record<FarmTypeValue, GroupPreset> = {
  NURSERY_SMALL: {
    label: 'กลุ่มอนุบาลขนาดเล็ก',
    temperatureRange: { minComfortC: 28, maxComfortC: 32 },
    feeding: {
      stageLabel: '16-30 วัน',
      biomassRangeKg: '0.01 - 0.02',
      notes: [
        'ให้อาหารวันละ 4-5 มื้อ ปรับตามพฤติกรรมกิน',
        'ติดตามอุณหภูมิและ DO ใกล้ชิดเพราะลูกปลาไวต่อการเปลี่ยนแปลง',
      ],
    },
    tips: [
      'รักษา DO ให้อยู่เหนือ 5 mg/L',
      'เปลี่ยนน้ำบางส่วนหากแอมโมเนียสูงกว่า 0.02 mg/L',
    ],
  },
  NURSERY_LARGE: {
    label: 'กลุ่มอนุบาลขนาดใหญ่',
    temperatureRange: { minComfortC: 27, maxComfortC: 31 },
    feeding: {
      stageLabel: '31-60 วัน',
      biomassRangeKg: '0.03 - 0.08',
      notes: [
        'ค่อย ๆ ลดจำนวนมื้อและเพิ่มปริมาณต่อมื้อเมื่อปลาแข็งแรงขึ้น',
        'ติดตามค่า pH ให้อยู่ในช่วง 7.0-8.0',
      ],
    },
    tips: [
      'ตรวจสอบ FCR ทุกสัปดาห์เพื่อลดต้นทุนอาหาร',
      'ใช้ไซฟอนดูดของเสียก้นบ่อเพื่อลดแอมโมเนีย',
    ],
  },
  GROWOUT: {
    label: 'กลุ่มผู้เลี้ยงขนาดตลาด',
    temperatureRange: { minComfortC: 26, maxComfortC: 30 },
    feeding: {
      stageLabel: '61-90 วัน',
      biomassRangeKg: '0.10 - 0.25',
      notes: [
        'ให้อาหารวันละ 2-3 มื้อและสังเกตเศษอาหารคงเหลือ',
        'เตรียมแผนจับขายเมื่อได้ขนาดเฉลี่ยตามที่ตลาดต้องการ',
      ],
    },
    tips: [
      'เก็บตัวอย่างน้ำเพื่อตรวจคุณภาพทุกสัปดาห์',
      'วัดน้ำหนักเฉลี่ยอย่างน้อยทุก 10 วันเพื่อตรวจ growth',
    ],
  },
};

const formatDateISO = (value: Date) => value.toISOString();

const evaluateTemperatureAlert = (
  avgTemp: number | null | undefined,
  range: TemperatureRange,
): { level: 'ok' | 'warning' | 'critical'; message?: string } => {
  if (avgTemp === null || avgTemp === undefined) {
    return { level: 'warning', message: 'ยังไม่มีข้อมูลน้ำล่าสุด' };
  }

  if (avgTemp < range.minComfortC - 2) {
    return {
      level: 'critical',
      message: `อุณหภูมิต่ำกว่ามาตรฐาน ${(range.minComfortC - avgTemp).toFixed(1)}°C ควรลดปริมาณอาหารและป้องกันลมหนาว`,
    };
  }

  if (avgTemp > range.maxComfortC + 2) {
    return {
      level: 'critical',
      message: `อุณหภูมิสูงกว่ามาตรฐาน ${(avgTemp - range.maxComfortC).toFixed(1)}°C ควรเพิ่มการถ่ายน้ำและให้อากาศ`,
    };
  }

  if (avgTemp < range.minComfortC) {
    return {
      level: 'warning',
      message: `อุณหภูมิต่ำกว่าช่วงแนะนำ ${(range.minComfortC - avgTemp).toFixed(1)}°C ลดการให้อาหารลงเล็กน้อย`,
    };
  }

  if (avgTemp > range.maxComfortC) {
    return {
      level: 'warning',
      message: `อุณหภูมิสูงกว่าช่วงแนะนำ ${(avgTemp - range.maxComfortC).toFixed(1)}°C เพิ่มการถ่ายน้ำและให้ออกซิเจน`,
    };
  }

  return { level: 'ok' };
};

const pickFarmWithLocation = (
  farms: Array<{ id: string; latitude: number | null; longitude: number | null }>,
) => farms.find((farm) => farm.latitude !== null && farm.latitude !== undefined && farm.longitude !== null && farm.longitude !== undefined);

const toDailyRecordSnapshot = (record: {
  recordDate: Date;
  waterTemperatureC: number | null;
  dissolvedOxygenMgL: number | null;
  ph: number | null;
  ammoniaMgL: number | null;
  nitriteMgL: number | null;
}): DailyRecordSnapshot => ({
  recordDate: formatDateISO(record.recordDate),
  waterTemperatureC: record.waterTemperatureC,
  dissolvedOxygenMgL: record.dissolvedOxygenMgL,
  ph: record.ph,
  ammoniaMgL: record.ammoniaMgL,
  nitriteMgL: record.nitriteMgL,
});

const computeAverageTemperature = (records: DailyRecordSnapshot[]) => {
  const temps = records
    .map((record) => record.waterTemperatureC)
    .filter((value): value is number => typeof value === 'number');

  if (!temps.length) {
    return null;
  }

  const sum = temps.reduce((acc, value) => acc + value, 0);
  return Number((sum / temps.length).toFixed(2));
};

const getGroupOverview = async (userId: string, group: FarmTypeValue): Promise<GroupOverview> => {
  const preset = GROUP_PRESETS[group];
  const farms = await prisma.farm.findMany({
    where: { ownerId: userId, farmType: group },
    select: { id: true, name: true, latitude: true, longitude: true },
  });

  if (!farms.length) {
    return {
      group,
      hasData: false,
      summary: {
        asOf: new Date().toISOString(),
        averageWaterTemperatureC: null,
        alertLevel: 'warning',
        alertMessage: 'ยังไม่มีข้อมูลฟาร์มในกลุ่มนี้',
        tips: preset.tips,
        weather: null,
      },
      feedingRecommendation: preset.feeding,
      recentDailyRecords: [],
    };
  }

  const farmIds = farms.map((farm) => farm.id);
  const productionCycles = await prisma.productionCycle.findMany({
    where: {
      pond: {
        farmId: { in: farmIds },
      },
    },
    select: { id: true },
  });
  const cycleIds = productionCycles.map((cycle) => cycle.id);

  const rawDailyRecords = cycleIds.length
    ? await prisma.dailyRecord.findMany({
        where: { productionCycleId: { in: cycleIds } },
        orderBy: { recordDate: 'desc' },
        take: 7,
      })
    : [];

  const recentDailyRecords = rawDailyRecords.map(toDailyRecordSnapshot);
  const averageWaterTemperatureC = computeAverageTemperature(recentDailyRecords);
  const alert = evaluateTemperatureAlert(averageWaterTemperatureC, preset.temperatureRange);

  let weather: CurrentWeather | null = null;
  const farmWithLocation = pickFarmWithLocation(farms);
  if (farmWithLocation) {
    try {
      weather = await WeatherService.getCurrentWeather(
        farmWithLocation.latitude as number,
        farmWithLocation.longitude as number,
      );
    } catch (error) {
      logger.warn('Unable to fetch weather for home overview', {
        farmId: farmWithLocation.id,
        error,
      });
    }
  }

  const summary: GroupOverview['summary'] = {
    asOf: recentDailyRecords[0]?.recordDate ?? new Date().toISOString(),
    averageWaterTemperatureC,
    alertLevel: alert.level,
    tips: preset.tips,
    weather,
  };

  if (alert.message !== undefined) {
    summary.alertMessage = alert.message;
  }

  return {
    group,
    hasData: recentDailyRecords.length > 0,
    summary,
    feedingRecommendation: preset.feeding,
    recentDailyRecords,
  };
};

const parseGroupParam = (raw: string | undefined): FarmTypeValue => {
  if (!raw) {
    throw new Error('Missing group type');
  }

  const value = raw.toUpperCase();
  if ((FARM_TYPE_VALUES as readonly string[]).includes(value)) {
    return value as FarmTypeValue;
  }

  throw new Error(`Unsupported group type: ${raw}`);
};

export const HomeService = {
  getGroupOverview,
  parseGroupParam,
};
