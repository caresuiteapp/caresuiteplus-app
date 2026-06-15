import type { SisAssessment } from '@/types/modules/pflege';
import { demoClients } from './clients';
import { demoEmployees } from './employees';
import { DEMO_TENANT_ID } from './tenant';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

const STATUSES: SisAssessment['status'][] = ['aktiv', 'in_bearbeitung', 'entwurf', 'aktiv', 'fehlerhaft'];

function buildSisSeeds(): SisAssessment[] {
  const clients = demoClients.slice(0, 12);
  const assessors = demoEmployees.slice(0, 4);

  return clients.map((client, i) => {
    const assessor = assessors[i % assessors.length]!;
    const assessedAt = daysAgo(5 + i * 7);
    return {
      id: `sis-${String(i + 1).padStart(3, '0')}`,
      tenantId: DEMO_TENANT_ID,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      assessedAt,
      overallScore: 55 + (i % 30),
      status: STATUSES[i % STATUSES.length]!,
      nextReviewAt: i % 4 === 3 ? null : daysFromNow(10 + i * 5),
      assessorName: `${assessor.firstName} ${assessor.lastName}`,
      createdAt: assessedAt,
      updatedAt: daysAgo(i % 5),
      visibility: 'team',
      sensitivity: i % 2 === 0 ? 'care' : 'health',
    };
  });
}

const INITIAL = buildSisSeeds();
let sisStore: SisAssessment[] = INITIAL.map((s) => ({ ...s }));

export function getDemoSisAssessments(): SisAssessment[] {
  return sisStore.map((item) => ({ ...item }));
}

export function getDemoSisById(id: string): SisAssessment | null {
  const item = sisStore.find((s) => s.id === id);
  return item ? { ...item } : null;
}

export function createDemoSisAssessment(input: {
  clientId: string;
  clientName: string;
  assessorName: string;
}): SisAssessment {
  const now = new Date().toISOString();
  const item: SisAssessment = {
    id: `sis-${Date.now()}`,
    tenantId: DEMO_TENANT_ID,
    clientId: input.clientId,
    clientName: input.clientName,
    assessedAt: now,
    overallScore: 0,
    status: 'entwurf',
    nextReviewAt: daysFromNow(90),
    assessorName: input.assessorName,
    createdAt: now,
    updatedAt: now,
    visibility: 'team',
    sensitivity: 'care',
  };
  sisStore = [item, ...sisStore];
  return { ...item };
}

export function syncDemoSisReviewDeadline(id: string): SisAssessment | null {
  const idx = sisStore.findIndex((entry) => entry.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const synced: SisAssessment = {
    ...sisStore[idx]!,
    nextReviewAt: daysFromNow(90),
    updatedAt: now,
  };
  sisStore[idx] = synced;
  return { ...synced };
}

export function countDueSisReviews(): number {
  const now = Date.now();
  const in14Days = now + 14 * 86_400_000;
  return sisStore.filter((s) => s.nextReviewAt && new Date(s.nextReviewAt).getTime() <= in14Days).length;
}
