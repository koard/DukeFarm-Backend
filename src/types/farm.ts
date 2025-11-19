export const FARM_TYPE_VALUES = ['NURSERY_SMALL', 'NURSERY_LARGE', 'GROWOUT'] as const;
export type FarmTypeValue = (typeof FARM_TYPE_VALUES)[number];
