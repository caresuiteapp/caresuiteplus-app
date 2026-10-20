import type {
  GobdAuditEvent,
  GobdAuditEventType,
  InvoiceAccountingStatusKey,
} from '@/types/accounting';

export type GobdEditAction = 'direct_edit' | 'status_change' | 'line_item_change' | 'amount_change';

export type GobdCorrectionType = 'storno' | 'korrektur';

export type GobdGuardResult =
  | { allowed: true }
  | { allowed: false; code: 'gobd_archived' | 'invalid_correction'; message: string };

const ARCHIVED_STATUS: InvoiceAccountingStatusKey = 'gobd_archiviert';

const CORRECTION_STATUSES: InvoiceAccountingStatusKey[] = ['storniert', 'korrigiert'];

export function isInvoiceGobdArchived(accountingStatus: InvoiceAccountingStatusKey): boolean {
  return accountingStatus === ARCHIVED_STATUS;
}

export function canDirectlyEditInvoice(accountingStatus: InvoiceAccountingStatusKey): boolean {
  return !isInvoiceGobdArchived(accountingStatus);
}

export function assertInvoiceEditable(
  accountingStatus: InvoiceAccountingStatusKey,
  action: GobdEditAction,
): GobdGuardResult {
  if (isInvoiceGobdArchived(accountingStatus)) {
    return {
      allowed: false,
      code: 'gobd_archived',
      message:
        action === 'direct_edit'
          ? 'GoBD-archivierte Rechnung — keine direkten Änderungen. Korrektur nur über Storno/Korrekturbeleg.'
          : 'GoBD-archivierte Rechnung — Änderung blockiert. Korrektur nur über Storno/Korrekturbeleg.',
    };
  }
  return { allowed: true };
}

export function canApplyCorrection(
  accountingStatus: InvoiceAccountingStatusKey,
  correctionType: GobdCorrectionType,
): GobdGuardResult {
  if (correctionType === 'storno' || correctionType === 'korrektur') {
    if (isInvoiceGobdArchived(accountingStatus)) {
      return { allowed: true };
    }
    if ((CORRECTION_STATUSES as readonly string[]).includes(accountingStatus)) {
      return {
        allowed: false,
        code: 'invalid_correction',
        message: 'Korrektur bereits eingeleitet — kein doppelter Korrekturbeleg.',
      };
    }
    return { allowed: true };
  }
  return {
    allowed: false,
    code: 'invalid_correction',
    message: 'Unbekannter Korrekturtyp.',
  };
}

export function mapCorrectionToAccountingStatus(
  correctionType: GobdCorrectionType,
): InvoiceAccountingStatusKey {
  return correctionType === 'storno' ? 'storniert' : 'korrigiert';
}

export function buildGobdAuditEvent(input: {
  id: string;
  tenantId: string;
  invoiceId: string;
  eventType: GobdAuditEventType;
  summary: string;
  createdAt?: string;
}): GobdAuditEvent {
  return {
    id: input.id,
    tenantId: input.tenantId,
    invoiceId: input.invoiceId,
    eventType: input.eventType,
    summary: input.summary,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export const GOBD_NOTICE_TEXT =
  'GoBD: Archivierte Belege sind unveränderlich. Korrekturen erfolgen ausschließlich über Storno- oder Korrekturbelege mit vollständigem Audit-Trail.';
