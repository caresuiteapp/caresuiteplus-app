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

export const wernerMuellerFull: ClientFullDetail = {
  id: 'client-002',
  tenantId: DEMO_TENANT_ID,
  firstName: 'Werner',
  lastName: 'Müller',
  dateOfBirth: '1942-11-08',
  careLevel: 'PG 3',
  status: 'aktiv',
  primaryContactPhone: '+49 30 44556677',
  city: 'Berlin',
  zip: '10437',
  sensitivity: 'health',
  createdAt: daysAgo(400),
  updatedAt: now,
  street: 'Prenzlauer Allee 88',
  phone: '+49 30 44556677',
  email: 'werner.mueller@demo.app',
  notes: 'Demenz Anfangsphase — feste Routinen wichtig.',
  visibility: 'team',
  ownedByProfileId: 'profile-admin-001',
  sharedWithProfileIds: ['profile-employee-001'],
  auditEntries: [
    { id: 'audit-wm-1', action: 'Risikoeinschätzung', actorName: 'Dr. Lisa Pflege', timestamp: daysAgo(14), details: 'Sturzrisiko hoch' },
  ],
  history: [
    { id: 'hist-wm-1', icon: '⚠️', title: 'Sturzvorfall dokumentiert', subtitle: 'Keine schweren Verletzungen', timestamp: daysAgo(21), status: 'in_bearbeitung', actorName: 'Thomas Keller' },
  ],
  contextCounts: { assignments: 6, documents: 12, invoices: 5, appointments: 3 },
  nextActionHint: CLIENT_STATUS_HINTS.aktiv,
  allowedStatusActions: getAllowedStatusActions('aktiv'),
  lifecycleStatus: 'aktiv',
  core: {
    id: 'client-002',
    tenantId: DEMO_TENANT_ID,
    firstName: 'Werner',
    lastName: 'Müller',
    salutation: 'Herr',
    gender: 'männlich',
    dateOfBirth: '1942-11-08',
    lifecycleStatus: 'aktiv',
    insuranceNumber: 'B987654321',
    keySafeCode: '7392',
    diagnoses: ['Alzheimer Anfangsphase', 'Osteoporose', 'Herzinsuffizienz'],
    primaryContactPhone: '+49 30 44556677',
    city: 'Berlin',
    zip: '10437',
    sensitivity: 'health',
    visibility: 'team',
    ownedByProfileId: 'profile-admin-001',
    sharedWithProfileIds: ['profile-employee-001'],
    createdAt: daysAgo(400),
    updatedAt: now,
  },
  addresses: [
    {
      id: 'addr-wm-1', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      addressType: 'hauptwohnsitz', street: 'Prenzlauer Allee 88', zip: '10437', city: 'Berlin',
      country: 'DE', isPrimary: true, accessNotes: 'EG, Stufe am Eingang', floor: 'EG', doorCode: '1234',
      createdAt: daysAgo(400), updatedAt: now,
    },
  ],
  contacts: [
    {
      id: 'contact-wm-1', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      firstName: 'Klaus', lastName: 'Müller', relationship: 'kind', relationshipLabel: 'Sohn',
      phone: '+49 171 9876543', email: 'klaus.mueller@demo.app', isEmergency: true,
      isPortalUser: true,
      portalPermissions: { canViewAppointments: true, canViewDocuments: true, canViewCarePlan: true, canSendMessages: true, canViewBilling: true },
      notes: 'Hauptansprechpartner', createdAt: daysAgo(350), updatedAt: now,
    },
    {
      id: 'contact-wm-2', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      firstName: 'Ingrid', lastName: 'Müller', relationship: 'ehepartner', relationshipLabel: 'Ehefrau',
      phone: '+49 30 44556677', email: null, isEmergency: false, isPortalUser: false,
      portalPermissions: { canViewAppointments: false, canViewDocuments: false, canViewCarePlan: false, canSendMessages: false, canViewBilling: false },
      notes: 'Lebt im selben Haushalt', createdAt: daysAgo(350), updatedAt: now,
    },
  ],
  careLevels: [
    {
      id: 'cl-wm-1', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      grade: 'pg3', validFrom: '2025-01-15', validUntil: null,
      careFundName: 'Techniker Krankenkasse', careFundMemberId: 'B987654321',
      mdAssessmentDate: '2024-12-10', notes: 'Erhöhung von PG2 auf PG3',
      createdAt: daysAgo(150), updatedAt: now,
    },
  ],
  budgets: [
    {
      id: 'bud-wm-1', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      budgetType: 'paragraph_45b', year: 2026, totalAmountCents: 13100_00, usedAmountCents: 8900_00, reservedAmountCents: 1200_00,
      validFrom: '2026-01-01', validUntil: '2026-12-31', notes: null,
      createdAt: daysAgo(90), updatedAt: now,
    },
    {
      id: 'bud-wm-2', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      budgetType: 'verhinderungspflege', year: 2026, totalAmountCents: 3539_00, usedAmountCents: 1800_00, reservedAmountCents: 0,
      validFrom: '2026-01-01', validUntil: '2026-12-31', notes: '2 Wochen Verhinderungspflege im März',
      createdAt: daysAgo(90), updatedAt: now,
    },
  ],
  billingProfile: {
    id: 'bill-wm-1', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
    billingType: 'kombi', hourlyRateCents: 4200, serviceType: 'sachleistung',
    invoiceRecipient: 'Techniker Krankenkasse', paymentTermsDays: 30,
    costBearerName: 'TK', costBearerReference: 'IK 109303301',
    notes: 'Kombiabrechnung Sachleistung + §45b', createdAt: daysAgo(350), updatedAt: now,
  },
  contracts: [
    {
      id: 'contract-wm-1', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      contractNumber: 'PV-2025-0018', contractStart: '2025-02-01', contractEnd: null,
      serviceType: 'sachleistung', hourlyRateCents: 4200, weeklyHours: 10,
      status: 'aktiv', signedAt: daysAgo(150), documentId: 'doc-wm-contract',
      notes: 'Körperpflege und Grundpflege', createdAt: daysAgo(150), updatedAt: now,
    },
  ],
  preferences: {
    id: 'pref-wm-1', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
    preferredShifts: ['morgens'],
    preferredEmployeeIds: ['employee-003'],
    excludedEmployeeIds: ['employee-004'],
    language: 'de', mobilityNotes: 'Rollstuhl für längere Strecken',
    householdNotes: 'Ehefrau Ingrid unterstützt bei kleinen Aufgaben',
    petNotes: null,
    accessInstructions: 'Türklingel defekt — bitte klopfen',
    createdAt: daysAgo(350), updatedAt: now,
  },
  risks: [
    {
      id: 'risk-wm-1', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      category: 'sturz', level: 'hoch', description: 'Sturzvorfall vor 3 Wochen, Osteoporose',
      mitigation: 'Sturzprotokoll führen, Haltegriffe im Bad', assessedAt: daysAgo(14), assessedBy: 'Dr. Lisa Pflege',
      createdAt: daysAgo(14), updatedAt: now,
    },
    {
      id: 'risk-wm-2', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      category: 'verhalten', level: 'mittel', description: 'Orientierungsprobleme, Verwirrtheit am Abend',
      mitigation: 'Feste Routinen, ruhige Abendatmosphäre', assessedAt: daysAgo(14), assessedBy: 'Dr. Lisa Pflege',
      createdAt: daysAgo(14), updatedAt: now,
    },
    {
      id: 'risk-wm-3', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      category: 'medikation', level: 'hoch', description: 'Mehrfachmedikation, Herzinsuffizienz',
      mitigation: 'Medikamentenplan an Wand, Arzt informieren bei Abweichungen', assessedAt: daysAgo(14), assessedBy: 'Dr. Lisa Pflege',
      createdAt: daysAgo(14), updatedAt: now,
    },
  ],
  emergencyPlan: {
    id: 'em-wm-1', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
    emergencyContactName: 'Klaus Müller', emergencyContactPhone: '+49 171 9876543',
    emergencyContactRelation: 'Sohn', doctorName: 'Dr. Sandra Hoffmann', doctorPhone: '+49 30 7788990',
    hospitalPreference: 'Vivantes Klinikum Am Urban', allergies: ['Penicillin'],
    medications: ['Donepezil 10mg', 'Furosemid 40mg', 'Calcium/Vitamin D'],
    specialInstructions: 'Bei Verwirrtheit ruhig sprechen, keine hektischen Bewegungen', dnrStatus: false,
    createdAt: daysAgo(350), updatedAt: now,
  },
  consents: [
    {
      id: 'consent-wm-1', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      consentType: 'datenschutz', title: 'Datenschutzerklärung', scope: 'team',
      granted: true, grantedAt: daysAgo(350), expiresAt: null, grantedByProfileId: 'profile-admin-001',
      documentId: null, notes: null, createdAt: daysAgo(350), updatedAt: now,
    },
    {
      id: 'consent-wm-2', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      consentType: 'medizinische_daten', title: 'Medizinische Daten', scope: 'team',
      granted: true, grantedAt: daysAgo(350), expiresAt: null, grantedByProfileId: 'profile-admin-001',
      documentId: null, notes: 'Erforderlich für PG3-Leistungen', createdAt: daysAgo(350), updatedAt: now,
    },
    {
      id: 'consent-wm-3', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      consentType: 'portal_angehoerige', title: 'Portal-Zugang Angehörige', scope: 'shared',
      granted: true, grantedAt: daysAgo(60), expiresAt: null, grantedByProfileId: 'profile-admin-001',
      documentId: null, notes: null, createdAt: daysAgo(60), updatedAt: now,
    },
    {
      id: 'consent-wm-4', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      consentType: 'tracking', title: 'Standort-Tracking (Assist)', scope: 'team',
      granted: false, grantedAt: null, expiresAt: null, grantedByProfileId: null,
      documentId: null, notes: 'Noch nicht erteilt', createdAt: daysAgo(30), updatedAt: now,
    },
    {
      id: 'consent-wm-5', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      consentType: 'vertrag', title: 'Pflegevertrag', scope: 'team',
      granted: true, grantedAt: daysAgo(150), expiresAt: null, grantedByProfileId: 'profile-admin-001',
      documentId: 'doc-wm-contract', notes: null, createdAt: daysAgo(150), updatedAt: now,
    },
  ],
  portalAccess: [
    {
      id: 'portal-wm-1', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      contactId: 'contact-wm-1', email: 'klaus.mueller@demo.app', status: 'aktiv',
      lastLoginAt: daysAgo(1), invitedAt: daysAgo(60),
      modulesEnabled: ['appointments', 'messages', 'documents', 'careplan', 'billing'],
      twoFactorEnabled: true, createdAt: daysAgo(60), updatedAt: now,
    },
  ],
  documents: [
    {
      id: 'doc-wm-contract', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      title: 'Pflegevertrag PG3', fileName: 'pflegevertrag-mueller.pdf', mimeType: 'application/pdf',
      category: 'vertrag', storagePath: '/demo/docs/pflegevertrag-mueller.pdf', status: 'aktiv',
      sensitivity: 'care', uploadedBy: 'profile-admin-001', validUntil: null,
      createdAt: daysAgo(150), updatedAt: now,
    },
    {
      id: 'doc-wm-md', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      title: 'MD-Gutachten PG3', fileName: 'md-gutachten-mueller.pdf', mimeType: 'application/pdf',
      category: 'md_gutachten', storagePath: '/demo/docs/md-mueller.pdf', status: 'aktiv',
      sensitivity: 'health', uploadedBy: 'profile-admin-001', validUntil: '2028-01-15',
      createdAt: daysAgo(150), updatedAt: now,
    },
    {
      id: 'doc-wm-arzt', tenantId: DEMO_TENANT_ID, clientId: 'client-002',
      title: 'Arztbrief Neurologie', fileName: 'arztbrief-mueller.pdf', mimeType: 'application/pdf',
      category: 'arztbrief', storagePath: '/demo/docs/arztbrief-mueller.pdf', status: 'aktiv',
      sensitivity: 'health', uploadedBy: 'profile-admin-001', validUntil: null,
      createdAt: daysAgo(90), updatedAt: now,
    },
  ],
  tasks: [
    { id: 'task-wm-1', tenantId: DEMO_TENANT_ID, clientId: 'client-002', category: 'koerperpflege', title: 'Ganzkörperwäsche', description: 'Dienstags und Freitags', frequency: 'zweimal_wöchentlich', durationMinutes: 45, isActive: true, catalogTaskId: 'task-koerper-1', assignedEmployeeIds: ['employee-003'], createdAt: daysAgo(100), updatedAt: now },
    { id: 'task-wm-2', tenantId: DEMO_TENANT_ID, clientId: 'client-002', category: 'mobilisation', title: 'Transfer Bett-Stuhl', description: null, frequency: 'taeglich', durationMinutes: 15, isActive: true, catalogTaskId: 'task-mobil-1', assignedEmployeeIds: ['employee-003'], createdAt: daysAgo(100), updatedAt: now },
    { id: 'task-wm-3', tenantId: DEMO_TENANT_ID, clientId: 'client-002', category: 'medikation', title: 'Medikamentengabe', description: 'Morgenmedikation', frequency: 'taeglich', durationMinutes: 10, isActive: true, catalogTaskId: 'task-med-1', assignedEmployeeIds: ['employee-003'], createdAt: daysAgo(100), updatedAt: now },
    { id: 'task-wm-4', tenantId: DEMO_TENANT_ID, clientId: 'client-002', category: 'ernaehrung', title: 'Essen anreichen', description: 'Mittagessen', frequency: 'taeglich', durationMinutes: 30, isActive: true, catalogTaskId: 'task-ernaehr-2', assignedEmployeeIds: ['employee-003'], createdAt: daysAgo(100), updatedAt: now },
    { id: 'task-wm-5', tenantId: DEMO_TENANT_ID, clientId: 'client-002', category: 'haushalt', title: 'Geschirr spülen', description: null, frequency: 'taeglich', durationMinutes: 15, isActive: true, catalogTaskId: 'task-haushalt-3', assignedEmployeeIds: [], createdAt: daysAgo(100), updatedAt: now },
  ],
  timeline: [
    { id: 'tl-wm-1', clientId: 'client-002', eventType: 'einsatz', icon: '⚠️', title: 'Sturzvorfall dokumentiert', subtitle: 'Im Badezimmer, keine schweren Verletzungen', timestamp: daysAgo(21), status: 'in_bearbeitung', actorName: 'Thomas Keller', isInternal: false, metadata: null },
    { id: 'tl-wm-2', clientId: 'client-002', eventType: 'pflegeplan', icon: '📋', title: 'Pflegeplan angepasst', subtitle: 'Sturzprotokoll ergänzt', timestamp: daysAgo(14), status: 'aktiv', actorName: 'Dr. Lisa Pflege', isInternal: false, metadata: null },
    { id: 'tl-wm-3', clientId: 'client-002', eventType: 'notiz', icon: '📝', title: 'Interne Notiz', subtitle: 'Abends zunehmende Verwirrtheit', timestamp: daysAgo(7), status: 'aktiv', actorName: 'Thomas Keller', isInternal: true, metadata: null },
    { id: 'tl-wm-4', clientId: 'client-002', eventType: 'status', icon: '🔄', title: 'Pflegegrad erhöht', subtitle: 'PG2 → PG3', timestamp: daysAgo(150), status: 'aktiv', actorName: 'Sabine Muster', isInternal: false, metadata: null },
  ],
  internalNotes: [
    { id: 'note-wm-1', clientId: 'client-002', tenantId: DEMO_TENANT_ID, content: 'Demenz Anfangsphase — feste Routinen und vertraute Bezugsperson wichtig.', isInternal: true, createdBy: 'Sabine Muster', createdAt: daysAgo(100), updatedAt: daysAgo(100), category: 'gesundheit' },
    { id: 'note-wm-2', clientId: 'client-002', tenantId: DEMO_TENANT_ID, content: 'Sturzvorfall 21.05. — Protokoll liegt im Pflegeplan.', isInternal: true, createdBy: 'Thomas Keller', createdAt: daysAgo(21), updatedAt: daysAgo(21), category: 'gesundheit' },
    { id: 'note-wm-3', clientId: 'client-002', tenantId: DEMO_TENANT_ID, content: 'Mitarbeiterin Schmidt (employee-004) von Einsätzen ausgeschlossen — Vertrauensproblem.', isInternal: true, createdBy: 'Sabine Muster', createdAt: daysAgo(50), updatedAt: daysAgo(50), category: 'einsatz' },
    { id: 'note-wm-4', clientId: 'client-002', tenantId: DEMO_TENANT_ID, content: 'Sohn Klaus wünscht wöchentlichen E-Mail-Bericht.', isInternal: true, createdBy: 'Sabine Muster', createdAt: daysAgo(30), updatedAt: daysAgo(30), category: 'portal' },
  ],
};
