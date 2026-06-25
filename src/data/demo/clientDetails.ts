import type { ClientDetail } from '@/types/detail';
import type { ClientListItem } from '@/types/modules/office';
import { getDemoClientFullDetail } from '@/data/demo/clients';
import {
  CLIENT_STATUS_HINTS,
  getAllowedStatusActions,
} from '@/lib/services/workflow/clientStatus';
import { demoClients } from './clients';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function buildDetail(base: ClientListItem): ClientDetail {
  return {
    ...base,
    createdAt: daysAgo(90),
    dateOfBirth: '1948-03-15',
    admissionDate: daysAgo(60),
    primaryContactPhone: '+49 30 98765432',
    street: 'Musterstraße 12',
    phone: '+49 30 98765432',
    email: `${base.firstName.toLowerCase()}.${base.lastName.toLowerCase()}@demo.app`,
    notes: 'Allergien: keine bekannt. Schlüssel beim Hausmeister.',
    visibility: base.sensitivity === 'restricted' ? 'own' : 'team',
    ownedByProfileId: 'profile-admin-001',
    sharedWithProfileIds: base.sensitivity === 'health' ? ['profile-employee-001'] : [],
    contacts: [
      {
        id: `contact-${base.id}-1`,
        name: 'Angehörige:r Mustermann',
        relationship: 'Tochter',
        phone: '+49 170 1234567',
        email: 'tochter@demo.app',
        isEmergency: true,
      },
    ],
    consents: [
      {
        id: `consent-${base.id}-1`,
        title: 'Portal-Zugang Klient:in',
        scope: 'own',
        granted: base.status === 'aktiv' || base.status === 'in_bearbeitung',
        grantedAt: base.status === 'entwurf' ? null : daysAgo(30),
        expiresAt: null,
      },
      {
        id: `consent-${base.id}-2`,
        title: 'Datenfreigabe Angehörige',
        scope: 'shared',
        granted: base.id !== 'client-009',
        grantedAt: base.id === 'client-009' ? null : daysAgo(14),
        expiresAt: daysAgo(-180),
      },
    ],
    auditEntries: [
      {
        id: `audit-${base.id}-1`,
        action: 'Stammdaten aktualisiert',
        actorName: 'Sabine Muster',
        timestamp: daysAgo(2),
        details: 'Adresse und Pflegegrad geprüft',
      },
      {
        id: `audit-${base.id}-2`,
        action: 'Status geändert',
        actorName: 'Sabine Muster',
        timestamp: daysAgo(7),
        details: `Neuer Status: ${base.status}`,
      },
    ],
    history: [
      {
        id: `hist-${base.id}-1`,
        icon: '📅',
        title: 'Einsatz dokumentiert',
        subtitle: 'Alltagsbegleitung 2 Std.',
        timestamp: daysAgo(1),
        status: 'abgeschlossen',
        actorName: 'Thomas Keller',
      },
      {
        id: `hist-${base.id}-2`,
        icon: '📄',
        title: 'Pflegeplan aktualisiert',
        timestamp: daysAgo(5),
        status: 'in_bearbeitung',
        actorName: 'Sabine Muster',
      },
      {
        id: `hist-${base.id}-3`,
        icon: '🧾',
        title: 'Rechnung erstellt',
        subtitle: 'RE-2026-0341',
        timestamp: daysAgo(10),
        status: 'entwurf',
        actorName: 'Sabine Muster',
      },
    ],
    contextCounts: {
      assignments: base.status === 'archiviert' ? 0 : 4,
      documents: 7,
      invoices: 3,
      appointments: 2,
    },
    nextActionHint: CLIENT_STATUS_HINTS[base.status],
    allowedStatusActions: getAllowedStatusActions(base.status),
  };
}

const detailMap = new Map(demoClients.map((c) => [c.id, buildDetail(c)]));

/** Session-Store für Demo — WP 006 kann neue Klient:innen hinzufügen */
let sessionListItems: ClientListItem[] = [...demoClients];
let sessionDetails = new Map(detailMap);

export function getDemoClientListItems(): ClientListItem[] {
  return sessionListItems;
}

export function getDemoClientDetail(id: string): ClientDetail | null {
  const full = getDemoClientFullDetail(id);
  if (full) {
    const { core: _core, lifecycleStatus: _ls, addresses: _a, contacts: _c, careLevels: _cl,
      budgets: _b, billingProfile: _bp, contracts: _co, preferences: _p, risks: _r,
      emergencyPlan: _e, consents: _cons, portalAccess: _pa, documents: _d, tasks: _t,
      timeline: _tl, internalNotes: _n, ...detail } = full;
    return {
      ...detail,
      contacts: full.contacts.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        relationship: c.relationshipLabel ?? c.relationship,
        phone: c.phone,
        email: c.email,
        isEmergency: c.isEmergency,
      })),
      consents: full.consents.map((c) => ({
        id: c.id,
        title: c.title,
        scope: c.scope,
        granted: c.granted,
        grantedAt: c.grantedAt,
        expiresAt: c.expiresAt,
      })),
    };
  }
  return sessionDetails.get(id) ?? null;
}

export function addDemoClient(item: ClientListItem, detail: ClientDetail): void {
  sessionListItems = [item, ...sessionListItems];
  sessionDetails.set(item.id, detail);
}

export function updateDemoClientDetail(detail: ClientDetail): void {
  sessionDetails.set(detail.id, detail);
  sessionListItems = sessionListItems.map((item) =>
    item.id === detail.id
      ? {
          id: detail.id,
          tenantId: detail.tenantId,
          firstName: detail.firstName,
          lastName: detail.lastName,
          status: detail.status,
          careLevel: detail.careLevel,
          city: detail.city ?? null,
          zip: detail.zip ?? null,
          sensitivity: detail.sensitivity,
          updatedAt: detail.updatedAt,
        }
      : item,
  );
}

export function resetDemoClientStore(): void {
  sessionListItems = [...demoClients];
  sessionDetails = new Map(demoClients.map((c) => [c.id, buildDetail(c)]));
}
