import type { TenantScopedEntity } from '../../core/base';
import type { PortalScopedEntity, SensitivityLevel } from '../../portal/visibility';

/** Fachlicher Klient:innen-Status (Stammdaten) */
export type ClientLifecycleStatus =
  | 'aktiv'
  | 'pausiert'
  | 'archiviert'
  | 'verstorben'
  | 'interessent';

export const CLIENT_LIFECYCLE_STATUS_LABELS: Record<ClientLifecycleStatus, string> = {
  aktiv: 'Aktiv',
  pausiert: 'Pausiert',
  archiviert: 'Archiviert',
  verstorben: 'Verstorben',
  interessent: 'Interessent:in',
};

export type ClientGender = 'weiblich' | 'männlich' | 'divers' | 'keine_angabe';

export const CLIENT_GENDER_LABELS: Record<ClientGender, string> = {
  weiblich: 'Weiblich',
  männlich: 'Männlich',
  divers: 'Divers',
  keine_angabe: 'Keine Angabe',
};

/** Kern-Stammdaten einer Klient:in */
export type ClientCore = TenantScopedEntity &
  PortalScopedEntity & {
    firstName: string;
    lastName: string;
    salutation: string | null;
    gender: ClientGender | null;
    dateOfBirth: string | null;
    lifecycleStatus: ClientLifecycleStatus;
    /** Versichertennummer — sensibel */
    insuranceNumber: string | null;
    /** Schlüsseltresor-Code — sensibel */
    keySafeCode: string | null;
    /** Diagnosen — sensibel */
    diagnoses: string[];
    primaryContactPhone: string | null;
    city: string | null;
    zip: string | null;
    sensitivity: SensitivityLevel;
  };

export const SENSITIVE_CLIENT_CORE_FIELDS = [
  'insuranceNumber',
  'keySafeCode',
  'diagnoses',
] as const;
