import type { PlatformNavItem } from '@/types/platformConsole';

export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  { path: '/platform/dashboard', label: 'Übersicht', icon: '◈', group: 'overview' },
  { path: '/platform/tenants', label: 'Mandanten', icon: '▣', group: 'customers', capability: 'tenants.read' },
  { path: '/platform/plans', label: 'Tarife & Verträge', icon: '▤', group: 'customers', capability: 'plans.read' },
  { path: '/platform/discounts', label: 'Rabatte', icon: '◷', group: 'customers', capability: 'discounts.read' },
  { path: '/platform/addons', label: 'Erweiterungen', icon: '⊕', group: 'product', capability: 'plans.read' },
  { path: '/platform/feature-flags', label: 'Funktionsfreigaben', icon: '⚑', group: 'product', capability: 'flags.read' },
  { path: '/platform/billing', label: 'Rechnungen', icon: '€', group: 'finance', capability: 'billing.read' },
  { path: '/platform/payments', label: 'Zahlungen', icon: '↳', group: 'finance', capability: 'payments.read' },
  { path: '/platform/support', label: 'Support', icon: '◎', group: 'operations', capability: 'support.read' },
  { path: '/platform/users', label: 'Benutzer & Rollen', icon: '♙', group: 'operations', capability: 'users.read' },
  { path: '/platform/audit', label: 'Änderungsprotokoll', icon: '☰', group: 'operations', capability: 'audit.read' },
  { path: '/platform/system', label: 'System', icon: '⚙', group: 'operations', capability: 'system.read' },
  { path: '/platform/releases', label: 'Veröffentlichungen', icon: '⬡', group: 'operations', capability: 'releases.read' },
];

export const PLATFORM_CONSOLE_TITLE = 'CareSuite Plattformverwaltung';
