export const POND_TYPE_VALUES = ['EARTHEN', 'CONCRETE'] as const;
export type PondTypeValue = (typeof POND_TYPE_VALUES)[number];
