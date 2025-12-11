export const FARM_TYPE_VALUES = ['SMALL', 'LARGE', 'MARKET'] as const;
export type FarmTypeValue = (typeof FARM_TYPE_VALUES)[number];
