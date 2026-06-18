import type { ComponentType } from 'react';
import { AccessManagementDashboardScreen } from '@/screens/office/access';
import {
  DataRequestScreen,
  TenantSettingsScreen,
  UserProfileScreen,
} from '@/screens/settings';

export type ModuleNavModalScreen = {
  title: string;
  subtitle?: string;
  maxWidth?: number;
  Component: ComponentType<{ embeddedInModal?: boolean }>;
};

/** Registry for module-nav items opened as PlatformModal overlays on web/desktop. */
export const MODULE_NAV_MODAL_SCREENS: Record<string, ModuleNavModalScreen> = {
  'settings.profile': {
    title: 'Profil & Konto',
    Component: UserProfileScreen,
    maxWidth: 640,
  },
  'settings.tenant': {
    title: 'Mandant & Unternehmensdaten',
    Component: TenantSettingsScreen,
    maxWidth: 800,
  },
  'settings.data-request': {
    title: 'Betroffenenrechte',
    Component: DataRequestScreen,
    maxWidth: 720,
  },
  'office.access': {
    title: 'Zugänge & Benutzer',
    subtitle: 'Benutzer, Rollen und Portale',
    Component: AccessManagementDashboardScreen,
    maxWidth: 920,
  },
};
