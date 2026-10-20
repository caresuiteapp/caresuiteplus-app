import type { PortalMessage, PortalNotification } from '@/types/portal/communication';
import { DEMO_TENANT_ID } from './tenant';

const BASE = '2026-06-01T08:00:00.000Z';

export const demoPortalMessages: Pick<
  PortalMessage,
  | 'id'
  | 'tenantId'
  | 'subject'
  | 'body'
  | 'channel'
  | 'direction'
  | 'senderName'
  | 'recipientName'
  | 'readAt'
  | 'status'
  | 'visibility'
  | 'sensitivity'
  | 'audienceScope'
  | 'ownedByProfileId'
  | 'sharedWithProfileIds'
  | 'createdAt'
  | 'updatedAt'
>[] = [
  {
    id: 'msg-001',
    tenantId: DEMO_TENANT_ID,
    subject: 'Terminbestätigung Alltagsbegleitung',
    body: 'Ihr Einsatz am Dienstag, 14:00 Uhr, ist bestätigt. Bitte melden Sie sich bei Verspätung.',
    channel: 'portal',
    direction: 'inbound',
    senderName: 'Einsatzplanung',
    recipientName: 'Sandra Meier',
    readAt: null,
    status: 'aktiv',
    visibility: 'own',
    sensitivity: 'internal',
    audienceScope: 'portal',
    ownedByProfileId: 'profile-portal-employee-001',
    createdAt: BASE,
    updatedAt: BASE,
  },
  {
    id: 'msg-002',
    tenantId: DEMO_TENANT_ID,
    subject: 'Dokumentation Spaziergang',
    body: 'Bitte ergänzen Sie die Kurznotiz zum gestrigen Spaziergang bis Freitag.',
    channel: 'portal',
    direction: 'inbound',
    senderName: 'Markus Vogel',
    recipientName: 'Sandra Meier',
    readAt: '2026-06-01T09:00:00.000Z',
    status: 'abgeschlossen',
    visibility: 'team',
    sensitivity: 'care',
    audienceScope: 'portal',
    ownedByProfileId: 'profile-dispatch-001',
    createdAt: '2026-05-30T08:00:00.000Z',
    updatedAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'msg-003',
    tenantId: DEMO_TENANT_ID,
    subject: 'Nächster Besuch',
    body: 'Guten Tag Frau Schneider, Ihr nächster Termin ist am Dienstag um 14:00 Uhr.',
    channel: 'portal',
    direction: 'inbound',
    senderName: 'CareSuite+ Team',
    recipientName: 'Helga Schneider',
    readAt: null,
    status: 'aktiv',
    visibility: 'own',
    sensitivity: 'care',
    audienceScope: 'portal',
    ownedByProfileId: 'profile-client-001',
    createdAt: BASE,
    updatedAt: BASE,
  },
  {
    id: 'msg-004',
    tenantId: DEMO_TENANT_ID,
    subject: 'Pflegeplan aktualisiert',
    body: 'Der Pflegeplan wurde aktualisiert und steht im Dokumentenbereich zur Einsicht bereit.',
    channel: 'portal',
    direction: 'inbound',
    senderName: 'Dr. Anna Krüger',
    recipientName: 'Helga Schneider',
    readAt: '2026-05-28T10:00:00.000Z',
    status: 'abgeschlossen',
    visibility: 'shared',
    sensitivity: 'care',
    audienceScope: 'portal',
    ownedByProfileId: 'profile-client-001',
    sharedWithProfileIds: ['profile-family-001'],
    createdAt: '2026-05-28T08:00:00.000Z',
    updatedAt: '2026-05-28T10:00:00.000Z',
  },
  {
    id: 'msg-005',
    tenantId: DEMO_TENANT_ID,
    subject: 'Monatsübersicht für Angehörige',
    body: 'Die Betreuungsübersicht für Juni wurde freigegeben.',
    channel: 'portal',
    direction: 'inbound',
    senderName: 'CareSuite+ Team',
    recipientName: 'Karin Schneider',
    readAt: null,
    status: 'aktiv',
    visibility: 'shared',
    sensitivity: 'care',
    audienceScope: 'portal',
    ownedByProfileId: 'profile-client-001',
    sharedWithProfileIds: ['profile-family-001'],
    createdAt: '2026-06-01T07:00:00.000Z',
    updatedAt: '2026-06-01T07:00:00.000Z',
  },
  {
    id: 'msg-006',
    tenantId: DEMO_TENANT_ID,
    subject: 'Interne Teaminfo',
    body: 'Schulung am Freitag — bitte Einsatzplanung beachten.',
    channel: 'portal',
    direction: 'inbound',
    senderName: 'Geschäftsführung',
    recipientName: 'Team',
    readAt: null,
    status: 'aktiv',
    visibility: 'team',
    sensitivity: 'internal',
    audienceScope: 'portal',
    ownedByProfileId: 'profile-admin-001',
    createdAt: BASE,
    updatedAt: BASE,
  },
  {
    id: 'msg-007',
    tenantId: DEMO_TENANT_ID,
    subject: 'MDK-Anfrage Helga Schneider',
    body: 'Der MDK hat Unterlagen angefordert. Bitte bis Donnerstag im Office-Dokumentenbereich bereitstellen.',
    channel: 'portal',
    direction: 'inbound',
    senderName: 'Abrechnung',
    recipientName: 'Büro-Team',
    readAt: null,
    status: 'in_bearbeitung',
    visibility: 'team',
    sensitivity: 'restricted',
    audienceScope: 'office',
    ownedByProfileId: 'profile-admin-001',
    createdAt: '2026-05-29T08:00:00.000Z',
    updatedAt: BASE,
  },
  {
    id: 'msg-008',
    tenantId: DEMO_TENANT_ID,
    subject: 'Rechnungsfreigabe Mai',
    body: 'Alle Rechnungen für Mai wurden geprüft und können versendet werden.',
    channel: 'portal',
    direction: 'inbound',
    senderName: 'Geschäftsführung',
    recipientName: 'Abrechnung',
    readAt: '2026-06-01T11:00:00.000Z',
    status: 'abgeschlossen',
    visibility: 'team',
    sensitivity: 'internal',
    audienceScope: 'office',
    ownedByProfileId: 'profile-admin-001',
    createdAt: '2026-05-31T08:00:00.000Z',
    updatedAt: '2026-06-01T11:00:00.000Z',
  },
  {
    id: 'msg-009',
    tenantId: DEMO_TENANT_ID,
    subject: 'Neue Klient:in — Aufnahme',
    body: 'Frau Weber startet nächste Woche. Bitte Stammdaten und Erstgespräch terminieren.',
    channel: 'portal',
    direction: 'inbound',
    senderName: 'Einsatzplanung',
    recipientName: 'Office',
    readAt: null,
    status: 'aktiv',
    visibility: 'team',
    sensitivity: 'care',
    audienceScope: 'office',
    ownedByProfileId: 'profile-dispatch-001',
    createdAt: BASE,
    updatedAt: BASE,
  },
];

export const demoPortalNotifications: Pick<
  PortalNotification,
  | 'id'
  | 'tenantId'
  | 'type'
  | 'title'
  | 'body'
  | 'readAt'
  | 'actionRoute'
  | 'status'
  | 'visibility'
  | 'sensitivity'
  | 'ownedByProfileId'
  | 'sharedWithProfileIds'
  | 'createdAt'
  | 'updatedAt'
>[] = [
  {
    id: 'notif-001',
    tenantId: DEMO_TENANT_ID,
    type: 'appointment_reminder',
    title: 'Einsatz in 2 Stunden',
    body: 'Alltagsbegleitung bei Helga Schneider, Musterstraße 12.',
    readAt: null,
    actionRoute: null,
    status: 'aktiv',
    visibility: 'own',
    sensitivity: 'internal',
    ownedByProfileId: 'profile-portal-employee-001',
    createdAt: BASE,
    updatedAt: BASE,
  },
  {
    id: 'notif-002',
    tenantId: DEMO_TENANT_ID,
    type: 'document_shared',
    title: 'Neues Dokument',
    body: 'Pflegeplan Juni steht zur Einsicht bereit.',
    readAt: null,
    actionRoute: null,
    status: 'aktiv',
    visibility: 'shared',
    sensitivity: 'care',
    ownedByProfileId: 'profile-client-001',
    sharedWithProfileIds: ['profile-family-001'],
    createdAt: BASE,
    updatedAt: BASE,
  },
];
