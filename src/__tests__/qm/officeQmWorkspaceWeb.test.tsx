// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { qmWorkspaceCss } from '@/components/qm/qmWorkspaceCss.web';
import type { QmDashboardSnapshot } from '@/lib/qm/qm.types';

const snapshot = (): QmDashboardSnapshot => ({
  chapterCount: 22, documentCount: 34, complianceOpenCount: 3, mdPackageCount: 2,
  pendingApprovals: 4, recentChanges: [], upcomingAudits: [], loadedAt: '2026-10-23T16:00:00Z',
});
const api = {
  data: null as QmDashboardSnapshot | null, loading: false, refreshing: false,
  error: null as string | null, refreshError: null as string | null,
  push: vi.fn(), refresh: vi.fn(), fetch: vi.fn(), clinicalRender: vi.fn(),
};
const clinicalPanel = () => { api.clinicalRender(); return <div data-testid="unexpected-clinical-panel" />; };
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'),
  'expo-router': { useRouter: () => ({ push: api.push }) },
  '@/components/layout/ScreenShell.web': { ScreenShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> },
  '@/components/catalog/CatalogWorkspace.web': { CatalogIcon: () => <span aria-hidden="true" /> },
  // esbuild also externalizes subpaths of the clinical barrel below. Supply
  // the real shared stylesheet while keeping the clinical readers guarded.
  '@/components/qm/qmWorkspaceCss.web': { qmWorkspaceCss },
  '@/liquid-command/components/DesktopCatalogArtwork.web': { DesktopCatalogArtwork: ({ label }: { label: string }) => <img alt="" data-artwork-label={label} /> },
  '@/hooks/qm': { useQmDashboard: () => api },
  // These prepared boundaries are deliberately poisonous: the overview and its
  // disclosure may explain availability, but must never start clinical readers.
  '@/components/qm': {
    QualityWorkspace: clinicalPanel, ComplaintHandlingPanel: clinicalPanel,
    SafetyIncidentPanel: clinicalPanel, FallEventAnalysisPanel: clinicalPanel,
    QualityMeasureFollowUpPanel: clinicalPanel, AmbulatoryProfessionalAcceptancePanel: clinicalPanel,
  },
};
const compiled = buildSync({
  entryPoints: ['src/screens/qm/QmDashboardScreen.web.tsx'], bundle: true, write: false,
  format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(dependencies),
}).outputFiles[0].text;
const loaded = { exports: {} as { QmDashboardScreen: React.ComponentType } };
new Function('require', 'module', 'exports', compiled)((id: string) => {
  if (!(id in dependencies)) throw new Error(`Unexpected QM dependency: ${id}`);
  return dependencies[id];
}, loaded, loaded.exports);
const Dashboard = loaded.exports.QmDashboardScreen;
let host: HTMLDivElement, root: Root;
const render = async () => { await act(async () => root.render(<Dashboard />)); };
const label = (value: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${value}"]`);
const button = (value: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === value);
const click = async (element: HTMLElement | null | undefined) => {
  expect(element).toBeTruthy();
  await act(async () => element!.click());
};
const kpi = (field: string) => host.querySelector<HTMLButtonElement>(`[data-qm-kpi="${field}"]`)!;
const value = (field: string) => kpi(field).querySelector('strong')?.textContent;

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  api.data = snapshot(); api.loading = false; api.refreshing = false;
  api.error = null; api.refreshError = null;
  api.refresh.mockResolvedValue(undefined);
  api.fetch.mockImplementation(() => { throw new Error('Unexpected direct network request from QM overview'); });
  vi.stubGlobal('fetch', api.fetch);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
});

describe('actual QM Web workspace', () => {
  it('shows supplied live counts without mounting or requesting prepared clinical areas', async () => {
    await render();
    expect(host.querySelector('[data-testid="qm-dashboard-workspace"]')).not.toBeNull();
    expect(['chapterCount', 'documentCount', 'complianceOpenCount', 'mdPackageCount', 'pendingApprovals'].map(value)).toEqual(['22', '34', '3', '2', '4']);
    expect(host.querySelectorAll('[data-artwork-label]')).toHaveLength(4);
    expect(api.clinicalRender).not.toHaveBeenCalled();
    expect(api.fetch).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('keeps every prepared clinical area closed even when its availability is inspected', async () => {
    await render();
    const disclosure = host.querySelector('details')!;
    expect(disclosure.open).toBe(false);
    disclosure.open = true;
    const choices = [...disclosure.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')];
    expect(choices).toHaveLength(6);
    for (const choice of choices) {
      await click(choice);
      expect(disclosure.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
      expect(choice.getAttribute('aria-pressed')).toBe('true');
      const heading = disclosure.querySelector<HTMLHeadingElement>('h3')!;
      expect(document.activeElement).toBe(heading);
      expect(disclosure.textContent).toContain('Dieser Bereich ist noch nicht freigeschaltet.');
      expect(api.clinicalRender).not.toHaveBeenCalled();
      expect(api.fetch).not.toHaveBeenCalled();
      expect(api.push).not.toHaveBeenCalled();
      expect(host.querySelector('[role="dialog"]')).toBeNull();
    }
    await click(button('Zu den QM-Dokumenten'));
    expect(api.push).toHaveBeenLastCalledWith('/business/office/qm/documents');
  });

  it('opens existing route files from every main action and the pending-approval filter', async () => {
    await render();
    const destinations: [string, string][] = [
      ['QM-Handbuch öffnen', 'handbook'], ['QM-Dokumente öffnen', 'documents'],
      ['QM-Vorlagen öffnen', 'templates'], ['Audits ansehen', 'audits'],
      ['Maßnahmen ansehen', 'measures'], ['Compliance ansehen', 'compliance'],
      ['MD-Prüfung ansehen', 'md-audit'], ['Änderungen ansehen', 'changes'],
      ['Rechtsgrundlagen ansehen', 'legal-references'],
    ];
    for (const [name, path] of destinations) {
      await click(label(name));
      const route = `/business/office/qm/${path}`;
      expect(api.push).toHaveBeenLastCalledWith(route);
      expect(existsSync(join(process.cwd(), 'app', `${route}.tsx`)) || existsSync(join(process.cwd(), 'app', route, 'index.tsx'))).toBe(true);
    }
    await click(kpi('pendingApprovals'));
    expect(api.push).toHaveBeenLastCalledWith('/business/office/qm/documents?status=in_review');
  });

  it('distinguishes unavailable counts from verified zero and preserves usable sections', async () => {
    api.data = { ...snapshot(), chapterCount: 0, documentCount: 0, complianceOpenCount: 0,
      sectionErrors: { documents: 'Dokumente konnten nicht gelesen werden.', compliance: 'Anforderungen konnten nicht gelesen werden.', audits: 'Auditabfrage fehlgeschlagen.', changes: 'Änderungsabfrage fehlgeschlagen.' } };
    await render();
    expect(value('chapterCount')).toBe('0');
    expect(value('documentCount')).toBe('—');
    expect(value('complianceOpenCount')).toBe('—');
    expect(value('mdPackageCount')).toBe('2');
    expect(kpi('documentCount').title).toBe('Dokumente konnten nicht gelesen werden.');
    expect(kpi('complianceOpenCount').textContent).not.toContain('Keine offenen');
    expect(host.textContent).toContain('Auditstand nicht verfügbar');
    expect(host.textContent).toContain('Änderungen nicht verfügbar');
    expect(host.textContent).not.toContain('Keine anstehenden Audits');
    expect(host.textContent).not.toContain('Noch keine Änderungen erfasst');
    await click(button('Fehlende Daten erneut laden'));
    expect(api.refresh).toHaveBeenCalledTimes(1);
    await click(label('QM-Handbuch öffnen'));
    expect(api.push).toHaveBeenCalledWith('/business/office/qm/handbook');
  });

  it('shows a loading state without false empty lists or zero counts while access is checked', async () => {
    api.data = null; api.loading = true;
    await render();
    expect(host.querySelectorAll('[data-qm-kpi] strong')).toHaveLength(5);
    expect([...host.querySelectorAll('[data-qm-kpi] strong')].every(item => item.textContent === '—')).toBe(true);
    expect(host.querySelector('[aria-label="QM-Kennzahlen"]')?.getAttribute('aria-busy')).toBe('true');
    expect(host.textContent).not.toContain('Keine anstehenden Audits');
    expect(host.textContent).not.toContain('Noch keine Änderungen erfasst');
    expect(button('Wird geladen …')?.disabled).toBe(true);
  });

  it('offers a real retry on initial error and explicitly marks a failed refresh as stale', async () => {
    api.data = null; api.error = 'Die aktuellen QM-Rechte konnten nicht bestätigt werden.';
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(api.error);
    expect(value('documentCount')).toBe('—');
    await click(button('Erneut laden'));
    expect(api.refresh).toHaveBeenCalledTimes(1);
    api.data = snapshot(); api.error = null; api.refreshError = 'Aktualisieren fehlgeschlagen.';
    await render();
    expect(value('documentCount')).toBe('34');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('letzten erfolgreichen Stand');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(api.refreshError);
    api.refreshing = true;
    await render();
    expect(button('Erneut laden')?.disabled).toBe(true);
    await click(button('Erneut laden'));
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });

  it('renders the supplied audit and change states instead of empty placeholders', async () => {
    api.data = { ...snapshot(),
      upcomingAudits: [{ id: 'audit-1', tenantId: 'tenant-a', title: 'Interne Dokumentenprüfung', auditType: 'internal', status: 'follow_up', scheduledAt: '2026-10-26T08:00:00Z', completedAt: null, auditorName: 'QM-Team', findingsCount: 2, summary: '', createdAt: '2026-10-22T08:00:00Z', updatedAt: '2026-10-23T08:00:00Z' }],
      recentChanges: [{ id: 'change-1', tenantId: 'tenant-a', title: 'Verfahrensanweisung aktualisieren', changeType: 'improvement', status: 'in_progress', documentId: null, description: 'Anmerkungen aus der Prüfung übernehmen.', requestedBy: 'QM-Team', completedAt: null, createdAt: '2026-10-22T08:00:00Z', updatedAt: '2026-10-23T08:00:00Z' }],
    };
    await render();
    expect(host.textContent).toContain('Interne Dokumentenprüfung');
    expect(host.textContent).toContain('Nachbereitung');
    expect(host.textContent).toContain('26.10.2026');
    expect(host.textContent).toContain('Verfahrensanweisung aktualisieren');
    expect(host.textContent).toContain('In Bearbeitung');
    expect(host.textContent).not.toContain('Keine anstehenden Audits');
    expect(host.textContent).not.toContain('Noch keine Änderungen erfasst');
  });
});
