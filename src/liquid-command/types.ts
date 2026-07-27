export type LiquidModuleKey =
  | 'home'
  | 'office'
  | 'assist'
  | 'pflege'
  | 'stationaer'
  | 'beratung'
  | 'akademie'
  | 'robotics'
  | 'platform'
  | 'settings';

export type LiquidPortalKey =
  | 'employee'
  | 'client'
  | 'family'
  | 'applicant'
  | 'external'
  | 'tenant-admin';

export type LiquidPageType =
  | 'command-center'
  | 'work-list'
  | 'record'
  | 'planning'
  | 'editor'
  | 'review'
  | 'analytics'
  | 'settings';

export type LiquidModuleDefinition = {
  key: LiquidModuleKey;
  label: string;
  shortLabel: string;
  glyph: string;
  route: string;
  description: string;
  primaryAction: string;
};

export type LiquidWorkArea = {
  id: string;
  label: string;
  description: string;
  pageType: LiquidPageType;
  route: string;
};
