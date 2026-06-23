import type { ClientCareContext, ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { CLIENT_RECORD_TAB_LABELS } from '@/lib/clients/clientIntakeFieldRules';
import { formatClientAddressLine } from '@/lib/clients/clientAddressResolver';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { formatDate, formatDateTime } from '@/lib/formatters/dateTimeFormatters';
import { BILLING_TYPE_LABELS } from '@/types/modules/client/clientBilling';
import type { ClientFullDetail } from '@/types/modules/client';

export type ClientRecordSignedDocument = {
  id: string;
  title: string;
  signedAt: string;
  kind: 'consent' | 'contract' | 'document';
};

export type ClientRecordQuickLink = {
  tab: ClientRecordTabKey;
  label: string;
};

export type ClientRecordOverview = {
  fullName: string;
  dateOfBirth: string;
  address: string;
  phone: string;
  primaryCostBearer: string;
  careLevel: string;
  serviceTypes: string;
  lastActivity: string;
  admissionDate: string;
  nextAppointment: string;
  openItemsSummary: string;
  signedDocuments: ClientRecordSignedDocument[];
  quickLinks: ClientRecordQuickLink[];
};

const EMPTY = '—';

function display(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : EMPTY;
}

function buildAddress(detail: ClientFullDetail): string {
  const primary = detail.addresses.find((a) => a.isPrimary) ?? detail.addresses[0];
  if (primary) {
    const fromAddress = formatClientAddressLine(primary.street, primary.zip, primary.city);
    if (fromAddress) return fromAddress;
  }
  const fromClient = formatClientAddressLine(detail.street, detail.zip, detail.city);
  return fromClient || EMPTY;
}

function resolveCostBearer(detail: ClientFullDetail): string {
  const fromProfile = detail.billingProfile?.costBearerName?.trim();
  if (fromProfile) return fromProfile;

  const fromCarrier = detail.costCarrier?.trim();
  if (fromCarrier) return fromCarrier;

  const billingType = detail.billingProfile?.billingType;
  if (billingType) return BILLING_TYPE_LABELS[billingType];

  return EMPTY;
}

function resolveLastActivity(detail: ClientFullDetail): string {
  const timelineLatest = detail.timeline?.[0]?.timestamp;
  if (timelineLatest) return formatDateTime(timelineLatest);

  const historyLatest = detail.history?.[0]?.timestamp;
  if (historyLatest) return formatDateTime(historyLatest);

  if (detail.updatedAt) return formatDateTime(detail.updatedAt);
  return EMPTY;
}

function resolveNextAppointment(detail: ClientFullDetail): string {
  if (detail.nextActionHint?.trim()) return detail.nextActionHint.trim();
  if (detail.contextCounts.appointments > 0) {
    return `${detail.contextCounts.appointments} geplante Termine`;
  }
  return 'Kein Termin geplant';
}

function resolveOpenItems(detail: ClientFullDetail): string {
  const openTasks = detail.tasks?.filter((t) => t.isActive).length ?? 0;
  const openConsents = detail.consents?.filter((c) => !c.granted).length ?? 0;
  const parts: string[] = [];
  if (openTasks > 0) parts.push(`${openTasks} Aufgabe${openTasks === 1 ? '' : 'n'}`);
  if (openConsents > 0) parts.push(`${openConsents} Einwilligung${openConsents === 1 ? '' : 'en'} offen`);
  if (detail.status === 'entwurf' || detail.status === 'in_bearbeitung') {
    parts.push('Aufnahme unvollständig');
  }
  return parts.length > 0 ? parts.join(' · ') : 'Keine offenen Punkte';
}

function buildSignedDocuments(detail: ClientFullDetail): ClientRecordSignedDocument[] {
  const items: ClientRecordSignedDocument[] = [];

  for (const consent of detail.consents ?? []) {
    if (!consent.granted || !consent.grantedAt) continue;
    items.push({
      id: consent.id,
      title: consent.title,
      signedAt: consent.grantedAt,
      kind: 'consent',
    });
  }

  for (const contract of detail.contracts ?? []) {
    if (!contract.signedAt) continue;
    items.push({
      id: contract.id,
      title: `Vertrag ${contract.contractNumber}`,
      signedAt: contract.signedAt,
      kind: 'contract',
    });
  }

  for (const doc of detail.documents ?? []) {
    if (doc.intakeStatus === 'finalized' || doc.status === 'abgeschlossen' || doc.status === 'aktiv') {
      items.push({
        id: doc.id,
        title: doc.title,
        signedAt: doc.updatedAt ?? doc.createdAt,
        kind: doc.category === 'einwilligung' ? 'consent' : doc.category === 'vertrag' ? 'contract' : 'document',
      });
    }
  }

  return items
    .sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime())
    .slice(0, 6);
}

const QUICK_LINK_TABS: ClientRecordTabKey[] = ['stammdaten', 'einsaetze', 'dokumente', 'portal'];

export function buildClientRecordOverview(
  detail: ClientFullDetail,
  careContexts: ClientCareContext[],
  availableTabs: ClientRecordTabKey[],
): ClientRecordOverview {
  const serviceTypes =
    careContexts.length > 0
      ? careContexts.map((c) => getCatalogLabel('leistungsart', c)).join(' · ')
      : EMPTY;

  const quickLinks = QUICK_LINK_TABS.filter((tab) => availableTabs.includes(tab)).map((tab) => ({
    tab,
    label: CLIENT_RECORD_TAB_LABELS[tab],
  }));

  return {
    fullName: `${detail.firstName} ${detail.lastName}`.trim(),
    dateOfBirth: detail.dateOfBirth ? formatDate(detail.dateOfBirth) : EMPTY,
    address: buildAddress(detail),
    phone: display(detail.phone ?? detail.primaryContactPhone),
    primaryCostBearer: resolveCostBearer(detail),
    careLevel: formatCareLevel(detail.careLevel),
    serviceTypes,
    lastActivity: resolveLastActivity(detail),
    admissionDate: detail.admissionDate
      ? formatDate(detail.admissionDate)
      : detail.createdAt
        ? formatDate(detail.createdAt)
        : EMPTY,
    nextAppointment: resolveNextAppointment(detail),
    openItemsSummary: resolveOpenItems(detail),
    signedDocuments: buildSignedDocuments(detail),
    quickLinks,
  };
}
