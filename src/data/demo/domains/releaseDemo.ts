import type {
  EnvProfile,
  ReleaseDetail,
  ReleaseHubSnapshot,
  ReleaseListItem,
  VersionManifest,
} from '@/types/release';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

export const RELEASE_DEMO_TENANT = DEMO_TENANT_ID;

export const versionManifest: VersionManifest = {
  appVersion: '1.0.0',
  buildNumber: '100',
  channel: 'internal',
  releasedAt: '2026-06-12T10:00:00.000Z',
  gitCommit: 'a716b39e',
};

export const envProfiles: EnvProfile[] = [
  {
    key: 'development',
    label: 'Entwicklung',
    apiBaseUrl: 'http://localhost:8080',
    supabaseUrl: 'https://dev.supabase.co',
    featuresEnabled: ['demo_mode', 'debug_logs'],
  },
  {
    key: 'staging',
    label: 'Staging',
    apiBaseUrl: 'https://staging-api.caresuite.app',
    supabaseUrl: 'https://staging.supabase.co',
    featuresEnabled: ['pilot_tenant', 'analytics'],
  },
  {
    key: 'production',
    label: 'Produktion',
    apiBaseUrl: 'https://api.caresuite.app',
    supabaseUrl: 'https://prod.supabase.co',
    featuresEnabled: ['store_build', 'crash_reporting'],
  },
];

const checklistTemplate = [
  { id: 'c1', label: 'Typecheck & Smoke grün', done: true, assignee: 'DevOps' },
  { id: 'c2', label: 'Store-Metadaten geprüft', done: true, assignee: 'Product' },
  { id: 'c3', label: 'DSGVO-Checkliste signiert', done: false, assignee: 'Datenschutz' },
  { id: 'c4', label: 'Pilot-Feedback eingearbeitet', done: false, assignee: 'PDL' },
  { id: 'c5', label: 'Pilot-Readiness rm-001 ≥ 80%', done: false, assignee: 'Product', pilotGate: true },
];

export const releaseDemoList: ReleaseListItem[] = [
  {
    id: 'rel-001',
    tenantId: RELEASE_DEMO_TENANT,
    title: 'Release 1.0.0 — Store Candidate',
    env: 'staging',
    status: 'in_bearbeitung',
    checklistDone: 2,
    checklistTotal: 5,
    updatedAt: '2026-06-11T14:30:00.000Z',
  },
  {
    id: 'rel-002',
    tenantId: RELEASE_DEMO_TENANT,
    title: 'Hotfix 1.0.1 — Auth Session',
    env: 'production',
    status: 'entwurf',
    checklistDone: 0,
    checklistTotal: 5,
    updatedAt: '2026-06-10T09:15:00.000Z',
  },
];

const releaseDetails: Record<string, ReleaseDetail> = {
  'rel-001': {
    ...releaseDemoList[0],
    summary: 'Store-Release mit Pilot-Feedback und DSGVO-Freigabe.',
    checklist: checklistTemplate,
    manifest: versionManifest,
  },
  'rel-002': {
    ...releaseDemoList[1],
    summary: 'Kritischer Hotfix für Session-Timeout im Business-Portal.',
    checklist: checklistTemplate.map((c) => ({ ...c, done: false })),
    manifest: { ...versionManifest, appVersion: '1.0.1', buildNumber: '101' },
  },
};

export function getReleaseHubSnapshot(): ReleaseHubSnapshot {
  return {
    tenantId: RELEASE_DEMO_TENANT,
    manifest: versionManifest,
    envProfiles,
    kpis: [
      { id: 'k1', label: 'Offene Checklisten', value: 2, subValue: 'von 2 Releases', icon: '📋', accentColor: '#FF9500' },
      { id: 'k2', label: 'Staging Builds', value: 1, subValue: 'aktiv', icon: '🚀', accentColor: '#62F3FF' },
      { id: 'k3', label: 'Store-Kanal', value: versionManifest.channel, subValue: versionManifest.appVersion, icon: '📦', accentColor: '#22C55E' },
    ],
    pendingChecklists: releaseDemoList.filter((r) => r.checklistDone < r.checklistTotal).length,
    generatedAt: new Date().toISOString(),
  };
}

export function getReleaseDetail(id: string): ReleaseDetail | null {
  return releaseDetails[id] ?? null;
}

export function toggleReleaseChecklistItem(releaseId: string, itemId: string): ReleaseDetail | null {
  const detail = releaseDetails[releaseId];
  if (!detail) return null;
  const item = detail.checklist.find((c) => c.id === itemId);
  if (!item) return null;
  item.done = !item.done;
  const done = detail.checklist.filter((c) => c.done).length;
  detail.checklistDone = done;
  const listItem = releaseDemoList.find((r) => r.id === releaseId);
  if (listItem) {
    listItem.checklistDone = done;
    listItem.updatedAt = new Date().toISOString();
  }
  return detail;
}

export function createReleaseDraft(title: string, env: ReleaseListItem['env']): { id: string } {
  const id = `rel-${Date.now().toString(36)}`;
  const item: ReleaseListItem = {
    id,
    tenantId: RELEASE_DEMO_TENANT,
    title: title.trim(),
    env,
    status: 'entwurf',
    checklistDone: 0,
    checklistTotal: checklistTemplate.length,
    updatedAt: new Date().toISOString(),
  };
  releaseDemoList.unshift(item);
  releaseDetails[id] = {
    ...item,
    summary: 'Neues Release-Paket — Checkliste aus Vorlage.',
    checklist: checklistTemplate.map((c) => ({ ...c, done: false })),
    manifest: versionManifest,
  };
  return { id };
}
