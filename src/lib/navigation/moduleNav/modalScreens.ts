import type { ComponentType } from 'react';
import type { ModalStackPayload } from '@/types/modalNavigation';
import { AccessManagementDashboardScreen } from '@/screens/office/access';
import { AssistSettingsScreen } from '@/screens/assist/AssistSettingsScreen';
import { ClientRecordModalPrepScreen } from '@/screens/office/ClientRecordModalPrepScreen';
import { ClientEditModalScreen } from '@/components/office/ClientEditModal';
import { ClientServiceProfileAddModalScreen } from '@/components/office/ClientServiceProfilesPanel';
import { EmployeeRecordModalPrepScreen } from '@/screens/office/EmployeeRecordModalPrepScreen';
import { PortalApprovalModalPrepScreen } from '@/screens/office/PortalApprovalModalPrepScreen';
import {
  DataRequestScreen,
  TenantSettingsScreen,
  UserProfileScreen,
} from '@/screens/settings';

export type ModuleNavModalComponentProps = {
  embeddedInModal?: boolean;
  payload?: ModalStackPayload;
};

export type ModuleNavModalScreen = {
  title: string;
  subtitle?: string;
  maxWidth?: number;
  Component: ComponentType<ModuleNavModalComponentProps>;
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
  'assist.settings': {
    title: 'Assist Einstellungen',
    subtitle: 'Modul-Konfiguration und Verknüpfungen',
    Component: AssistSettingsScreen,
    maxWidth: 720,
  },
  'prep.client.record': {
    title: 'Klient:in',
    subtitle: 'Kurzüberblick — vollständige Akte in Office',
    Component: ClientRecordModalPrepScreen,
    maxWidth: 880,
  },
  'prep.client.edit': {
    title: 'Klient:in bearbeiten',
    subtitle: 'Stammdaten & Leistungsarten',
    Component: ClientEditModalScreen,
    maxWidth: 720,
  },
  'client.serviceProfile.add': {
    title: 'Leistungsbereich hinzufügen',
    Component: ClientServiceProfileAddModalScreen,
    maxWidth: 520,
  },
  'prep.employee.record': {
    title: 'Mitarbeiter:in',
    subtitle: 'Kurzüberblick — vollständige Akte in Office',
    Component: EmployeeRecordModalPrepScreen,
    maxWidth: 880,
  },
  'office.portal.approvals': {
    title: 'Portal-Freigaben',
    subtitle: 'Nachweise, Uploads und Zugangsanfragen',
    Component: PortalApprovalModalPrepScreen,
    maxWidth: 820,
  },
};
