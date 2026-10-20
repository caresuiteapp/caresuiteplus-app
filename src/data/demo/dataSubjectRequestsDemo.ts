import { DEMO_TENANT_ID } from './tenant';
import type { DataSubjectRequest } from '@/lib/privacy/dataSubjectRequest.types';

const now = new Date();
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

/** Demo-Betroffenenanfragen für Admin-Listenansicht. */
export const dataSubjectRequestsDemo: DataSubjectRequest[] = [
  {
    id: 'dsr-demo-001',
    tenantId: DEMO_TENANT_ID,
    profileId: 'profile-admin-001',
    requestType: 'access',
    status: 'queued',
    requesterName: 'Sabine Muster',
    requesterEmail: 'admin@demo.caresuiteplus.app',
    verificationNotes: 'Identität per E-Mail bestätigt',
    requestNumber: 'DSR-2026-0041',
    receivedAt: daysAgo(35),
    createdAt: daysAgo(35),
    updatedAt: daysAgo(35),
  },
  {
    id: 'dsr-demo-002',
    tenantId: DEMO_TENANT_ID,
    profileId: null,
    requestType: 'deletion',
    status: 'running',
    requesterName: 'Erika Klient',
    requesterEmail: 'erika.klient@example.de',
    verificationNotes: null,
    requestNumber: 'DSR-2026-0038',
    receivedAt: daysAgo(26),
    createdAt: daysAgo(26),
    updatedAt: daysAgo(1),
  },
  {
    id: 'dsr-demo-003',
    tenantId: DEMO_TENANT_ID,
    profileId: 'profile-billing-001',
    requestType: 'export',
    status: 'completed',
    requesterName: 'Petra Lehmann',
    requesterEmail: 'petra.lehmann@demo.caresuiteplus.app',
    verificationNotes: 'Export bereitgestellt',
    requestNumber: 'DSR-2026-0029',
    receivedAt: daysAgo(14),
    createdAt: daysAgo(14),
    updatedAt: daysAgo(7),
  },
];

export function updateDemoDataSubjectRequestStatus(
  id: string,
  status: DataSubjectRequest['status'],
): DataSubjectRequest | null {
  const index = dataSubjectRequestsDemo.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const now = new Date().toISOString();
  dataSubjectRequestsDemo[index] = {
    ...dataSubjectRequestsDemo[index],
    status,
    updatedAt: now,
  };
  return { ...dataSubjectRequestsDemo[index] };
}
