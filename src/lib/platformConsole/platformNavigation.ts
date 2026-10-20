import type { PlatformNavItem } from '@/types/platformConsole';

export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  { path: '/platform/dashboard', label: 'Übersicht', icon: '◈', group: 'overview' },
  { path: '/platform/tenants', label: 'Mandanten', icon: '▣', group: 'customers', capability: 'tenants.read' },
  { path: '/platform/modules', label: 'Funktionsbereiche', icon: '⊕', group: 'product', capability: 'modules.read' },
  { path: '/platform/feature-flags', label: 'Funktionsfreigaben', icon: '⚑', group: 'product', capability: 'flags.read' },
  { path: '/platform/support', label: 'Support', icon: '◎', group: 'operations', capability: 'support.read' },
  { path: '/platform/users', label: 'Benutzer & Rollen', icon: '♙', group: 'operations', capability: 'users.read' },
  { path: '/platform/audit', label: 'Änderungsprotokoll', icon: '☰', group: 'operations', capability: 'audit.read' },
  { path: '/platform/system', label: 'System', icon: '⚙', group: 'operations', capability: 'system.read' },
  { path: '/platform/releases', label: 'Veröffentlichungen', icon: '⬡', group: 'operations', capability: 'releases.read' },
];

export const PLATFORM_CONSOLE_TITLE = 'CareSuite Plattformverwaltung';
