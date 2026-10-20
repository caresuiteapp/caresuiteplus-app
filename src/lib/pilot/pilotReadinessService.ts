import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoleKey, ServiceResult } from '@/types';
import {
  PILOT_MILESTONE_ID,
  PILOT_TENANT_IDS,
  getPilotTenantConfig,
  type PilotTenantId,
} from '@/lib/pilot/pilotConfig';
import { getPilotTenantById, pilotAmbulantTenants } from '@/data/demo/pilotTenants';
import { enforcePermission } from '@/lib/permissions';
import { queueInvoiceExport } from '@/lib/integrations/integrationService';

const STORAGE_KEY = 'caresuite:pilot-readiness';

export type PilotChecklistCategory = 'auth' | 'clients' | 'assignments' | 'reporting' | 'release_gates';

export type PilotChecklistItem = {
  id: string;
  category: PilotChecklistCategory;
  label: string;
  required: boolean;
};

export type PilotChecklistState = {
  tenantId: PilotTenantId;
  checkedIds: string[];
  updatedAt: string;
};

export type PilotReadinessSnapshot = {
  milestoneId: typeof PILOT_MILESTONE_ID;
  tenants: {
    tenantId: PilotTenantId;
    name: string;
    phase: string;
    checklistDone: number;
    checklistTotal: number;
    readinessPercent: number;
  }[];
  overallReadinessPercent: number;
  releaseGateLinked: boolean;
  generatedAt: string;
};

export const PILOT_CHECKLIST_TEMPLATE: PilotChecklistItem[] = [
  { id: 'auth-1', category: 'auth', label: 'Admin-Login & Rollenmatrix geprüft', required: true },
  { id: 'auth-2', category: 'auth', label: 'RLS-Policies für Mandant aktiv', required: true },
  { id: 'clients-1', category: 'clients', label: 'Klientenstamm importiert (>10 Datensätze)', required: true },
  { id: 'clients-2', category: 'clients', label: 'Ansprechpartner hinterlegt', required: true },
  { id: 'assignments-1', category: 'assignments', label: 'Einsatzplan für Woche 1 angelegt', required: true },
  { id: 'assignments-2', category: 'assignments', label: 'Mitarbeiter-Zuweisungen validiert', required: true },
  { id: 'reporting-1', category: 'reporting', label: 'PDL-Cockpit KPIs sichtbar', required: true },
  { id: 'reporting-2', category: 'reporting', label: 'Monatsbericht-Entwurf erstellt', required: false },
  { id: 'release-1', category: 'release_gates', label: 'Release-Checkliste verknüpft', required: true },
  { id: 'release-2', category: 'release_gates', label: 'DATEV-Export Smoke-Test erfolgreich', required: true },
];

const CATEGORY_LABELS: Record<PilotChecklistCategory, string> = {
  auth: 'Authentifizierung',
  clients: 'Klienten',
  assignments: 'Einsätze',
  reporting: 'Reporting',
  release_gates: 'Release-Gates',
};

export function getPilotChecklistCategoryLabel(category: PilotChecklistCategory): string {
  return CATEGORY_LABELS[category];
}

function defaultState(tenantId: PilotTenantId): PilotChecklistState {
  return { tenantId, checkedIds: [], updatedAt: new Date().toISOString() };
}

async function loadAllStates(): Promise<Record<string, PilotChecklistState>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, PilotChecklistState>;
  } catch {
    return {};
  }
}

async function saveAllStates(states: Record<string, PilotChecklistState>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(states));
}

export async function loadPilotChecklistState(tenantId: PilotTenantId): Promise<PilotChecklistState> {
  const all = await loadAllStates();
  return all[tenantId] ?? defaultState(tenantId);
}

export async function togglePilotChecklistItem(
  tenantId: PilotTenantId,
  itemId: string,
): Promise<PilotChecklistState> {
  const all = await loadAllStates();
  const current = all[tenantId] ?? defaultState(tenantId);
  const checked = new Set(current.checkedIds);
  if (checked.has(itemId)) checked.delete(itemId);
  else checked.add(itemId);
  const next: PilotChecklistState = {
    tenantId,
    checkedIds: [...checked],
    updatedAt: new Date().toISOString(),
  };
  all[tenantId] = next;
  await saveAllStates(all);
  return next;
}

export function computeReadinessPercent(checkedIds: string[]): number {
  const required = PILOT_CHECKLIST_TEMPLATE.filter((i) => i.required);
  const done = required.filter((i) => checkedIds.includes(i.id)).length;
  return required.length === 0 ? 100 : Math.round((done / required.length) * 100);
}

export async function fetchPilotReadinessSnapshot(
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PilotReadinessSnapshot>> {
  const denied = enforcePermission<PilotReadinessSnapshot>(actorRoleKey, 'roadmap.view');
  if (denied) return denied;

  const all = await loadAllStates();
  const tenants = PILOT_TENANT_IDS.map((tenantId) => {
    const tenant = getPilotTenantById(tenantId)!;
    const config = getPilotTenantConfig(tenantId)!;
    const state = all[tenantId] ?? defaultState(tenantId);
    const checklistTotal = PILOT_CHECKLIST_TEMPLATE.filter((i) => i.required).length;
    const checklistDone = PILOT_CHECKLIST_TEMPLATE.filter(
      (i) => i.required && state.checkedIds.includes(i.id),
    ).length;
    return {
      tenantId,
      name: tenant.name,
      phase: config.phase,
      checklistDone,
      checklistTotal,
      readinessPercent: computeReadinessPercent(state.checkedIds),
    };
  });

  const overallReadinessPercent = Math.round(
    tenants.reduce((sum, t) => sum + t.readinessPercent, 0) / tenants.length,
  );

  return {
    ok: true,
    data: {
      milestoneId: PILOT_MILESTONE_ID,
      tenants,
      overallReadinessPercent,
      releaseGateLinked: true,
      generatedAt: new Date().toISOString(),
    },
  };
}

/** DATEV-Export Smoke-Pfad für Pilot-Mandant (Outbox) */
export async function runPilotDatevExportSmoke(
  tenantId: PilotTenantId,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ outboxId: string; invoiceNumber: string }>> {
  const denied = enforcePermission<{ outboxId: string; invoiceNumber: string }>(
    actorRoleKey,
    'integrations.manage',
  );
  if (denied) return denied;

  const tenant = getPilotTenantById(tenantId);
  if (!tenant) return { ok: false, error: 'Pilot-Mandant nicht gefunden.' };

  const config = getPilotTenantConfig(tenantId);
  if (!config?.features.includes('datev_export')) {
    return { ok: false, error: 'DATEV-Export für diesen Pilot-Mandanten nicht freigeschaltet.' };
  }

  const result = await queueInvoiceExport(tenant.invoiceSampleNumber, actorRoleKey);
  if (!result.ok) return result;

  const state = await loadPilotChecklistState(tenantId);
  if (!state.checkedIds.includes('release-2')) {
    await togglePilotChecklistItem(tenantId, 'release-2');
  }

  return {
    ok: true,
    data: { outboxId: result.data.id, invoiceNumber: tenant.invoiceSampleNumber },
  };
}

export { pilotAmbulantTenants };
