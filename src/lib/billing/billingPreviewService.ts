import type { ProductKey } from '@/types';
import { PRODUCT_LABELS } from '@/data/constants/productLabels';
import { OFFICE_MODULE_KEY, isSpecialtyModuleKey } from '@/lib/modules/constants';
import { getTenantModules } from '@/lib/modules/moduleAccessService';
import {
  ADD_ONS,
  DEMO_PROMO_CODES,
  type BillingInterval,
  type CartLineType,
  getModulePrice,
  getPackagePrice,
  getUserTierSurcharge,
  MODULE_PRICES,
  resolvePackageModules,
  type PackageKey,
  type PromoCode,
} from './pricingCatalog';

export type CartLineItem = {
  label: string;
  amount: number;
  type: CartLineType;
  productKey?: ProductKey;
  packageKey?: PackageKey;
};

export type CartPreview = {
  lineItems: CartLineItem[];
  subtotalMonthly: number;
  discountMonthly: number;
  userTierSurchargeMonthly: number;
  totalMonthly: number;
  totalAnnual: number;
  effectiveMonthlyWithInterval: number;
  billingInterval: BillingInterval;
  promoCode: PromoCode | null;
  matchedPackageKey: PackageKey | null;
  billableModuleCount: number;
  includedModuleCount: number;
};

export type CartOptions = {
  billingInterval?: BillingInterval;
  promoCode?: string | null;
  userCount?: number;
  addOnKeys?: Array<'ti_ready'>;
  packageKey?: PackageKey | null;
};

const ANNUAL_MONTHS_PAID = 10;

export function applyPromoCode(
  code: string | null | undefined,
  subtotal: number,
): { discount: number; promo: PromoCode | null } {
  if (!code?.trim()) return { discount: 0, promo: null };
  const normalized = code.trim().toUpperCase();
  const promo = DEMO_PROMO_CODES.find((entry) => entry.code.toUpperCase() === normalized && entry.active);
  if (!promo) return { discount: 0, promo: null };
  const discount = Math.round((subtotal * promo.discountPercent) / 100);
  return { discount, promo };
}

export function applyBillingInterval(subtotal: number, interval: BillingInterval): number {
  if (interval === 'annual') {
    return Math.round(subtotal * ANNUAL_MONTHS_PAID);
  }
  return subtotal;
}

function pushIncludedOffice(items: CartLineItem[]): void {
  if (items.some((item) => item.productKey === OFFICE_MODULE_KEY)) return;
  items.push({
    label: PRODUCT_LABELS.office,
    amount: 0,
    type: 'included',
    productKey: OFFICE_MODULE_KEY,
  });
}

function buildManualLineItems(selectedModules: ProductKey[]): CartLineItem[] {
  const items: CartLineItem[] = [];
  const specialtyKeys = selectedModules.filter((key) => isSpecialtyModuleKey(key));
  const hasSpecialty = specialtyKeys.length > 0;

  if (!hasSpecialty && selectedModules.includes(OFFICE_MODULE_KEY)) {
    items.push({
      label: PRODUCT_LABELS.office,
      amount: getModulePrice('office'),
      type: 'billable',
      productKey: 'office',
    });
    return items;
  }

  for (const key of specialtyKeys) {
    items.push({
      label: PRODUCT_LABELS[key],
      amount: getModulePrice(key),
      type: 'billable',
      productKey: key,
    });
  }

  if (hasSpecialty) {
    pushIncludedOffice(items);
  }

  return items;
}

function buildPackageLineItems(packageKey: PackageKey): CartLineItem[] {
  const pkgPrice = getPackagePrice(packageKey);
  const items: CartLineItem[] = [];
  const moduleKeys = resolvePackageModules(packageKey);

  if (packageKey === 'office_solo') {
    items.push({
      label: PRODUCT_LABELS.office,
      amount: pkgPrice ?? 0,
      type: 'billable',
      productKey: 'office',
      packageKey,
    });
    return items;
  }

  if (packageKey === 'assist') {
    items.push({
      label: PRODUCT_LABELS.assist,
      amount: pkgPrice ?? 0,
      type: 'billable',
      productKey: 'assist',
      packageKey,
    });
    pushIncludedOffice(items);
    return items;
  }

  if (pkgPrice != null) {
    items.push({
      label: moduleKeys.length > 2 ? `${getPackageLabel(packageKey)}` : PRODUCT_LABELS[moduleKeys.find(isSpecialtyModuleKey)!],
      amount: pkgPrice,
      type: 'billable',
      packageKey,
    });
  }

  pushIncludedOffice(items);
  for (const key of moduleKeys) {
    if (key === OFFICE_MODULE_KEY || key === 'assist' && packageKey === 'pflege_pro') {
      if (key === 'assist') {
        items.push({
          label: PRODUCT_LABELS.assist,
          amount: 0,
          type: 'included',
          productKey: 'assist',
        });
      }
      continue;
    }
    if (key !== 'pflege' && packageKey === 'management') {
      items.push({
        label: PRODUCT_LABELS[key],
        amount: 0,
        type: 'included',
        productKey: key,
      });
    }
  }

  return items;
}

function getPackageLabel(packageKey: PackageKey): string {
  const labels: Record<PackageKey, string> = {
    office_solo: 'Office Solo',
    assist: 'Assist',
    pflege_pro: 'Pflege Pro',
    management: 'Management',
    enterprise: 'Enterprise',
  };
  return labels[packageKey];
}

/** Warenkorb-Summe für ausgewählte Module — Office wird bei Fachmodulen nicht doppelt berechnet. */
export function calculateCartTotal(
  selectedModules: ProductKey[],
  options: CartOptions = {},
): CartPreview {
  const billingInterval = options.billingInterval ?? 'monthly';
  const userCount = options.userCount ?? 5;
  const addOnKeys = options.addOnKeys ?? [];

  const matchedPackageKey: PackageKey | null = options.packageKey ?? null;
  const lineItems: CartLineItem[] = matchedPackageKey
    ? buildPackageLineItems(matchedPackageKey)
    : buildManualLineItems(selectedModules);

  for (const addOnKey of addOnKeys) {
    const addOn = ADD_ONS.find((entry) => entry.key === addOnKey);
    if (!addOn) continue;
    lineItems.push({
      label: addOn.label,
      amount: addOn.monthlyNetEur,
      type: 'addon',
    });
  }

  const userTier = getUserTierSurcharge(userCount);
  if (userTier.monthlyNetEur > 0) {
    lineItems.push({
      label: userTier.label,
      amount: userTier.monthlyNetEur,
      type: 'addon',
    });
  }

  const subtotalMonthly = lineItems
    .filter((item) => item.type === 'billable' || item.type === 'addon')
    .reduce((sum, item) => sum + item.amount, 0);

  const { discount: discountMonthly, promo: promoCode } = applyPromoCode(options.promoCode, subtotalMonthly);
  if (discountMonthly > 0 && promoCode) {
    lineItems.push({
      label: `${promoCode.label} (${promoCode.code})`,
      amount: -discountMonthly,
      type: 'discount',
    });
  }

  const userTierSurchargeMonthly = userTier.monthlyNetEur;
  const totalMonthly = Math.max(0, subtotalMonthly - discountMonthly);
  const totalAnnual = applyBillingInterval(totalMonthly, 'annual');
  const effectiveMonthlyWithInterval =
    billingInterval === 'annual' ? Math.round(totalAnnual / 12) : totalMonthly;

  const billableModuleCount = lineItems.filter((item) => item.type === 'billable').length;
  const includedModuleCount = lineItems.filter((item) => item.type === 'included').length;

  return {
    lineItems,
    subtotalMonthly,
    discountMonthly,
    userTierSurchargeMonthly,
    totalMonthly,
    totalAnnual,
    effectiveMonthlyWithInterval,
    billingInterval,
    promoCode,
    matchedPackageKey,
    billableModuleCount,
    includedModuleCount,
  };
}

/** Abrechnungspositionen für aktiven Mandanten inkl. Preisen. */
export function calculateTenantCartPreview(tenantId: string, options: CartOptions = {}): CartPreview {
  const modules = getTenantModules(tenantId).filter((module) => module.isActive);
  const selectedModules = modules.map((module) => module.productKey);
  return calculateCartTotal(selectedModules, options);
}

/** Erweitert moduleEntitlementService — stellt sicher, dass included_base nie billable ist. */
export function calculateBillingItemsWithPrices(tenantId: string, options: CartOptions = {}) {
  const modules = getTenantModules(tenantId).filter((module) => module.isActive);
  const accessItems = modules.map((module) => ({
    productKey: module.productKey,
    label: PRODUCT_LABELS[module.productKey],
    billingStatus: module.billingStatus,
    accessSource: module.accessSource,
    isIncluded: module.billingStatus === 'included' || module.accessSource === 'included_base',
    isBillable: module.billingStatus === 'billable',
    monthlyPrice:
      module.billingStatus === 'billable' ? getModulePrice(module.productKey) : 0,
  }));

  const cart = calculateTenantCartPreview(tenantId, options);

  return {
    accessItems,
    cart,
    billableCount: accessItems.filter((item) => item.isBillable).length,
    includedCount: accessItems.filter((item) => item.isIncluded).length,
    totalActiveCount: accessItems.length,
  };
}

export { MODULE_PRICES, ANNUAL_MONTHS_PAID };
