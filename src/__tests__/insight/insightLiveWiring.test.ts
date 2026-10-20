import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  countInsightDataSourcesReady,
  countInsightLiveFlipBlockersRemaining,
  getInsightLiveFlipBlockers,
  INSIGHT_DATA_SOURCE_REGISTRY,
  INSIGHT_LIVE_REQUIRED_MIGRATION,
  INSIGHT_SNAPSHOTS_TABLE,
  isInsightLiveReady,
  isInsightLiveWiringPrepared,
  mapInsightSnapshotRow,
} from '@/lib/insight';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('InsightCenter Live Wiring Prep (Sprint 98)', () => {
  it('isInsightLiveReady bleibt ehrlich false', () => {
    expect(isInsightLiveReady()).toBe(false);
  });

  it('isInsightLiveWiringPrepared ist true (Schema-Prep vorhanden)', () => {
    expect(isInsightLiveWiringPrepared()).toBe(true);
  });

  it('insightLiveRepository definiert Tabellen und SELECT-Spalten', () => {
    const repo = readSrc('src/lib/insight/insightLiveRepository.ts');
    expect(repo).toContain(INSIGHT_SNAPSHOTS_TABLE);
    expect(repo).toContain(INSIGHT_LIVE_REQUIRED_MIGRATION);
  });

  it('Migration 0035 InsightCenter existiert', () => {
    expect(
      fs.existsSync(path.join(process.cwd(), 'supabase/migrations/0035_insight_center_prepared.sql')),
    ).toBe(true);
  });

  it('INSIGHT_DATA_SOURCE_REGISTRY listet Modul-Feeds', () => {
    expect(INSIGHT_DATA_SOURCE_REGISTRY.length).toBeGreaterThanOrEqual(5);
    expect(countInsightDataSourcesReady()).toBe(0);
  });

  it('mapInsightSnapshotRow mappt Live-Zeilen', () => {
    const mapped = mapInsightSnapshotRow({
      id: 'snap-1',
      tenant_id: 't1',
      title: 'Office KPIs',
      module_label: 'Office',
      updated_at: '2026-06-14T10:00:00.000Z',
    });
    expect(mapped.title).toBe('Office KPIs');
    expect(mapped.moduleLabel).toBe('Office');
  });

  it('getInsightLiveFlipBlockers listet offene Blocker (Sprint 116)', () => {
    const blockers = getInsightLiveFlipBlockers();
    expect(blockers.length).toBeGreaterThanOrEqual(4);
    expect(countInsightLiveFlipBlockersRemaining()).toBeGreaterThan(0);
  });
});
