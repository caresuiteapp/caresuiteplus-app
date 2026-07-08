import type { PlatformCapability, PlatformRoleKey } from '@/types/platformConsole';

const ROLE_CAPABILITIES: Record<PlatformRoleKey, PlatformCapability[] | 'all'> = {
  platform_owner: 'all',
  platform_admin: [
    'tenants.read',
    'tenants.write',
    'tenants.suspend',
    'modules.read',
    'modules.write',
    'plans.read',
    'plans.write',
    'discounts.read',
    'billing.read',
    'payments.read',
    'flags.read',
    'support.read',
    'support.write',
    'audit.read',
    'system.read',
    'releases.read',
    'users.read',
  ],
  platform_billing: [
    'tenants.read',
    'plans.read',
    'plans.write',
    'discounts.read',
    'discounts.write',
    'billing.read',
    'billing.write',
    'payments.read',
    'payments.write',
    'audit.read',
  ],
  platform_support: [
    'tenants.read',
    'modules.read',
    'support.read',
    'support.write',
    'audit.read',
  ],
  platform_developer: [
    'tenants.read',
    'modules.read',
    'flags.read',
    'flags.write',
    'audit.read',
    'system.read',
    'releases.read',
  ],
  platform_readonly: [
    'tenants.read',
    'modules.read',
    'plans.read',
    'discounts.read',
    'billing.read',
    'payments.read',
    'flags.read',
    'support.read',
    'audit.read',
    'system.read',
    'releases.read',
    'users.read',
  ],
};

export function platformRoleHasCapability(
  role: PlatformRoleKey | null | undefined,
  capability: PlatformCapability,
): boolean {
  if (!role) return false;
  const caps = ROLE_CAPABILITIES[role];
  if (caps === 'all') return true;
  return caps.includes(capability);
}

export function platformRoleCanWrite(role: PlatformRoleKey | null | undefined): boolean {
  return platformRoleHasCapability(role, 'tenants.write')
    || platformRoleHasCapability(role, 'modules.write')
    || platformRoleHasCapability(role, 'billing.write')
    || platformRoleHasCapability(role, 'system.write');
}

export const PLATFORM_ROLE_LABELS: Record<PlatformRoleKey, string> = {
  platform_owner: 'Platform Owner',
  platform_admin: 'Platform Admin',
  platform_billing: 'Platform Billing',
  platform_support: 'Platform Support',
  platform_developer: 'Platform Developer',
  platform_readonly: 'Platform Readonly',
};

export const CRITICAL_ACTIONS_REQUIRING_REASON = [
  'tenant.suspend',
  'tenant.unsuspend',
  'tenant.terminate',
  'module.disable',
  'payment.manual',
  'invoice.paid',
  'discount.remove',
  'plan.price_override',
  'support.write_access',
  'feature_flag.global',
  'maintenance.enable',
] as const;

export function validatePlatformReason(reason: string | null | undefined): string | null {
  const trimmed = reason?.trim() ?? '';
  if (trimmed.length < 5) {
    return 'Bitte geben Sie einen aussagekräftigen Grund an (mindestens 5 Zeichen).';
  }
  return null;
}
