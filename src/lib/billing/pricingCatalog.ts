import type { ProductKey } from '@/types';
import { PRODUCT_LABELS } from '@/data/constants/productLabels';
import { OFFICE_MODULE_KEY, SPECIALTY_MODULE_KEYS, isSpecialtyModuleKey } from '@/lib/modules/constants';
import { resolveIncludedModules } from '@/lib/modules/moduleAccessService';

export type BillingInterval = 'monthly' | 'annual';

export type PackageKey =
  | 'office_solo'
  | 'assist'
  | 'pflege_pro'
  | 'management'
  | 'enterprise';

export type CartLineType = 'billable' | 'included' | 'discount' | 'addon';

export type ModulePrice = {
  productKey: ProductKey;
  label: string;
  monthlyNetEur: number;
  includesOffice: boolean;
};

export type ProductPackage = {
  key: PackageKey;
  label: string;
  publicLabel: string;
  monthlyNetEur: number | null;
  modules: ProductKey[];
  isPublic: boolean;
  isContactSales: boolean;
  description: string;
};

export type AddOn = {
  key: 'ti_ready';
  label: string;
  monthlyNetEur: number;
};

export type UserTierSurcharge = {
  minUsers: number;
  maxUsers: number;
  monthlyNetEur: number;
  label: string;
};

export type PromoCode = {
  code: string;
  label: string;
  discountPercent: number;
  durationMonths: number;
  active: boolean;
};

export const TRIAL_DAYS = 14;

export const MODULE_PRICES: Record<ProductKey, ModulePrice> = {
  office: {
    productKey: 'office',
    label: PRODUCT_LABELS.office,
    monthlyNetEur: 79,
    includesOffice: false,
  },
  assist: {
    productKey: 'assist',
    label: PRODUCT_LABELS.assist,
    monthlyNetEur: 149,
    includesOffice: true,
  },
  pflege: {
    productKey: 'pflege',
    label: PRODUCT_LABELS.pflege,
    monthlyNetEur: 229,
    includesOffice: true,
  },
  stationaer: {
    productKey: 'stationaer',
    label: PRODUCT_LABELS.stationaer,
    monthlyNetEur: 299,
    includesOffice: true,
  },
  beratung: {
    productKey: 'beratung',
    label: PRODUCT_LABELS.beratung,
    monthlyNetEur: 129,
    includesOffice: true,
  },
  akademie: {
    productKey: 'akademie',
    label: PRODUCT_LABELS.akademie,
    monthlyNetEur: 129,
    includesOffice: true,
  },
};

export const ADD_ONS: AddOn[] = [
  { key: 'ti_ready', label: 'TI-ready', monthlyNetEur: 49 },
];

export const USER_TIER_SURCHARGES: UserTierSurcharge[] = [
  { minUsers: 1, maxUsers: 5, monthlyNetEur: 0, label: 'Bis 5 Nutzer inklusive' },
  { minUsers: 6, maxUsers: 15, monthlyNetEur: 29, label: '6–15 Nutzer' },
  { minUsers: 16, maxUsers: 30, monthlyNetEur: 59, label: '16–30 Nutzer' },
  { minUsers: 31, maxUsers: 50, monthlyNetEur: 99, label: '31–50 Nutzer' },
];

/** Öffentliche Pakete (Marktstart) + interner Enterprise-Katalog. */
export const PACKAGE_CATALOG: ProductPackage[] = [
  {
    key: 'office_solo',
    label: 'Starter',
    publicLabel: 'Office Solo',
    monthlyNetEur: 79,
    modules: ['office'],
    isPublic: true,
    isContactSales: false,
    description: 'Zentrale Verwaltung — Office als Standalone.',
  },
  {
    key: 'assist',
    label: 'Betreuung',
    publicLabel: 'Assist',
    monthlyNetEur: 149,
    modules: ['office', 'assist'],
    isPublic: true,
    isContactSales: false,
    description: 'Alltagsbegleitung inkl. Office-Basisverwaltung.',
  },
  {
    key: 'pflege_pro',
    label: 'Pflege Pro',
    publicLabel: 'Pflege Pro',
    monthlyNetEur: 299,
    modules: ['office', 'assist', 'pflege'],
    isPublic: true,
    isContactSales: false,
    description: 'Office, Assist und Pflege als Paket.',
  },
  {
    key: 'management',
    label: 'Management',
    publicLabel: 'Management',
    monthlyNetEur: 399,
    modules: ['office', 'assist', 'pflege', 'beratung', 'akademie'],
    isPublic: true,
    isContactSales: false,
    description: 'Office, Assist, Pflege, Beratung und Akademie.',
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    publicLabel: 'Enterprise',
    monthlyNetEur: null,
    modules: [...SPECIALTY_MODULE_KEYS, OFFICE_MODULE_KEY],
    isPublic: true,
    isContactSales: true,
    description: 'Alle Module — Preis auf Anfrage (ab 599 € intern).',
  },
];

export const DEMO_PROMO_CODES: PromoCode[] = [
  {
    code: 'ISR10050',
    label: 'Demo: 50 % für 6 Monate',
    discountPercent: 50,
    durationMonths: 6,
    active: true,
  },
];

export function getPublicPackages(): ProductPackage[] {
  return PACKAGE_CATALOG.filter((pkg) => pkg.isPublic);
}

export function getPackageByKey(key: PackageKey): ProductPackage | undefined {
  return PACKAGE_CATALOG.find((pkg) => pkg.key === key);
}

export function getModulePrice(productKey: ProductKey): number {
  return MODULE_PRICES[productKey]?.monthlyNetEur ?? 0;
}

export function getPackagePrice(key: PackageKey): number | null {
  return getPackageByKey(key)?.monthlyNetEur ?? null;
}

export function resolvePackageModules(key: PackageKey): ProductKey[] {
  const pkg = getPackageByKey(key);
  if (!pkg) return [];
  return resolveIncludedModules(pkg.modules.filter((m) => m !== OFFICE_MODULE_KEY || pkg.modules.includes(OFFICE_MODULE_KEY)));
}

export function findMatchingPackage(selectedModules: ProductKey[]): ProductPackage | null {
  const normalized = new Set(resolveIncludedModules(selectedModules));
  const billableKeys = selectedModules.filter((key) => key !== OFFICE_MODULE_KEY || !hasSpecialtySelection(selectedModules));

  for (const pkg of [...PACKAGE_CATALOG].reverse()) {
    if (pkg.key === 'enterprise') continue;
    const pkgModules = new Set(resolvePackageModules(pkg.key));
    const selectedSet = new Set(resolveIncludedModules(billableKeys.length ? billableKeys : selectedModules));
    if (pkgModules.size === selectedSet.size && [...pkgModules].every((key) => selectedSet.has(key))) {
      return pkg;
    }
  }

  const fullSelected = new Set(resolveIncludedModules(selectedModules));
  for (const pkg of PACKAGE_CATALOG) {
    if (pkg.key === 'enterprise') continue;
    const pkgModules = new Set(resolvePackageModules(pkg.key));
    if (pkgModules.size === fullSelected.size && [...pkgModules].every((key) => fullSelected.has(key))) {
      return pkg;
    }
  }

  return null;
}

function hasSpecialtySelection(modules: ProductKey[]): boolean {
  return modules.some((key) => isSpecialtyModuleKey(key));
}

export function getUserTierSurcharge(userCount: number): UserTierSurcharge {
  const tier =
    USER_TIER_SURCHARGES.find((entry) => userCount >= entry.minUsers && userCount <= entry.maxUsers) ??
    USER_TIER_SURCHARGES[USER_TIER_SURCHARGES.length - 1];
  return tier;
}

export function formatPriceEur(amount: number, interval: BillingInterval = 'monthly'): string {
  if (amount <= 0 && interval === 'monthly') return 'Inklusive';
  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
  return interval === 'annual' ? `${formatted}/Jahr` : `${formatted}/Monat`;
}
