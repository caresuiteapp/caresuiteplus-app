export type LiquidFormFactor =
  | 'phone-portrait'
  | 'phone-landscape-blocked'
  | 'tablet-portrait'
  | 'tablet-landscape'
  | 'desktop';

export type LiquidModuleId =
  | 'office'
  | 'assist'
  | 'pflege'
  | 'stationaer'
  | 'beratung'
  | 'akademie'
  | 'robotics'
  | 'platform';

export type LiquidModule = {
  id: LiquidModuleId;
  label: string;
  description: string;
  priority: string;
};

