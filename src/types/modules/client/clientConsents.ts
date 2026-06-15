import type { TenantScopedEntity } from '../../core/base';
import type { DataVisibilityScope } from '../../portal/visibility';

export type ConsentType =
  | 'datenschutz'
  | 'portal_zugang'
  | 'portal_angehoerige'
  | 'medizinische_daten'
  | 'tracking'
  | 'foto_video'
  | 'vertrag'
  | 'kommunikation';

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  datenschutz: 'Datenschutzerklärung',
  portal_zugang: 'Portal-Zugang Klient:in',
  portal_angehoerige: 'Portal-Zugang Angehörige',
  medizinische_daten: 'Medizinische Daten',
  tracking: 'Standort-Tracking (Assist)',
  foto_video: 'Foto-/Video-Dokumentation',
  vertrag: 'Pflegevertrag',
  kommunikation: 'Kommunikation per E-Mail/SMS',
};

export type ClientConsentRecord = TenantScopedEntity & {
  clientId: string;
  consentType: ConsentType;
  title: string;
  scope: DataVisibilityScope;
  granted: boolean;
  grantedAt: string | null;
  expiresAt: string | null;
  grantedByProfileId: string | null;
  documentId: string | null;
  notes: string | null;
};
