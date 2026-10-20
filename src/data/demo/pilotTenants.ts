import type { Tenant, TenantAddress, TenantContact } from '@/types';
import type { PilotTenantId } from '@/lib/pilot/pilotConfig';

export type PilotAmbulantTenant = Tenant & {
  pilotId: PilotTenantId;
  region: string;
  clientCount: number;
  employeeCount: number;
  assignmentCount: number;
  invoiceSampleNumber: string;
};

export const pilotAmbulantTenants: PilotAmbulantTenant[] = [
  {
    pilotId: 'tenant-pilot-ambulant-001',
    id: 'tenant-pilot-ambulant-001',
    name: 'SonnenPflege Ambulant Köln',
    slug: 'sonnenpflege-koeln',
    legalForm: 'GmbH',
    industry: 'Ambulanter Pflegedienst',
    phone: '+49 221 9876543',
    email: 'info@sonnenpflege-koeln.de',
    website: 'https://sonnenpflege-koeln.de',
    region: 'NRW — Köln',
    clientCount: 48,
    employeeCount: 22,
    assignmentCount: 156,
    invoiceSampleNumber: 'RE-PILOT-001-0341',
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-06-10T14:00:00.000Z',
  },
  {
    pilotId: 'tenant-pilot-ambulant-002',
    id: 'tenant-pilot-ambulant-002',
    name: 'Herzlich Zuhause Pflege Düsseldorf',
    slug: 'herzlich-zuhause-duesseldorf',
    legalForm: 'UG',
    industry: 'Ambulanter Pflegedienst',
    phone: '+49 211 4455667',
    email: 'kontakt@herzlich-zuhause.de',
    website: 'https://herzlich-zuhause.de',
    region: 'NRW — Düsseldorf',
    clientCount: 31,
    employeeCount: 14,
    assignmentCount: 89,
    invoiceSampleNumber: 'RE-PILOT-002-0128',
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-06-11T09:30:00.000Z',
  },
  {
    pilotId: 'tenant-pilot-ambulant-003',
    id: 'tenant-pilot-ambulant-003',
    name: 'PflegeEngel Bonn',
    slug: 'pflegeengel-bonn',
    legalForm: 'e.K.',
    industry: 'Ambulanter Pflegedienst',
    phone: '+49 228 7788990',
    email: 'team@pflegeengel-bonn.de',
    website: 'https://pflegeengel-bonn.de',
    region: 'NRW — Bonn',
    clientCount: 19,
    employeeCount: 9,
    assignmentCount: 42,
    invoiceSampleNumber: 'RE-PILOT-003-0055',
    createdAt: '2026-05-15T08:00:00.000Z',
    updatedAt: '2026-06-12T11:00:00.000Z',
  },
];

export const pilotTenantAddresses: Record<PilotTenantId, TenantAddress> = {
  'tenant-pilot-ambulant-001': {
    id: 'addr-pilot-001',
    tenantId: 'tenant-pilot-ambulant-001',
    street: 'Rheinuferstraße 45',
    zip: '50679',
    city: 'Köln',
    state: 'NRW',
    country: 'Deutschland',
    createdAt: '2026-04-01T08:00:00.000Z',
  },
  'tenant-pilot-ambulant-002': {
    id: 'addr-pilot-002',
    tenantId: 'tenant-pilot-ambulant-002',
    street: 'Königsallee 12',
    zip: '40212',
    city: 'Düsseldorf',
    state: 'NRW',
    country: 'Deutschland',
    createdAt: '2026-05-01T08:00:00.000Z',
  },
  'tenant-pilot-ambulant-003': {
    id: 'addr-pilot-003',
    tenantId: 'tenant-pilot-ambulant-003',
    street: 'Markt 8',
    zip: '53111',
    city: 'Bonn',
    state: 'NRW',
    country: 'Deutschland',
    createdAt: '2026-05-15T08:00:00.000Z',
  },
};

export const pilotTenantContacts: Record<PilotTenantId, TenantContact> = {
  'tenant-pilot-ambulant-001': {
    id: 'contact-pilot-001',
    tenantId: 'tenant-pilot-ambulant-001',
    firstName: 'Martina',
    lastName: 'Keller',
    role: 'PDL / Geschäftsführung',
    phone: '+49 221 9876544',
    email: 'martina.keller@sonnenpflege-koeln.de',
    isPrimary: true,
    createdAt: '2026-04-01T08:00:00.000Z',
  },
  'tenant-pilot-ambulant-002': {
    id: 'contact-pilot-002',
    tenantId: 'tenant-pilot-ambulant-002',
    firstName: 'Thomas',
    lastName: 'Weber',
    role: 'Pflegedienstleitung',
    phone: '+49 211 4455668',
    email: 't.weber@herzlich-zuhause.de',
    isPrimary: true,
    createdAt: '2026-05-01T08:00:00.000Z',
  },
  'tenant-pilot-ambulant-003': {
    id: 'contact-pilot-003',
    tenantId: 'tenant-pilot-ambulant-003',
    firstName: 'Anna',
    lastName: 'Schmidt',
    role: 'Inhaberin',
    phone: '+49 228 7788991',
    email: 'anna.schmidt@pflegeengel-bonn.de',
    isPrimary: true,
    createdAt: '2026-05-15T08:00:00.000Z',
  },
};

export function getPilotTenantById(tenantId: string): PilotAmbulantTenant | null {
  return pilotAmbulantTenants.find((t) => t.id === tenantId) ?? null;
}

export function getPilotTenantSummary(): { totalClients: number; totalEmployees: number; activeTenants: number } {
  return {
    totalClients: pilotAmbulantTenants.reduce((sum, t) => sum + t.clientCount, 0),
    totalEmployees: pilotAmbulantTenants.reduce((sum, t) => sum + t.employeeCount, 0),
    activeTenants: pilotAmbulantTenants.length,
  };
}
