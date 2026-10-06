/** Current product policy. Premium is not available and has no booking flow. */
export const PLATFORM_FREE_USAGE = 'CareSuite HealthOS ist vollständig kostenlos nutzbar.';
export const PLATFORM_FUTURE_PREMIUM = 'Eine Premium-Version ist für später vorgesehen und derzeit nicht verfügbar.';
export const PLATFORM_FREE_POLICY_VERSION = 'caresuite-platform-free-only-20261006';

const RETIRED_SECTIONS = new Set(['plans', 'addons', 'discounts', 'billing', 'payments']);
const RETIRED_CAPABILITIES = new Set([
  'plans.read', 'plans.write', 'discounts.read', 'discounts.write',
  'billing.read', 'billing.write', 'payments.read', 'payments.write',
]);

export function isRetiredPlatformSection(section: string): boolean {
  return RETIRED_SECTIONS.has(section);
}

export function isRetiredPlatformCapability(capability: string): boolean {
  return RETIRED_CAPABILITIES.has(capability);
}
