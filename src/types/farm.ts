export const FARM_TYPE_VALUES = ['FINGERLING', 'FATTENING', 'MARKET'] as const;
export type FarmTypeValue = (typeof FARM_TYPE_VALUES)[number];
