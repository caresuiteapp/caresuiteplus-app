import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  emptyPdlCockpitSnapshot,
  mapPdlCockpitRow,
  type PdlCockpitLiveRow,
} from '@/lib/reporting/pdlCockpitMapper';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('reporting_pdl_cockpit live mapping (Sprint 36)', () => {
  const completeRow: PdlCockpitLiveRow = {
    tenant_id: DEMO_TENANT_ID,
    kpis: [
      {
        id: 'pdl-kpi-coverage',
        label: 'Einsatzabdeckung',
        value: '94%',
        subValue: 'Diese Woche',
        icon: '📅',
        accentColor: '#62F3FF',
        trend: 'up',
        trendValue: '+3%',
      },
    ],
    open_tasks: [
      {
        id: 'task-001',
        title: 'Pflegeplan-Review',
        priority: 'high',
        dueDate: '2026-06-13',
        assignee: 'Dr. Anna Krüger',
      },
    ],
    risks: [
      {
        id: 'risk-001',
        label: 'Unterbesetzung Assist-Team',
        severity: 'critical',
        hint: '2 offene Schichten in KW 24',
      },
    ],
    generated_at: '2026-06-12T08:00:00.000Z',
    updated_at: '2026-06-12T08:00:00.000Z',
  };

  it('Migration 0111 erstellt reporting_pdl_cockpit idempotent für Live', () => {
    const sql = readSrc('supabase/migrations/0111_reporting_pdl_cockpit.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.reporting_pdl_cockpit');
    expect(sql).toContain('kpis');
    expect(sql).toContain('open_tasks');
    expect(sql).toContain('risks');
    expect(sql).toContain('GRANT SELECT');
    expect(sql).not.toMatch(/^\s*DROP TABLE\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });

  it('Migration 0029 erstellt reporting_pdl_cockpit mit IF NOT EXISTS', () => {
    const sql = readSrc('supabase/migrations/0029_reporting_pdl_cockpit_live.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.reporting_pdl_cockpit');
    expect(sql).toContain('kpis');
    expect(sql).toContain('open_tasks');
    expect(sql).toContain('risks');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });

  it('mapPdlCockpitRow mappt vollständige Zeile', () => {
    const result = mapPdlCockpitRow(completeRow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.kpis.length).toBe(1);
      expect(result.data.openTasks[0]?.title).toBe('Pflegeplan-Review');
      expect(result.data.risks[0]?.severity).toBe('critical');
      expect(result.data.tenantId).toBe(DEMO_TENANT_ID);
    }
  });

  it('mapPdlCockpitRow meldet fehlendes Schema ehrlich', () => {
    const incomplete: PdlCockpitLiveRow = {
      tenant_id: DEMO_TENANT_ID,
      kpis: [],
    };
    const result = mapPdlCockpitRow(incomplete);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Schema unvollständig');
      expect(result.error).toContain('open_tasks');
    }
  });

  it('emptyPdlCockpitSnapshot liefert leeren Live-Zustand', () => {
    const snapshot = emptyPdlCockpitSnapshot(DEMO_TENANT_ID);
    expect(snapshot.kpis).toEqual([]);
    expect(snapshot.openTasks).toEqual([]);
    expect(snapshot.risks).toEqual([]);
    expect(snapshot.tenantId).toBe(DEMO_TENANT_ID);
  });

  it('reportingRepository nutzt getCockpitMapped', () => {
    const source = readSrc('src/lib/services/repositories/reportingRepository.supabase.ts');
    expect(source).toContain('getCockpitMapped');
    expect(source).toContain('PDL_COCKPIT_SELECT_COLUMNS');
    expect(source).toContain('isSupabaseMissingTableError');
  });

  it('fetchPdlCockpit nutzt Supabase-Repo ohne Demo-Fallback in Live-Pfad', () => {
    const source = readSrc('src/lib/reporting/reportingService.ts');
    expect(source).toContain('getCockpitMapped');
    expect(source).toMatch(
      /fetchPdlCockpit[\s\S]*getServiceMode\(\) === 'supabase'[\s\S]*getCockpitMapped/,
    );
    expect(source).toContain('guardServiceTenant');
  });

  it('usePdlCockpit nutzt useServiceTenantId', () => {
    const source = readSrc('src/hooks/usePdlCockpit.ts');
    expect(source).toContain('useServiceTenantId');
    expect(source).not.toMatch(/REPORTING_DEMO_TENANT/);
  });
});
