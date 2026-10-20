import type {
  PlatformBillingInterval,
  PlatformPlanVersion,
  PlatformPricingInput,
  PlatformPricingResult,
  PlatformTenantAddon,
} from '@/types/platformConsole/foundation';

export function resolveEffectivePlanVersion(
  planVersions: PlatformPlanVersion[],
  planKey: string,
  at: Date = new Date(),
): PlatformPlanVersion | null {
  const atMs = at.getTime();
  const candidates = planVersions
    .filter((v) => v.planKey === planKey && v.status === 'active')
    .filter((v) => new Date(v.effectiveFrom).getTime() <= atMs)
    .filter((v) => !v.effectiveUntil || new Date(v.effectiveUntil).getTime() > atMs)
    .sort((a, b) => b.versionNumber - a.versionNumber);
  return candidates[0] ?? null;
}

function addonPriceCents(addon: PlatformTenantAddon, interval: PlatformBillingInterval): number {
  if (addon.status !== 'active') return 0;
  if (addon.priceOverrideCents != null) return addon.priceOverrideCents;
  return interval === 'yearly' ? addon.yearlyPriceCents : addon.monthlyPriceCents;
}

function planPriceCents(
  version: PlatformPlanVersion | null,
  interval: PlatformBillingInterval,
  overrides: Pick<PlatformPricingInput, 'priceOverrideMonthlyCents' | 'priceOverrideYearlyCents'>,
): number {
  if (!version) return 0;
  if (interval === 'yearly') {
    return overrides.priceOverrideYearlyCents ?? version.yearlyPriceCents;
  }
  return overrides.priceOverrideMonthlyCents ?? version.monthlyPriceCents;
}

export function calculatePlatformPricing(input: PlatformPricingInput): PlatformPricingResult {
  const at = input.at ? new Date(input.at) : new Date();
  const planVersion = resolveEffectivePlanVersion(input.planVersions, input.planKey, at);
  const planPrice = planPriceCents(planVersion, input.billingInterval, input);
  const addons = input.addons ?? [];
  const addonTotal = addons.reduce(
    (sum, addon) => sum + addonPriceCents(addon, input.billingInterval),
    0,
  );

  return {
    planVersion,
    planPriceCents: planPrice,
    addonTotalCents: addonTotal,
    subtotalCents: planPrice + addonTotal,
    currency: planVersion?.currency ?? 'EUR',
  };
}

export function nextPlanVersionNumber(planVersions: PlatformPlanVersion[], planKey: string): number {
  const max = planVersions
    .filter((v) => v.planKey === planKey)
    .reduce((acc, v) => Math.max(acc, v.versionNumber), 0);
  return max + 1;
}
