import type { ClientCareContext, ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { CLIENT_RECORD_TAB_LABELS } from '@/lib/clients/clientIntakeFieldRules';
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
  signedDocuments: ClientRecordSignedDocument[];
  quickLinks: ClientRecordQuickLink[];
};

const EMPTY = '—';

function display(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : EMPTY;
}

function buildAddress(detail: ClientFullDetail): string {
  const parts = [detail.street, [detail.zip, detail.city].filter(Boolean).join(' ')].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : EMPTY;
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
    if (doc.category !== 'einwilligung' && doc.category !== 'vertrag') continue;
    if (doc.status !== 'aktiv' && doc.status !== 'abgeschlossen') continue;
    items.push({
      id: doc.id,
      title: doc.title,
      signedAt: doc.updatedAt ?? doc.createdAt,
      kind: 'document',
    });
  }

  return items
    .sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime())
    .slice(0, 6);
}

const QUICK_LINK_TABS: ClientRecordTabKey[] = ['stammdaten', 'dokumente', 'vertrag', 'einwilligungen'];

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
    admissionDate: detail.createdAt ? formatDate(detail.createdAt) : EMPTY,
    signedDocuments: buildSignedDocuments(detail),
    quickLinks,
  };
}
