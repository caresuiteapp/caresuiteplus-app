import type { ServiceResult } from '@/types';
import type { DashboardKpi } from '@/types/dashboard';
import type { PdlCockpitSnapshot, PdlOpenTask, PdlRisk } from '@/types/reporting';

/** Spalten aus Migration 0029. */
export const PDL_COCKPIT_SELECT_COLUMNS =
  'tenant_id, kpis, open_tasks, risks, generated_at, updated_at';

export const PDL_COCKPIT_REQUIRED_FIELDS = ['kpis', 'open_tasks', 'risks', 'generated_at'] as const;

export type PdlCockpitLiveRow = {
  tenant_id: string;
  kpis?: unknown;
  open_tasks?: unknown;
  risks?: unknown;
  generated_at?: string;
  updated_at?: string;
};

const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);
const VALID_SEVERITIES = new Set(['critical', 'warning', 'info']);

function schemaMissingFields(row: PdlCockpitLiveRow): string[] {
  const missing: string[] = [];
  for (const field of PDL_COCKPIT_REQUIRED_FIELDS) {
    if (row[field] === undefined) {
      missing.push(field);
    }
  }
  return missing;
}

function parseKpis(value: unknown): DashboardKpi[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is DashboardKpi =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as DashboardKpi).id === 'string' &&
      typeof (item as DashboardKpi).label === 'string' &&
      typeof (item as DashboardKpi).icon === 'string' &&
      typeof (item as DashboardKpi).accentColor === 'string' &&
      ((item as DashboardKpi).value !== undefined &&
        (typeof (item as DashboardKpi).value === 'string' ||
          typeof (item as DashboardKpi).value === 'number')),
  );
}

function parseOpenTasks(value: unknown): PdlOpenTask[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PdlOpenTask => {
    if (typeof item !== 'object' || item === null) return false;
    const task = item as PdlOpenTask;
    return (
      typeof task.id === 'string' &&
      typeof task.title === 'string' &&
      typeof task.dueDate === 'string' &&
      typeof task.assignee === 'string' &&
      VALID_PRIORITIES.has(task.priority)
    );
  });
}

function parseRisks(value: unknown): PdlRisk[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PdlRisk => {
    if (typeof item !== 'object' || item === null) return false;
    const risk = item as PdlRisk;
    return (
      typeof risk.id === 'string' &&
      typeof risk.label === 'string' &&
      typeof risk.hint === 'string' &&
      VALID_SEVERITIES.has(risk.severity)
    );
  });
}

export function mapPdlCockpitRow(row: PdlCockpitLiveRow): ServiceResult<PdlCockpitSnapshot> {
  const schemaMissing = schemaMissingFields(row);
  if (schemaMissing.length > 0) {
    const fields = schemaMissing.join(', ');
    return {
      ok: false,
      error: `Live-PDL-Cockpit: Supabase-Schema unvollständig (${fields} fehlen). Migration 0029 anwenden.`,
    };
  }

  return {
    ok: true,
    data: {
      tenantId: row.tenant_id,
      kpis: parseKpis(row.kpis),
      openTasks: parseOpenTasks(row.open_tasks),
      risks: parseRisks(row.risks),
      generatedAt: row.generated_at!,
    },
  };
}

export function emptyPdlCockpitSnapshot(tenantId: string): PdlCockpitSnapshot {
  return {
    tenantId,
    kpis: [],
    openTasks: [],
    risks: [],
    generatedAt: new Date().toISOString(),
  };
}
