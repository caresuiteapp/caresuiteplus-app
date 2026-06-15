import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import type {
  KIMAttachment,
  KIMMailbox,
  KIMMessage,
  KIMMessageDetail,
  KIMMessageListItem,
  TIConsent,
  TIAuditEvent,
  TIDashboardSnapshot,
  TIProvider,
  TIProviderListItem,
} from '@/types/modules/ti';

export const TI_DEMO_TENANT = DEMO_TENANT_ID;

const now = '2026-06-13T10:00:00.000Z';

export const demoTIProviders: TIProvider[] = [
  {
    id: 'ti-prov-kim-001',
    tenantId: TI_DEMO_TENANT,
    name: 'KIM-Connector (Demo)',
    kind: 'kim',
    connectionStatus: 'kim_active',
    secretReference: 'vault:ti/kim/demo-connector',
    endpointUrl: 'https://kim-demo.caresuiteplus.local/api',
    lastCheckAt: '2026-06-13T09:45:00.000Z',
    lastError: null,
    isActive: true,
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: now,
  },
  {
    id: 'ti-prov-egk-001',
    tenantId: TI_DEMO_TENANT,
    name: 'eGK-Kartenleser (Demo)',
    kind: 'egk',
    connectionStatus: 'provider_configured',
    secretReference: 'vault:ti/egk/demo-reader',
    endpointUrl: null,
    lastCheckAt: '2026-06-12T14:00:00.000Z',
    lastError: null,
    isActive: true,
    createdAt: '2026-02-01T08:00:00.000Z',
    updatedAt: now,
  },
  {
    id: 'ti-prov-epa-001',
    tenantId: TI_DEMO_TENANT,
    name: 'ePA-Gateway (Demo)',
    kind: 'epa',
    connectionStatus: 'not_configured',
    secretReference: null,
    endpointUrl: null,
    lastCheckAt: null,
    lastError: null,
    isActive: false,
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: now,
  },
];

export const demoKIMMailboxes: KIMMailbox[] = [
  {
    id: 'kim-mb-praxis-001',
    tenantId: TI_DEMO_TENANT,
    address: 'pflegedienst@kim-demo.caresuiteplus.de',
    displayName: 'CareSuite+ Demo Praxis',
    providerId: 'ti-prov-kim-001',
    unreadCount: 3,
    lastSyncAt: '2026-06-13T09:50:00.000Z',
    syncStatus: 'idle',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: now,
  },
];

const demoMessages: KIMMessage[] = [
  {
    id: 'kim-msg-001',
    tenantId: TI_DEMO_TENANT,
    mailboxId: 'kim-mb-praxis-001',
    sender: 'arztpraxis.mueller@kim.kvnrw.de',
    senderName: 'Praxis Dr. Müller',
    subject: 'Überweisungsschein — Frau Schmidt, Maria',
    preview: 'Anbei der Überweisungsschein für die ambulante Pflege…',
    body: 'Sehr geehrte Damen und Herren,\n\nanbei der Überweisungsschein für Frau Maria Schmidt (geb. 12.03.1948).\n\nBitte bestätigen Sie den Erhalt über KIM.\n\nMit freundlichen Grüßen\nDr. Thomas Müller',
    status: 'unread',
    receivedAt: '2026-06-13T08:30:00.000Z',
    hasAttachments: true,
    isMedical: true,
    createdAt: '2026-06-13T08:30:00.000Z',
    updatedAt: '2026-06-13T08:30:00.000Z',
  },
  {
    id: 'kim-msg-002',
    tenantId: TI_DEMO_TENANT,
    mailboxId: 'kim-mb-praxis-001',
    sender: 'krankenhaus.st-joseph@kim.nrw.de',
    senderName: 'St. Joseph Krankenhaus',
    subject: 'Entlassungsbericht — Herr Weber, Hans',
    preview: 'Entlassungsbericht nach stationärem Aufenthalt…',
    body: 'Entlassungsbericht für Herrn Hans Weber.\n\nDiagnose: Z.n. Hüft-TEP links.\nEmpfehlung: Mobilisation und Wundversorgung.',
    status: 'unread',
    receivedAt: '2026-06-12T16:45:00.000Z',
    hasAttachments: true,
    isMedical: true,
    createdAt: '2026-06-12T16:45:00.000Z',
    updatedAt: '2026-06-12T16:45:00.000Z',
  },
  {
    id: 'kim-msg-003',
    tenantId: TI_DEMO_TENANT,
    mailboxId: 'kim-mb-praxis-001',
    sender: 'mdk-nrw@kim.gematik.de',
    senderName: 'MDK Nordrhein',
    subject: 'Begutachtungsanfrage — Pflegegrad',
    preview: 'Anfrage zur Begutachtung Pflegegrad 3…',
    body: 'Begutachtungsanfrage für Klient:in Pflegegrad 3.\nTerminvorschlag: 20.06.2026.',
    status: 'read',
    receivedAt: '2026-06-11T11:00:00.000Z',
    hasAttachments: false,
    isMedical: true,
    createdAt: '2026-06-11T11:00:00.000Z',
    updatedAt: '2026-06-11T14:00:00.000Z',
  },
  {
    id: 'kim-msg-004',
    tenantId: TI_DEMO_TENANT,
    mailboxId: 'kim-mb-praxis-001',
    sender: 'apotheke-am-markt@kim.kvnrw.de',
    senderName: 'Apotheke am Markt',
    subject: 'E-Rezept-Bestätigung',
    preview: 'E-Rezept wurde erfolgreich eingelöst…',
    body: 'E-Rezept für Metformin 500mg wurde eingelöst.',
    status: 'read',
    receivedAt: '2026-06-10T09:15:00.000Z',
    hasAttachments: false,
    isMedical: false,
    createdAt: '2026-06-10T09:15:00.000Z',
    updatedAt: '2026-06-10T10:00:00.000Z',
  },
  {
    id: 'kim-msg-005',
    tenantId: TI_DEMO_TENANT,
    mailboxId: 'kim-mb-praxis-001',
    sender: 'system@kim.gematik.de',
    senderName: 'KIM-System',
    subject: 'Zustellfehler — Nachricht nicht zustellbar',
    preview: 'Die Nachricht an unbekannt@kim.invalid konnte nicht zugestellt werden.',
    body: 'Zustellfehler: Empfänger nicht erreichbar.',
    status: 'error',
    receivedAt: '2026-06-09T07:00:00.000Z',
    hasAttachments: false,
    isMedical: false,
    createdAt: '2026-06-09T07:00:00.000Z',
    updatedAt: '2026-06-09T07:00:00.000Z',
  },
  {
    id: 'kim-msg-006',
    tenantId: TI_DEMO_TENANT,
    mailboxId: 'kim-mb-praxis-001',
    sender: 'physio-fit@kim.kvnrw.de',
    senderName: 'Physiotherapie Fit',
    subject: 'Therapieplan — Frau Klein',
    preview: 'Aktualisierter Therapieplan…',
    body: 'Therapieplan für Frau Klein, 2x wöchentlich.',
    status: 'archived',
    receivedAt: '2026-05-28T13:20:00.000Z',
    hasAttachments: true,
    isMedical: true,
    createdAt: '2026-05-28T13:20:00.000Z',
    updatedAt: '2026-06-01T09:00:00.000Z',
  },
];

export const demoKIMAttachments: KIMAttachment[] = [
  {
    id: 'kim-att-001',
    tenantId: TI_DEMO_TENANT,
    messageId: 'kim-msg-001',
    fileName: 'Ueberweisung_Schmidt.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 245760,
    importStatus: 'pending',
    suggestedAssignment: 'Klient:in Maria Schmidt',
    createdAt: '2026-06-13T08:30:00.000Z',
    updatedAt: '2026-06-13T08:30:00.000Z',
  },
  {
    id: 'kim-att-002',
    tenantId: TI_DEMO_TENANT,
    messageId: 'kim-msg-002',
    fileName: 'Entlassungsbericht_Weber.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 512000,
    importStatus: 'pending',
    suggestedAssignment: 'Klient:in Hans Weber',
    createdAt: '2026-06-12T16:45:00.000Z',
    updatedAt: '2026-06-12T16:45:00.000Z',
  },
];

export const demoTIConsents: TIConsent[] = [
  {
    id: 'ti-consent-kim-001',
    tenantId: TI_DEMO_TENANT,
    scope: 'kim',
    status: 'granted',
    version: 2,
    grantedAt: '2026-01-15T10:00:00.000Z',
    revokedAt: null,
    expiresAt: '2027-01-15T10:00:00.000Z',
    grantedBy: 'Sabine Muster',
    legalBasis: 'Art. 9 Abs. 2 lit. h DSGVO i.V.m. § 291 SGB V',
    description: 'Verarbeitung von KIM-Nachrichten im Rahmen der ambulanten Pflege',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'ti-consent-egk-001',
    tenantId: TI_DEMO_TENANT,
    scope: 'egk',
    status: 'granted',
    version: 1,
    grantedAt: '2026-02-01T09:00:00.000Z',
    revokedAt: null,
    expiresAt: '2027-02-01T09:00:00.000Z',
    grantedBy: 'Sabine Muster',
    legalBasis: 'Art. 9 Abs. 2 lit. h DSGVO',
    description: 'Auslesen von Versicherungsdaten von der elektronischen Gesundheitskarte',
    createdAt: '2026-02-01T09:00:00.000Z',
    updatedAt: '2026-02-01T09:00:00.000Z',
  },
  {
    id: 'ti-consent-epa-001',
    tenantId: TI_DEMO_TENANT,
    scope: 'epa',
    status: 'pending',
    version: 1,
    grantedAt: null,
    revokedAt: null,
    expiresAt: null,
    grantedBy: null,
    legalBasis: 'Art. 9 Abs. 2 lit. h DSGVO i.V.m. ePA-FDG',
    description: 'Zugriff auf die elektronische Patientenakte',
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-01T08:00:00.000Z',
  },
  {
    id: 'ti-consent-general-001',
    tenantId: TI_DEMO_TENANT,
    scope: 'ti_general',
    status: 'granted',
    version: 1,
    grantedAt: '2026-01-10T08:00:00.000Z',
    revokedAt: null,
    expiresAt: null,
    grantedBy: 'Sabine Muster',
    legalBasis: 'Art. 6 Abs. 1 lit. f DSGVO',
    description: 'Nutzung der Telematikinfrastruktur für den ambulanten Pflegedienst',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-01-10T08:00:00.000Z',
  },
];

export const demoTIAuditEvents: TIAuditEvent[] = [
  {
    id: 'ti-audit-001',
    tenantId: TI_DEMO_TENANT,
    action: 'consent_granted',
    actorId: null,
    actorName: 'Sabine Muster',
    resourceType: 'ti_consent',
    resourceId: 'ti-consent-kim-001',
    details: 'Einwilligung KIM-Nachrichten erteilt (Version 2)',
    ipAddress: '192.168.1.10',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'ti-audit-002',
    tenantId: TI_DEMO_TENANT,
    action: 'provider_check',
    actorId: null,
    actorName: 'System',
    resourceType: 'ti_provider',
    resourceId: 'ti-prov-kim-001',
    details: 'Verbindungsprüfung erfolgreich — KIM aktiv',
    ipAddress: null,
    createdAt: '2026-06-13T09:45:00.000Z',
    updatedAt: '2026-06-13T09:45:00.000Z',
  },
  {
    id: 'ti-audit-003',
    tenantId: TI_DEMO_TENANT,
    action: 'message_opened',
    actorId: null,
    actorName: 'Sabine Muster',
    resourceType: 'kim_message',
    resourceId: 'kim-msg-003',
    details: 'KIM-Nachricht geöffnet: Begutachtungsanfrage',
    ipAddress: '192.168.1.10',
    createdAt: '2026-06-11T14:00:00.000Z',
    updatedAt: '2026-06-11T14:00:00.000Z',
  },
];

/** Mutable in-memory store for demo mutations */
let messagesStore = [...demoMessages];
let auditStore = [...demoTIAuditEvents];
let consentsStore = [...demoTIConsents];

export function getTIDashboardSnapshot(): TIDashboardSnapshot {
  const unread = messagesStore.filter((m) => m.status === 'unread').length;
  const pendingConsents = consentsStore.filter((c) => c.status === 'pending').length;
  return {
    connectionStatus: 'kim_active',
    kpis: [
      { id: 'unread', label: 'Ungelesene KIM', value: unread, subValue: 'Nachrichten' },
      { id: 'providers', label: 'Aktive Provider', value: demoTIProviders.filter((p) => p.isActive).length },
      { id: 'consents', label: 'Ausstehende Einwilligungen', value: pendingConsents },
      { id: 'audit', label: 'Audit-Ereignisse (30 Tage)', value: auditStore.length },
    ],
    moduleStatus: [
      { module: 'KIM', status: 'kim_active', label: 'KIM-Postfach aktiv' },
      { module: 'eGK', status: 'provider_configured', label: 'Kartenleser konfiguriert' },
      { module: 'ePA', status: 'not_configured', label: 'Noch nicht eingerichtet' },
      { module: 'eMP', status: 'not_configured', label: 'Vorbereitung' },
      { module: 'E-Rezept', status: 'partially_available', label: 'Teilweise verfügbar' },
    ],
    unreadKimCount: unread,
    pendingConsents,
    lastAuditAt: auditStore[0]?.createdAt ?? null,
    syncStatus: 'idle',
  };
}

export function getTIProviderList(): TIProviderListItem[] {
  return demoTIProviders.map(({ createdAt: _c, ...rest }) => rest);
}

export function getKIMMessages(): KIMMessage[] {
  return [...messagesStore];
}

export function getKIMMessageDetail(messageId: string): KIMMessageDetail | null {
  const message = messagesStore.find((m) => m.id === messageId);
  if (!message) return null;
  const attachments = demoKIMAttachments.filter((a) => a.messageId === messageId);
  return { ...message, attachments };
}

export function toKIMMessageListItem(m: KIMMessage): KIMMessageListItem {
  const { body: _body, createdAt: _c, updatedAt: _u, ...rest } = m;
  return rest;
}

export function updateKIMMessageStatus(
  messageId: string,
  status: KIMMessage['status'],
): KIMMessage | null {
  const idx = messagesStore.findIndex((m) => m.id === messageId);
  if (idx === -1) return null;
  messagesStore[idx] = {
    ...messagesStore[idx],
    status,
    updatedAt: new Date().toISOString(),
  };
  return messagesStore[idx];
}

export function appendTIAuditEvent(event: Omit<TIAuditEvent, 'id' | 'createdAt' | 'updatedAt'>): TIAuditEvent {
  const newEvent: TIAuditEvent = {
    ...event,
    id: `ti-audit-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  auditStore = [newEvent, ...auditStore];
  return newEvent;
}

export function getTIAuditEvents(): TIAuditEvent[] {
  return [...auditStore];
}

export function getTIConsents(): TIConsent[] {
  return [...consentsStore];
}

export function grantTIConsent(consentId: string, grantedBy: string): TIConsent | null {
  const idx = consentsStore.findIndex((c) => c.id === consentId);
  if (idx === -1) return null;
  consentsStore[idx] = {
    ...consentsStore[idx],
    status: 'granted',
    version: consentsStore[idx].version + 1,
    grantedAt: new Date().toISOString(),
    grantedBy,
    updatedAt: new Date().toISOString(),
  };
  return consentsStore[idx];
}

export function revokeTIConsent(consentId: string): TIConsent | null {
  const idx = consentsStore.findIndex((c) => c.id === consentId);
  if (idx === -1) return null;
  consentsStore[idx] = {
    ...consentsStore[idx],
    status: 'revoked',
    revokedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return consentsStore[idx];
}

export function resetTIDemoStore(): void {
  messagesStore = [...demoMessages];
  auditStore = [...demoTIAuditEvents];
  consentsStore = [...demoTIConsents];
}
