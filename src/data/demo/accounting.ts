import type {
  AccountingExportRecord,
  AccountingProviderConfig,
  AccountingProviderKey,
  GobdAuditEvent,
  InvoiceAccountingStatus,
  InvoiceAccountingStatusKey,
} from '@/types/accounting';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

type DemoAccountingStore = {
  statuses: Record<string, InvoiceAccountingStatus>;
  exports: AccountingExportRecord[];
  gobdEvents: Record<string, GobdAuditEvent[]>;
  providerConfigs: AccountingProviderConfig[];
};

const INITIAL_STATUSES: Record<string, InvoiceAccountingStatus> = {
  'inv-001': {
    invoiceId: 'inv-001',
    tenantId: DEMO_TENANT_ID,
    accountingStatus: 'versendet',
    providerKey: 'datev',
    archiveVersion: 0,
    archivedAt: null,
    lastExportId: null,
    updatedAt: '2026-05-02T10:30:00.000Z',
  },
  'inv-002': {
    invoiceId: 'inv-002',
    tenantId: DEMO_TENANT_ID,
    accountingStatus: 'export_bereit',
    providerKey: 'lexware_office',
    archiveVersion: 0,
    archivedAt: null,
    lastExportId: null,
    updatedAt: '2026-05-05T08:00:00.000Z',
  },
  'inv-003': {
    invoiceId: 'inv-003',
    tenantId: DEMO_TENANT_ID,
    accountingStatus: 'export_fehler',
    providerKey: 'sevdesk',
    archiveVersion: 0,
    archivedAt: null,
    lastExportId: 'exp-demo-003',
    updatedAt: '2026-06-01T09:00:00.000Z',
  },
};

const INITIAL_EXPORTS: AccountingExportRecord[] = [
  {
    id: 'exp-demo-003',
    tenantId: DEMO_TENANT_ID,
    providerKey: 'sevdesk',
    exportType: 'invoice',
    exportFormat: 'sevdesk',
    status: 'failed',
    externalTransfer: false,
    itemCount: 1,
    errorSummary: 'Connector nicht konfiguriert — kein externer Transfer.',
    packageLabel: null,
    createdAt: '2026-06-01T09:00:00.000Z',
    finishedAt: '2026-06-01T09:00:05.000Z',
  },
];

const INITIAL_GOBD: Record<string, GobdAuditEvent[]> = {
  'inv-003': [
    {
      id: 'gobd-003-1',
      tenantId: DEMO_TENANT_ID,
      invoiceId: 'inv-003',
      eventType: 'export_failed',
      summary: 'sevDesk-Export blockiert — Anbieter nicht produktiv konfiguriert.',
      createdAt: '2026-06-01T09:00:05.000Z',
    },
  ],
};

let store: DemoAccountingStore = {
  statuses: { ...INITIAL_STATUSES },
  exports: [...INITIAL_EXPORTS],
  gobdEvents: { ...INITIAL_GOBD },
  providerConfigs: [],
};

export function resetDemoAccountingStore(): void {
  store = {
    statuses: { ...INITIAL_STATUSES },
    exports: [...INITIAL_EXPORTS],
    gobdEvents: { ...INITIAL_GOBD },
    providerConfigs: [],
  };
}

export function getDemoInvoiceAccountingStatus(invoiceId: string): InvoiceAccountingStatus {
  return (
    store.statuses[invoiceId] ?? {
      invoiceId,
      tenantId: DEMO_TENANT_ID,
      accountingStatus: 'erstellt',
      providerKey: null,
      archiveVersion: 0,
      archivedAt: null,
      lastExportId: null,
      updatedAt: new Date().toISOString(),
    }
  );
}

export function setDemoInvoiceAccountingStatus(
  invoiceId: string,
  patch: Partial<Pick<InvoiceAccountingStatus, 'accountingStatus' | 'providerKey' | 'lastExportId' | 'archiveVersion' | 'archivedAt'>>,
): InvoiceAccountingStatus {
  const current = getDemoInvoiceAccountingStatus(invoiceId);
  const next: InvoiceAccountingStatus = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.statuses[invoiceId] = next;
  return next;
}

export function appendDemoAccountingExport(exportRecord: AccountingExportRecord): void {
  store.exports.unshift(exportRecord);
}

export function getDemoAccountingExportsForInvoice(invoiceId: string): AccountingExportRecord[] {
  const status = store.statuses[invoiceId];
  if (!status?.lastExportId) {
    return store.exports.filter((e) => e.itemCount > 0);
  }
  return store.exports;
}

export function getDemoAccountingExportErrors(): AccountingExportRecord[] {
  return store.exports.filter((e) => e.status === 'failed' || e.status === 'blocked');
}

export function appendDemoGobdEvent(invoiceId: string, event: GobdAuditEvent): void {
  const list = store.gobdEvents[invoiceId] ?? [];
  store.gobdEvents[invoiceId] = [event, ...list];
}

export function getDemoGobdEvents(invoiceId: string): GobdAuditEvent[] {
  return store.gobdEvents[invoiceId] ?? [];
}

export function getDemoAccountingProviderConfigs(): AccountingProviderConfig[] {
  return store.providerConfigs.map((c) => ({ ...c }));
}

export function upsertDemoAccountingProviderConfig(
  providerKey: AccountingProviderKey,
  patch: Partial<AccountingProviderConfig>,
): AccountingProviderConfig {
  const existing = store.providerConfigs.find((c) => c.providerKey === providerKey);
  if (existing) {
    Object.assign(existing, patch, { updatedAt: new Date().toISOString() });
    return { ...existing };
  }
  const created: AccountingProviderConfig = {
    id: `cfg-${providerKey}`,
    tenantId: DEMO_TENANT_ID,
    providerKey,
    configStatus: 'not_configured',
    environment: null,
    hasCredentialReference: false,
    configuredAt: null,
    notes: null,
    ...patch,
  };
  store.providerConfigs.push(created);
  return { ...created };
}

export function isDemoAccountingStatus(key: string): key is InvoiceAccountingStatusKey {
  return [
    'erstellt', 'versendet', 'bezahlt', 'ueberfaellig', 'gemahnt', 'storniert',
    'korrigiert', 'export_bereit', 'exportiert', 'export_fehler',
    'steuerberater_uebergeben', 'gobd_archiviert',
  ].includes(key);
}
