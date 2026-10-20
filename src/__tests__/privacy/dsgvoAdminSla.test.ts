import { describe, expect, it } from 'vitest';
import { dataSubjectRequestsDemo } from '@/data/demo/dataSubjectRequestsDemo';
import { exportDataSubjectRequestsForAdmin } from '@/lib/privacy/dataSubjectRequestAdminService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  buildDataSubjectRequestsAdminCsv,
  computeDataSubjectRequestDeadline,
  countOverdueDataSubjectRequests,
  DSGVO_ART12_RESPONSE_DAYS,
  getDataSubjectRequestDeadlineInfo,
} from '@/lib/privacy/dataSubjectRequestSla';
import type { DataSubjectRequest } from '@/lib/privacy/dataSubjectRequest.types';

describe('DSGVO Admin SLA (Sprint 59)', () => {
  it('berechnet Frist aus Eingang + Art.-12-SLA-Tage', () => {
    const received = '2026-01-01T10:00:00.000Z';
    const deadline = computeDataSubjectRequestDeadline(received);
    const expected = new Date(new Date(received).getTime() + DSGVO_ART12_RESPONSE_DAYS * 86400000);
    expect(deadline.toISOString()).toBe(expected.toISOString());
  });

  it('markiert offene Anfrage als überfällig nach SLA', () => {
    const overdue: DataSubjectRequest = {
      ...dataSubjectRequestsDemo[0],
      status: 'queued',
      receivedAt: '2025-01-01T00:00:00.000Z',
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    const info = getDataSubjectRequestDeadlineInfo(overdue, new Date('2026-06-14T12:00:00.000Z'));
    expect(info.status).toBe('overdue');
    expect(info.daysRemaining).toBeLessThan(0);
  });

  it('markiert bald ablaufende Frist als due_soon', () => {
    const soon: DataSubjectRequest = {
      ...dataSubjectRequestsDemo[1],
      status: 'running',
      receivedAt: '2026-05-20T00:00:00.000Z',
      createdAt: '2026-05-20T00:00:00.000Z',
    };
    const info = getDataSubjectRequestDeadlineInfo(soon, new Date('2026-06-14T12:00:00.000Z'));
    expect(info.status).toBe('due_soon');
    expect(info.daysRemaining).toBeGreaterThanOrEqual(0);
    expect(info.daysRemaining).toBeLessThanOrEqual(7);
  });

  it('zählt überfällige offene Anfragen in Demo-Liste', () => {
    expect(countOverdueDataSubjectRequests(dataSubjectRequestsDemo)).toBeGreaterThanOrEqual(1);
  });

  it('buildDataSubjectRequestsAdminCsv enthält Header und Semikolon-Spalten', () => {
    const csv = buildDataSubjectRequestsAdminCsv(dataSubjectRequestsDemo);
    expect(csv.split('\n')[0]).toContain('Anfragenummer;Typ;Status');
    expect(csv.split('\n').length).toBe(dataSubjectRequestsDemo.length + 1);
    expect(csv).toContain('DSR-2026-0041');
  });

  it('exportDataSubjectRequestsForAdmin ist preparedOnly im Demo-Modus', async () => {
    const result = await exportDataSubjectRequestsForAdmin(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Migration 0031');
    }
  });

  it('exportDataSubjectRequestsForAdmin verweigert ohne security.view', async () => {
    const result = await exportDataSubjectRequestsForAdmin(DEMO_TENANT_ID, 'client_portal');
    expect(result.ok).toBe(false);
  });
});
