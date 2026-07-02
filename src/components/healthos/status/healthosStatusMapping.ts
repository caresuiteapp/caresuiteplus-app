/**
 * HealthOS — central UI status / language mapping (H1).
 * Display-only helpers; no persistence or workflow side effects.
 */
import type { AssistExecutionProblemCode } from '@/lib/assist/assistExecutionProblemInboxService';
import {
  ASSIGNMENT_STATUS_LABELS,
  type AssignmentStatus,
} from '@/types/modules/assignmentStatus';
import { LIFECYCLE_STATUS_LABELS, type DocumentLifecycleStatus } from '@/types/documents/documentLifecycle';
import type { HealthOSBadgeTone } from '../tokens/healthosTokens';

export type HealthOSStatusDomain =
  | 'assignment'
  | 'budget'
  | 'wfm'
  | 'document'
  | 'blocker';

export type HealthOSSeverity = 'info' | 'success' | 'warning' | 'error';

export type HealthOSResolvedStatus = {
  label: string;
  tone: HealthOSBadgeTone;
  severity: HealthOSSeverity;
};

const FALLBACK_LABEL = 'Status unbekannt';

const BUDGET_LIFECYCLE_LABELS: Record<string, string> = {
  geplant: 'Vorschau',
  reserviert: 'Reserviert',
  reservierung: 'Reserviert',
  durchgefuehrt: 'Durchgeführt',
  durchgeführt: 'Durchgeführt',
  freigegeben: 'Freigegeben',
  verbraucht: 'Verbraucht',
  korrigiert: 'Korrigiert',
  blockiert: 'Blockiert',
};

const BUDGET_ACCOUNT_LABELS: Record<string, string> = {
  active: 'Aktiv',
  closed: 'Geschlossen',
  suspended: 'Ausgesetzt',
};

const WFM_SESSION_LABELS: Record<string, string> = {
  offline: 'Nicht gestartet',
  clocked_in: 'Aktiv',
  paused: 'Pause',
  on_visit: 'Im Einsatz',
  driving: 'Unterwegs',
  office: 'Büro',
  homeoffice: 'Home Office',
  standby: 'Bereitschaft',
  training: 'Fortbildung',
  ended: 'Feierabend',
};

const WFM_DISPLAY_LABELS: Record<string, string> = {
  im_einsatz: 'Im Einsatz',
  buero: 'Büro',
  homeoffice: 'Home Office',
  pause: 'Pause',
  unterwegs: 'Unterwegs',
  feierabend: 'Feierabend',
  krank: 'Krank',
  urlaub: 'Urlaub',
  offline: 'Offline',
};

const BLOCKER_LABELS: Record<AssistExecutionProblemCode, string> = {
  ended_missing_documentation: 'Dokumentation fehlt',
  documentation_missing_signature: 'Unterschrift fehlt',
  signature_missing_proof: 'Leistungsnachweis fehlt',
  proof_missing_pdf: 'Nachweis-PDF fehlt',
  proof_missing_client_document: 'Klientendokument fehlt',
  proof_not_portal_visible: 'Portal-Freigabe fehlt',
  budget_reservation_not_executed: 'Budget nicht durchgeführt',
  budget_reservation_failed: 'Budget-Reservierung fehlgeschlagen',
  budget_ledger_missing: 'Budget-Ledger fehlt',
  budget_usage_missing_after_approval: 'Budget-Verbrauch fehlt',
  wfm_sync_missing: 'Zeitkonto-Sync fehlt',
  wfm_sync_failed: 'Zeitkonto-Sync fehlgeschlagen',
  assignment_visit_execution_drift: 'Einsatz-Status abweichend',
};

const ASSIGNMENT_TONE: Record<AssignmentStatus, HealthOSBadgeTone> = {
  geplant: 'muted',
  bestaetigt: 'cyan',
  unterwegs: 'orange',
  angekommen: 'orange',
  gestartet: 'green',
  pausiert: 'orange',
  beendet: 'muted',
  dokumentation_offen: 'orange',
  unterschrift_offen: 'orange',
  abgeschlossen: 'green',
  storniert: 'red',
  nicht_erschienen: 'red',
};

const ASSIGNMENT_SEVERITY: Record<AssignmentStatus, HealthOSSeverity> = {
  geplant: 'info',
  bestaetigt: 'info',
  unterwegs: 'warning',
  angekommen: 'warning',
  gestartet: 'success',
  pausiert: 'warning',
  beendet: 'info',
  dokumentation_offen: 'warning',
  unterschrift_offen: 'warning',
  abgeschlossen: 'success',
  storniert: 'error',
  nicht_erschienen: 'error',
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function isRawTechnicalKey(label: string, technical: string): boolean {
  return label === technical || label === normalizeKey(technical);
}

export function resolveAssignmentStatusDisplay(status: string | null | undefined): HealthOSResolvedStatus {
  const key = normalizeKey(status ?? '');
  if (key in ASSIGNMENT_STATUS_LABELS) {
    const typed = key as AssignmentStatus;
    return {
      label: ASSIGNMENT_STATUS_LABELS[typed],
      tone: ASSIGNMENT_TONE[typed],
      severity: ASSIGNMENT_SEVERITY[typed],
    };
  }
  return { label: FALLBACK_LABEL, tone: 'muted', severity: 'info' };
}

export function resolveBudgetStatusDisplay(status: string | null | undefined): HealthOSResolvedStatus {
  const key = normalizeKey(status ?? '');
  const label =
    BUDGET_LIFECYCLE_LABELS[key] ??
    BUDGET_ACCOUNT_LABELS[key] ??
    (key === 'true' ? 'Gesperrt' : key === 'false' ? 'Aktiv' : null);

  if (!label) {
    return { label: FALLBACK_LABEL, tone: 'muted', severity: 'info' };
  }

  let tone: HealthOSBadgeTone = 'cyan';
  let severity: HealthOSSeverity = 'info';
  if (key === 'durchgefuehrt' || key === 'durchgeführt' || key === 'verbraucht' || key === 'active' || key === 'false') {
    tone = 'green';
    severity = 'success';
  } else if (key === 'blockiert' || key === 'true') {
    tone = 'red';
    severity = 'error';
  } else if (key === 'suspended' || key === 'geplant') {
    tone = 'orange';
    severity = 'warning';
  }

  return { label, tone, severity };
}

export function resolveWfmStatusDisplay(status: string | null | undefined): HealthOSResolvedStatus {
  const key = normalizeKey(status ?? '');
  const label = WFM_DISPLAY_LABELS[key] ?? WFM_SESSION_LABELS[key];
  if (!label) {
    return { label: FALLBACK_LABEL, tone: 'muted', severity: 'info' };
  }

  let tone: HealthOSBadgeTone = 'cyan';
  let severity: HealthOSSeverity = 'info';
  if (['clocked_in', 'on_visit', 'im_einsatz', 'gestartet'].includes(key)) {
    tone = 'green';
    severity = 'success';
  } else if (['paused', 'pause', 'driving', 'unterwegs'].includes(key)) {
    tone = 'orange';
    severity = 'warning';
  } else if (['offline', 'ended', 'feierabend'].includes(key)) {
    tone = 'muted';
    severity = 'info';
  }

  return { label, tone, severity };
}

export function resolveDocumentStatusDisplay(status: string | null | undefined): HealthOSResolvedStatus {
  const key = normalizeKey(status ?? '');
  if (key in LIFECYCLE_STATUS_LABELS) {
    const typed = key as DocumentLifecycleStatus;
    const label = LIFECYCLE_STATUS_LABELS[typed];
    let tone: HealthOSBadgeTone = 'muted';
    let severity: HealthOSSeverity = 'info';
    if (typed === 'finalized' || typed === 'sent') {
      tone = 'green';
      severity = 'success';
    } else if (typed === 'validation_failed' || typed === 'render_failed' || typed === 'cancelled') {
      tone = 'red';
      severity = 'error';
    } else if (typed === 'ready_to_finalize' || typed === 'preview') {
      tone = 'orange';
      severity = 'warning';
    }
    return { label, tone, severity };
  }

  const portalLabels: Record<string, string> = {
    entwurf: 'Entwurf',
    aktiv: 'Aktiv',
    in_bearbeitung: 'In Bearbeitung',
    abgeschlossen: 'Abgeschlossen',
    archiviert: 'Archiviert',
  };
  const label = portalLabels[key];
  if (label) {
    return { label, tone: key === 'abgeschlossen' ? 'green' : 'muted', severity: 'info' };
  }

  return { label: FALLBACK_LABEL, tone: 'muted', severity: 'info' };
}

export function resolveBlockerStatusDisplay(code: string | null | undefined): HealthOSResolvedStatus {
  const key = code as AssistExecutionProblemCode;
  const label = BLOCKER_LABELS[key];
  if (!label) {
    return { label: FALLBACK_LABEL, tone: 'muted', severity: 'warning' };
  }
  const isError =
    key.startsWith('budget_') ||
    key.startsWith('wfm_') ||
    key === 'assignment_visit_execution_drift';
  return {
    label,
    tone: isError ? 'red' : 'orange',
    severity: isError ? 'error' : 'warning',
  };
}

export function resolveHealthOSStatusDisplay(
  domain: HealthOSStatusDomain,
  technicalValue: string | null | undefined,
): HealthOSResolvedStatus {
  switch (domain) {
    case 'assignment':
      return resolveAssignmentStatusDisplay(technicalValue);
    case 'budget':
      return resolveBudgetStatusDisplay(technicalValue);
    case 'wfm':
      return resolveWfmStatusDisplay(technicalValue);
    case 'document':
      return resolveDocumentStatusDisplay(technicalValue);
    case 'blocker':
      return resolveBlockerStatusDisplay(technicalValue);
    default:
      return { label: FALLBACK_LABEL, tone: 'muted', severity: 'info' };
  }
}

/** Ensures UI never shows raw snake_case / enum keys when a mapping exists. */
export function assertHealthOSDisplayLabel(
  domain: HealthOSStatusDomain,
  technicalValue: string,
): void {
  const resolved = resolveHealthOSStatusDisplay(domain, technicalValue);
  if (isRawTechnicalKey(resolved.label, technicalValue)) {
    throw new Error(`HealthOS: raw technical status exposed for ${domain}:${technicalValue}`);
  }
}
