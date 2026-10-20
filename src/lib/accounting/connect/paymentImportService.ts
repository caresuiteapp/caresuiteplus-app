import type { ServiceResult } from '@/types';
import type { BankTransaction, BankTransactionImport } from '@/types/connect/accounting';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { appendAccountingConnectAudit } from './accountingExportService';
import {
  listBankImports,
  saveBankImport,
  saveBankTransactions,
} from './accountingConnectStore';

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type PreparePaymentImportInput = {
  tenantId: string;
  fileName: string;
  csvContent: string;
  importedBy?: string | null;
};

type ParsedCsvRow = {
  bookingDate: string;
  amountCents: number;
  counterparty: string | null;
  referenceText: string | null;
};

function parseCsvRows(csvContent: string): ServiceResult<ParsedCsvRow[]> {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { ok: false, error: 'CSV erfordert Kopfzeile und mindestens eine Buchungszeile.' };
  }

  const header = lines[0].toLowerCase();
  if (!header.includes('datum') || !header.includes('betrag')) {
    return {
      ok: false,
      error: 'CSV-Format unvollständig — erwartet Spalten: datum, betrag, optional gegenkonto, verwendungszweck.',
    };
  }

  const rows: ParsedCsvRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(';').map((part) => part.trim());
    if (parts.length < 2) continue;

    const amountRaw = parts[1].replace(',', '.');
    const amount = Number.parseFloat(amountRaw);
    if (Number.isNaN(amount)) {
      return { ok: false, error: `Ungültiger Betrag in Zeile ${i + 1}.` };
    }

    rows.push({
      bookingDate: parts[0],
      amountCents: Math.round(amount * 100),
      counterparty: parts[2] ?? null,
      referenceText: parts[3] ?? null,
    });
  }

  if (rows.length === 0) {
    return { ok: false, error: 'Keine gültigen Buchungszeilen im CSV gefunden.' };
  }

  return { ok: true, data: rows };
}

export function preparePaymentImportCsv(
  input: PreparePaymentImportInput,
): ServiceResult<{ importRecord: BankTransactionImport; transactions: BankTransaction[] }> {
  const liveBlock = guardLiveDemoFeature<{
    importRecord: BankTransactionImport;
    transactions: BankTransaction[];
  }>(input.tenantId, 'Zahlungsimport');
  if (liveBlock) return liveBlock;

  const parsed = parseCsvRows(input.csvContent);
  if (!parsed.ok) {
    appendAccountingConnectAudit(input.tenantId, 'payment_import_blocked', parsed.error, {});
    appendAccountingConnectAudit(input.tenantId, 'error_logged', parsed.error, {});
    return parsed;
  }

  const now = new Date().toISOString();
  const importId = newId('bank-import');
  const importRecord: BankTransactionImport = {
    id: importId,
    tenantId: input.tenantId,
    fileName: input.fileName,
    importFormat: 'csv',
    status: 'prepared',
    rowCount: parsed.data.length,
    errorSummary: null,
    importedBy: input.importedBy ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const transactions: BankTransaction[] = parsed.data.map((row, index) => ({
    id: `${importId}-tx-${index + 1}`,
    tenantId: input.tenantId,
    importId,
    bookingDate: row.bookingDate,
    amountCents: row.amountCents,
    counterparty: row.counterparty,
    referenceText: row.referenceText,
    matchStatus: 'unmatched',
    createdAt: now,
    updatedAt: now,
  }));

  saveBankImport(input.tenantId, importRecord);
  saveBankTransactions(input.tenantId, transactions);
  appendAccountingConnectAudit(
    input.tenantId,
    'payment_import_prepared',
    `Zahlungsimport CSV vorbereitet (${parsed.data.length} Zeilen) — kein automatischer Zahlungsstatus.`,
    { importId },
  );

  return { ok: true, data: { importRecord, transactions } };
}

export function listTenantBankImports(tenantId: string): BankTransactionImport[] {
  return listBankImports(tenantId);
}

export const PAYMENT_IMPORT_CSV_TEMPLATE =
  'datum;betrag;gegenkonto;verwendungszweck\n2026-06-01;150,00;Muster GmbH;RE-2026-001';
