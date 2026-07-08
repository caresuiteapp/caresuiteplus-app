import type { PlatformNavItem } from '@/types/platformConsole';

export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  { path: '/platform/dashboard', label: 'Dashboard', icon: '◈' },
  { path: '/platform/tenants', label: 'Mandanten', icon: '▣', capability: 'tenants.read' },
  { path: '/platform/modules', label: 'Module', icon: '▦', capability: 'modules.read' },
  { path: '/platform/plans', label: 'Tarife', icon: '▤', capability: 'plans.read' },
  { path: '/platform/addons', label: 'Add-ons', icon: '⊕', capability: 'plans.read' },
  { path: '/platform/discounts', label: 'Rabatte', icon: '◷', capability: 'discounts.read' },
  { path: '/platform/billing', label: 'Billing', icon: '€', capability: 'billing.read' },
  { path: '/platform/payments', label: 'Zahlungen', icon: '↳', capability: 'payments.read' },
  { path: '/platform/feature-flags', label: 'Feature Flags', icon: '⚑', capability: 'flags.read' },
  { path: '/platform/support', label: 'Support', icon: '◎', capability: 'support.read' },
  { path: '/platform/audit', label: 'Audit', icon: '☰', capability: 'audit.read' },
  { path: '/platform/system', label: 'System', icon: '⚙', capability: 'system.read' },
  { path: '/platform/releases', label: 'Releases', icon: '⬡', capability: 'releases.read' },
];

export const PLATFORM_CONSOLE_TITLE = 'CareSuite+ Platform Console';
