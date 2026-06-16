import type { ClientFullDetail } from '@/types/modules/client';
import { DEMO_TENANT_ID } from '../tenant';
import {
  CLIENT_STATUS_HINTS,
  getAllowedStatusActions,
} from '@/lib/services/workflow/clientStatus';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const now = daysAgo(0);

export const helgaSchneiderFull: ClientFullDetail = {
  id: 'client-001',
  tenantId: DEMO_TENANT_ID,
  firstName: 'Helga',
  lastName: 'Schneider',
  dateOfBirth: '1948-03-15',
  careLevel: 'PG 2',
  status: 'aktiv',
  primaryContactPhone: '+49 30 98765432',
  city: 'Berlin',
  zip: '10115',
  sensitivity: 'care',
  createdAt: daysAgo(365),
  updatedAt: now,
  street: 'Musterstraße 12',
  phone: '+49 30 98765432',
  email: 'helga.schneider@demo.app',
  notes: 'Schlüssel beim Hausmeister (Herr Krause).',
  visibility: 'team',
  ownedByProfileId: 'profile-admin-001',
  sharedWithProfileIds: [],
  auditEntries: [
    { id: 'audit-hs-1', action: 'Stammdaten aktualisiert', actorName: 'Sabine Muster', timestamp: daysAgo(2), details: 'Pflegegrad geprüft' },
    { id: 'audit-hs-2', action: 'Einwilligung erteilt', actorName: 'Sabine Muster', timestamp: daysAgo(30), details: 'Portal-Zugang freigegeben' },
  ],
  history: [
    { id: 'hist-hs-1', icon: '📅', title: 'Einsatz dokumentiert', subtitle: 'Alltagsbegleitung 2 Std.', timestamp: daysAgo(1), status: 'abgeschlossen', actorName: 'Thomas Keller' },
    { id: 'hist-hs-2', icon: '📄', title: 'Pflegeplan aktualisiert', timestamp: daysAgo(5), status: 'in_bearbeitung', actorName: 'Sabine Muster' },
  ],
  contextCounts: { assignments: 4, documents: 7, invoices: 3, appointments: 2 },
  nextActionHint: CLIENT_STATUS_HINTS.aktiv,
  allowedStatusActions: getAllowedStatusActions('aktiv'),
  lifecycleStatus: 'aktiv',
  core: {
    id: 'client-001',
    tenantId: DEMO_TENANT_ID,
    firstName: 'Helga',
    lastName: 'Schneider',
    salutation: 'Frau',
    gender: 'weiblich',
    dateOfBirth: '1948-03-15',
    lifecycleStatus: 'aktiv',
    insuranceNumber: 'A123456789',
    keySafeCode: '4821',
    diagnoses: ['Diabetes Typ 2', 'Hypertonie'],
    primaryContactPhone: '+49 30 98765432',
    city: 'Berlin',
    zip: '10115',
    sensitivity: 'care',
    visibility: 'team',
    ownedByProfileId: 'profile-admin-001',
    sharedWithProfileIds: [],
    createdAt: daysAgo(365),
    updatedAt: now,
  },
  addresses: [
    {
      id: 'addr-hs-1', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      addressType: 'hauptwohnsitz', street: 'Musterstraße 12', zip: '10115', city: 'Berlin',
      country: 'DE', isPrimary: true, accessNotes: '2. OG, Aufzug vorhanden', floor: '2', doorCode: null,
      createdAt: daysAgo(365), updatedAt: now,
    },
  ],
  contacts: [
    {
      id: 'contact-hs-1', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      firstName: 'Petra', lastName: 'Schneider', relationship: 'kind', relationshipLabel: 'Tochter',
      phone: '+49 170 1234567', email: 'petra.schneider@demo.app', isEmergency: true,
      isPortalUser: true,
      portalPermissions: { canViewAppointments: true, canViewDocuments: true, canViewCarePlan: true, canSendMessages: true, canViewBilling: false },
      notes: 'Erreichbar werktags ab 17 Uhr', createdAt: daysAgo(300), updatedAt: now,
    },
    {
      id: 'contact-hs-2', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      firstName: 'Dr. Martin', lastName: 'Weber', relationship: 'arzt', relationshipLabel: 'Hausarzt',
      phone: '+49 30 5551234', email: null, isEmergency: false, isPortalUser: false,
      portalPermissions: { canViewAppointments: false, canViewDocuments: false, canViewCarePlan: false, canSendMessages: false, canViewBilling: false },
      notes: null, createdAt: daysAgo(200), updatedAt: now,
    },
  ],
  careLevels: [
    {
      id: 'cl-hs-1', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      grade: 'pg2', validFrom: '2024-06-01', validUntil: null,
      careFundName: 'AOK Nordost', careFundMemberId: 'A123456789',
      mdAssessmentDate: '2024-05-15', notes: 'Nächste Begutachtung voraussichtlich 2027',
      createdAt: daysAgo(200), updatedAt: now,
    },
  ],
  budgets: [
    {
      id: 'bud-hs-1', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      budgetType: 'paragraph_45b', year: 2026, totalAmountCents: 13100_00, usedAmountCents: 4200_00, reservedAmountCents: 800_00,
      validFrom: '2026-01-01', validUntil: '2026-12-31', notes: '§45b Entlastungsbetrag',
      createdAt: daysAgo(90), updatedAt: now,
    },
    {
      id: 'bud-hs-2', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      budgetType: 'paragraph_45a', year: 2026, totalAmountCents: 3539_00, usedAmountCents: 0, reservedAmountCents: 0,
      validFrom: '2026-01-01', validUntil: '2026-12-31', notes: 'Verhinderungspflege noch nicht in Anspruch genommen',
      createdAt: daysAgo(90), updatedAt: now,
    },
  ],
  billingProfile: {
    id: 'bill-hs-1', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
    billingType: 'pflegekasse', hourlyRateCents: 3800, serviceType: 'betreuung',
    invoiceRecipient: 'AOK Nordost', paymentTermsDays: 30,
    costBearerName: 'AOK Nordost', costBearerReference: 'IK 109519005',
    notes: 'Abrechnung über §45b', createdAt: daysAgo(300), updatedAt: now,
  },
  contracts: [
    {
      id: 'contract-hs-1', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      contractNumber: 'PV-2024-0042', contractStart: '2024-07-01', contractEnd: null,
      serviceType: 'betreuung', hourlyRateCents: 3800, weeklyHours: 6,
      status: 'aktiv', signedAt: daysAgo(200), documentId: 'doc-hs-contract',
      notes: 'Alltagsbegleitung und Haushalt', createdAt: daysAgo(200), updatedAt: now,
    },
  ],
  preferences: {
    id: 'pref-hs-1', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
    preferredShifts: ['morgens', 'mittags'],
    preferredEmployeeIds: ['employee-001'],
    excludedEmployeeIds: [],
    language: 'de', mobilityNotes: 'Rollator, Treppen nur mit Hilfe',
    householdNotes: 'Katze im Haushalt (Minka)', petNotes: 'Katze — nicht aus dem Haus lassen',
    accessInstructions: 'Klingel „Schneider", Schlüssel beim Hausmeister',
    createdAt: daysAgo(300), updatedAt: now,
  },
  risks: [
    {
      id: 'risk-hs-1', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      category: 'sturz', level: 'mittel', description: 'Erhöhtes Sturzrisiko aufgrund eingeschränkter Mobilität',
      mitigation: 'Rollator immer in Reichweite, rutschfeste Matte im Bad', assessedAt: daysAgo(30), assessedBy: 'Sabine Muster',
      createdAt: daysAgo(30), updatedAt: now,
    },
    {
      id: 'risk-hs-2', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      category: 'medikation', level: 'niedrig', description: 'Regelmäßige Medikamenteneinnahme erforderlich',
      mitigation: 'Medikamentenbox vorbereiten', assessedAt: daysAgo(30), assessedBy: 'Sabine Muster',
      createdAt: daysAgo(30), updatedAt: now,
    },
  ],
  emergencyPlan: {
    id: 'em-hs-1', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
    emergencyContactName: 'Petra Schneider', emergencyContactPhone: '+49 170 1234567',
    emergencyContactRelation: 'Tochter', doctorName: 'Dr. Martin Weber', doctorPhone: '+49 30 5551234',
    hospitalPreference: 'Charité Mitte', allergies: [], medications: ['Metformin 500mg', 'Ramipril 5mg'],
    specialInstructions: 'Bei Bewusstlosigkeit Notarzt rufen', dnrStatus: false,
    createdAt: daysAgo(300), updatedAt: now,
  },
  consents: [
    {
      id: 'consent-hs-1', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      consentType: 'datenschutz', title: 'Datenschutzerklärung', scope: 'own',
      granted: true, grantedAt: daysAgo(300), expiresAt: null, grantedByProfileId: 'profile-admin-001',
      documentId: null, notes: null, createdAt: daysAgo(300), updatedAt: now,
    },
    {
      id: 'consent-hs-2', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      consentType: 'portal_zugang', title: 'Portal-Zugang Klient:in', scope: 'own',
      granted: true, grantedAt: daysAgo(30), expiresAt: null, grantedByProfileId: 'profile-admin-001',
      documentId: null, notes: null, createdAt: daysAgo(300), updatedAt: now,
    },
    {
      id: 'consent-hs-3', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      consentType: 'vertrag', title: 'Pflegevertrag', scope: 'team',
      granted: true, grantedAt: daysAgo(200), expiresAt: null, grantedByProfileId: 'profile-admin-001',
      documentId: 'doc-hs-contract', notes: null, createdAt: daysAgo(200), updatedAt: now,
    },
    {
      id: 'consent-hs-4', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      consentType: 'medizinische_daten', title: 'Medizinische Daten', scope: 'team',
      granted: true, grantedAt: daysAgo(200), expiresAt: null, grantedByProfileId: 'profile-admin-001',
      documentId: null, notes: null, createdAt: daysAgo(200), updatedAt: now,
    },
  ],
  portalAccess: [
    {
      id: 'portal-hs-1', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      contactId: 'contact-hs-1', email: null, portalUsername: 'helga.schneider',
      portalEnabled: true, status: 'aktiv',
      lastLoginAt: daysAgo(3), invitedAt: null, codeCreatedAt: daysAgo(30), codeRotatedAt: null,
      modulesEnabled: ['appointments', 'messages', 'documents', 'careplan'],
      twoFactorEnabled: false, createdAt: daysAgo(30), updatedAt: now,
    },
  ],
  documents: [
    {
      id: 'doc-hs-contract', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      title: 'Pflegevertrag', fileName: 'pflegevertrag-schneider.pdf', mimeType: 'application/pdf',
      category: 'vertrag', storagePath: '/demo/docs/pflegevertrag-schneider.pdf', status: 'aktiv',
      sensitivity: 'care', uploadedBy: 'profile-admin-001', validUntil: null,
      createdAt: daysAgo(200), updatedAt: now,
    },
    {
      id: 'doc-hs-md', tenantId: DEMO_TENANT_ID, clientId: 'client-001',
      title: 'MD-Gutachten PG2', fileName: 'md-gutachten-schneider.pdf', mimeType: 'application/pdf',
      category: 'md_gutachten', storagePath: '/demo/docs/md-schneider.pdf', status: 'aktiv',
      sensitivity: 'health', uploadedBy: 'profile-admin-001', validUntil: '2027-06-01',
      createdAt: daysAgo(200), updatedAt: now,
    },
  ],
  tasks: [
    { id: 'task-hs-1', tenantId: DEMO_TENANT_ID, clientId: 'client-001', category: 'haushalt', title: 'Staubsaugen', description: 'Wohnzimmer und Schlafzimmer', frequency: 'woechentlich', durationMinutes: 30, isActive: true, catalogTaskId: 'task-haushalt-1', assignedEmployeeIds: ['employee-001'], createdAt: daysAgo(100), updatedAt: now },
    { id: 'task-hs-2', tenantId: DEMO_TENANT_ID, clientId: 'client-001', category: 'waesche', title: 'Wäsche waschen', description: null, frequency: 'woechentlich', durationMinutes: 15, isActive: true, catalogTaskId: 'task-waesche-1', assignedEmployeeIds: [], createdAt: daysAgo(100), updatedAt: now },
    { id: 'task-hs-3', tenantId: DEMO_TENANT_ID, clientId: 'client-001', category: 'einkauf', title: 'Lebensmitteleinkauf', description: 'Einkaufsliste liegt im Küchenschrank', frequency: 'zweimal_wöchentlich', durationMinutes: 60, isActive: true, catalogTaskId: 'task-einkauf-1', assignedEmployeeIds: ['employee-002'], createdAt: daysAgo(100), updatedAt: now },
    { id: 'task-hs-4', tenantId: DEMO_TENANT_ID, clientId: 'client-001', category: 'ernaehrung', title: 'Mahlzeit zubereiten', description: 'Warme Mittagsmahlzeit', frequency: 'taeglich', durationMinutes: 40, isActive: true, catalogTaskId: 'task-ernaehr-1', assignedEmployeeIds: ['employee-001'], createdAt: daysAgo(100), updatedAt: now },
    { id: 'task-hs-5', tenantId: DEMO_TENANT_ID, clientId: 'client-001', category: 'begleitung', title: 'Spaziergang', description: 'Im Park nebenan', frequency: 'woechentlich', durationMinutes: 45, isActive: true, catalogTaskId: 'task-begleit-2', assignedEmployeeIds: ['employee-001'], createdAt: daysAgo(100), updatedAt: now },
  ],
  timeline: [
    { id: 'tl-hs-1', clientId: 'client-001', eventType: 'einsatz', icon: '📅', title: 'Einsatz dokumentiert', subtitle: 'Alltagsbegleitung 2 Std.', timestamp: daysAgo(1), status: 'abgeschlossen', actorName: 'Thomas Keller', isInternal: false, metadata: null },
    { id: 'tl-hs-2', clientId: 'client-001', eventType: 'einwilligung', icon: '✅', title: 'Portal-Freigabe erteilt', subtitle: 'Angehörigenportal für Petra Schneider', timestamp: daysAgo(30), status: 'aktiv', actorName: 'Sabine Muster', isInternal: false, metadata: null },
    { id: 'tl-hs-3', clientId: 'client-001', eventType: 'notiz', icon: '📝', title: 'Interne Notiz', subtitle: 'Schlüssel beim Hausmeister aktualisiert', timestamp: daysAgo(5), status: 'aktiv', actorName: 'Sabine Muster', isInternal: true, metadata: null },
    { id: 'tl-hs-4', clientId: 'client-001', eventType: 'rechnung', icon: '🧾', title: 'Rechnung erstellt', subtitle: 'RE-2026-0341', timestamp: daysAgo(10), status: 'entwurf', actorName: 'Sabine Muster', isInternal: false, metadata: { invoiceNumber: 'RE-2026-0341' } },
  ],
  internalNotes: [
    { id: 'note-hs-1', clientId: 'client-001', tenantId: DEMO_TENANT_ID, content: 'Schlüssel beim Hausmeister (Herr Krause, Tel. 030-123456).', isInternal: true, createdBy: 'Sabine Muster', createdAt: daysAgo(60), updatedAt: daysAgo(5), category: 'allgemein' },
    { id: 'note-hs-2', clientId: 'client-001', tenantId: DEMO_TENANT_ID, content: 'Klientin bevorzugt feste Bezugsperson (Thomas K.).', isInternal: true, createdBy: 'Sabine Muster', createdAt: daysAgo(30), updatedAt: daysAgo(30), category: 'einsatz' },
    { id: 'note-hs-3', clientId: 'client-001', tenantId: DEMO_TENANT_ID, content: 'Diabetes — Blutzucker vor Mahlzeiten prüfen.', isInternal: true, createdBy: 'Sabine Muster', createdAt: daysAgo(20), updatedAt: daysAgo(20), category: 'gesundheit' },
  ],
};
