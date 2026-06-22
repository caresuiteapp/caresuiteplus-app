import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildCommunicationListKpis } from '@/lib/communication/communicationListStats';
import { listThreads } from '@/features/communication/communication.service';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforceCommunicationPermission } from '@/features/communication/communication.permissions';
import { mapTripRowsToListItems } from '@/lib/assist/tripListMapper';
import type { TripLiveRow } from '@/lib/services/repositories/tripRepository.supabase';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Kommunikationszentrum list', () => {
  it('enforceCommunicationPermission schützt view_center', () => {
    expect(
      enforceCommunicationPermission(null, 'communication.view_center'),
    ).not.toBeNull();
  });

  it('listThreads liefert Demo-Threads für Business', async () => {
    const result = await listThreads(
      DEMO_TENANT_ID,
      { filter: 'all' },
      'business_admin',
      'profile-admin-001',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.title).toBeTruthy();
    }
  });

  it('buildCommunicationListKpis berechnet Kennzahlen', async () => {
    const result = await listThreads(
      DEMO_TENANT_ID,
      { filter: 'all' },
      'business_admin',
      'profile-admin-001',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kpis = buildCommunicationListKpis(result.data);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'comm-kpi-unread')).toBe(true);
  });

  it('CommunicationCenterListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/communication/CommunicationCenterListView.tsx');
    expect(source).toContain('MessageSearchBar');
    expect(source).toContain('ConversationFilterBar');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('CommunicationCenterListHero nutzt PremiumListHeroFrame', () => {
    const source = readSrc('src/components/communication/CommunicationCenterListHero.tsx');
    expect(source).toContain('PremiumListHeroFrame');
  });

  it('CommunicationAdaptiveScreen nutzt MasterDetailLayout mit Summary-Panel', () => {
    const source = readSrc('src/screens/communication/CommunicationAdaptiveScreen.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).toContain('ThreadDetailSummaryPanel');
  });

  it('CommunicationThreadListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/communication/CommunicationThreadListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('OfficeMessagesAdaptiveScreen bleibt auf Sprint-08 Summary-Pattern', () => {
    const source = readSrc('src/screens/office/OfficeMessagesAdaptiveScreen.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).toContain('OfficeMessageDetailSummaryPanel');
  });
});

describe('Live Trip list mapping', () => {
  const completeRow: TripLiveRow = {
    id: 'trip-001',
    tenant_id: DEMO_TENANT_ID,
    title: 'Einsatz → Klient Müller',
    status: 'in_bearbeitung',
    employee_name: 'Anna Schmidt',
    vehicle_label: 'VW Caddy CS-01',
    purpose: 'einsatz',
    started_at: '2026-06-14T08:00:00.000Z',
    ended_at: null,
    distance_km: 12.4,
    created_at: '2026-06-14T08:00:00.000Z',
    updated_at: '2026-06-14T08:30:00.000Z',
  };

  it('mapTripRowsToListItems mappt vollständige Zeilen', () => {
    const result = mapTripRowsToListItems([completeRow]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]?.employeeName).toBe('Anna Schmidt');
      expect(result.data[0]?.vehicleLabel).toBe('VW Caddy CS-01');
    }
  });

  it('mapTripRowsToListItems meldet unvollständiges Schema ehrlich', () => {
    const incomplete: TripLiveRow = {
      id: 'trip-002',
      tenant_id: DEMO_TENANT_ID,
      title: 'Nur Titel',
      status: 'entwurf',
      distance_km: 5,
      created_at: '2026-06-14T08:00:00.000Z',
      updated_at: '2026-06-14T08:00:00.000Z',
    };
    const result = mapTripRowsToListItems([incomplete]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Schema unvollständig');
      expect(result.error).toContain('employee_name');
    }
  });

  it('mapTripRowsToListItems überspringt Zeilen mit leeren Live-Feldern', () => {
    const incomplete: TripLiveRow = {
      id: 'trip-003',
      tenant_id: DEMO_TENANT_ID,
      title: 'Unvollständig',
      status: 'entwurf',
      employee_name: null,
      vehicle_label: null,
      purpose: null,
      started_at: null,
      distance_km: 5,
      created_at: '2026-06-14T08:00:00.000Z',
      updated_at: '2026-06-14T08:00:00.000Z',
    };
    const result = mapTripRowsToListItems([incomplete, completeRow]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe('trip-001');
    }
  });

  it('tripRepository nutzt TRIP_LIVE_SELECT_COLUMNS', () => {
    const source = readSrc('src/lib/services/repositories/tripRepository.supabase.ts');
    expect(source).toContain('TRIP_LIVE_SELECT_COLUMNS');
    const mapper = readSrc('src/lib/assist/tripListMapper.ts');
    expect(mapper).toContain('employee_name');
  });

  it('tripLogService nutzt Supabase-Repo ohne Demo-Fallback in Live-Pfad', () => {
    const source = readSrc('src/lib/assist/tripLogService.ts');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('tripSupabaseRepository');
    expect(source).toMatch(
      /fetchTripLogList[\s\S]*getServiceMode\(\) === 'supabase'[\s\S]*listMapped/,
    );
    expect(source).toMatch(
      /fetchTripDetail[\s\S]*getServiceMode\(\) === 'supabase'[\s\S]*getDetailMapped/,
    );
  });
});
