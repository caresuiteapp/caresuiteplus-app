// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MdReadinessListScreen } from '@/screens/pflege/MdReadinessListScreen';
import { filterMdEvidenceCases, groupMdEvidenceCases, mdEvidenceChecks, mdEvidenceTarget, readMdEvidenceRows } from '@/lib/pflege/mdEvidenceWorkspace';
import type { PflegeMdReadinessItem } from '@/types/modules/pflege';

const api = vi.hoisted(() => ({
  tenant: '00000000-0000-4000-8000-000000000009', actor: '00000000-0000-4000-8000-000000000008',
  token: 'first', allowed: [] as string[], refreshError: null as string | null,
  push: vi.fn(), fetch: vi.fn(), refresh: vi.fn(), refreshPermissions: vi.fn(), callbacks: new Map<string, () => void>(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Pressable: ({ children, accessibilityLabel, accessibilityState, onPress }: { children: ReactNode; accessibilityLabel: string; accessibilityState: { expanded: boolean }; onPress(): void }) => {
    api.callbacks.set(accessibilityLabel, onPress);
    return <button aria-label={accessibilityLabel} aria-expanded={accessibilityState.expanded} onClick={onPress}>{children}</button>;
  },
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock('@/hooks/useFlowRouter', () => ({ useFlowRouter: () => ({ push: api.push }) }));
vi.mock('@/components/layout', () => ({ ScreenShell: ({ title, children }: { title: string; children: ReactNode }) => <main><h1>{title}</h1>{children}</main> }));
vi.mock('@/components/ui', () => ({
  EmptyState: ({ title, message, actionLabel, onAction }: { title: string; message: string; actionLabel?: string; onAction?(): void }) => <div>{title}{message}{actionLabel && <button onClick={onAction}>{actionLabel}</button>}</div>,
  ErrorState: ({ message, onRetry }: { message: string; onRetry?(): void }) => <div role="alert">{message}{onRetry && <button onClick={onRetry}>Erneut versuchen</button>}</div>,
  FilterChipGroup: ({ options, onChange }: { options: { key: string; label: string }[]; onChange(next: string): void }) => <div>{options.map(option => <button key={option.key} onClick={() => onChange(option.key)}>{option.label}</button>)}</div>,
  InfoBanner: ({ title, message }: { title: string; message: string }) => <div>{title}{message}</div>,
  LoadingState: ({ message }: { message: string }) => <div>{message}</div>,
  PremiumBadge: ({ label }: { label: string }) => <span>{label}</span>,
  PremiumButton: ({ title, onPress, disabled }: { title: string; onPress(): void; disabled?: boolean }) => {
    api.callbacks.set(title, onPress);
    return <button disabled={disabled} onClick={onPress}>{title}</button>;
  },
  PremiumInput: ({ label, value, onChangeText }: { label: string; value: string; onChangeText(next: string): void }) => <input aria-label={label} value={value} onInput={event => onChangeText(event.currentTarget.value)} />,
  SectionPanel: ({ title, children }: { title: string; children: ReactNode }) => <section><h2>{title}</h2>{children}</section>,
}));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useCareAdaptiveTokens: () => ({ c: {}, typography: {} }) }));
vi.mock('@/theme', () => ({ radius: { lg: 16, md: 12, sm: 8 }, spacing: { md: 16, sm: 8, xs: 4 } }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({
  profile: { id: api.actor, tenantId: api.tenant, roleKey: 'business_admin' }, user: { id: api.actor },
  session: { accessToken: api.token, expiresAt: null, user: { id: api.actor } }, authReady: true, isAuthenticated: true,
}) }));
vi.mock('@/hooks/pflege/useCareRuntimePermissions', () => ({ useCareRuntimePermissions: () => ({
  roleKey: 'business_admin', tenantId: api.tenant, permissions: api.allowed,
  can: (permission: string) => api.allowed.includes(permission), hasModuleGate: () => true, refreshPermissions: api.refreshPermissions,
}) }));
vi.mock('@/hooks/core/useAsyncQuery', async () => {
  const { useEffect, useState } = await import('react');
  return { useAsyncQuery: (loader: () => Promise<{ ok: true; data: PflegeMdReadinessItem[] } | { ok: false; error: string }>) => {
    const [response, setResponse] = useState<Awaited<ReturnType<typeof loader>> | null>(null);
    useEffect(() => { let alive = true; void loader().then(value => { if (alive) setResponse(value); }); return () => { alive = false; }; }, []);
    return { data: response?.ok ? response.data : null, loading: !response, error: response && !response.ok ? response.error : null,
      refreshError: api.refreshError, refresh: api.refresh };
  } };
});
vi.mock('@/lib/pflege/careQualityR2LiveService', () => ({ fetchMdReadiness: api.fetch }));

const client = '00000000-0000-4000-8000-000000000001';
const planA = '00000000-0000-4000-8000-000000000002';
const planB = '00000000-0000-4000-8000-000000000003';
const clientB = '00000000-0000-4000-8000-000000000004';
const planC = '00000000-0000-4000-8000-000000000005';

function item(clientId: string, carePlanId: string, clientName: string, planTitle: string, missing: (keyof PflegeMdReadinessItem['checks'])[] = []): PflegeMdReadinessItem {
  return { clientId, carePlanId, clientName, planTitle,
    checks: Object.fromEntries(mdEvidenceChecks.map(check => [check.key, !missing.includes(check.key)])) as PflegeMdReadinessItem['checks'],
    ready: missing.length === 0, readinessPercent: Math.round((7 - missing.length) * 100 / 7) };
}
const fixtures = [item(client, planA, 'Mara Römer', 'Erster Plan', ['recentEvaluation', 'recentVisit', 'signedDocumentation']),
  item(client, planB, 'Mara Römer', 'Zweiter Plan'), item(clientB, planC, 'Kai Winter', 'Dritter Plan')];

describe('MD-Nachweischeck', () => {
  it('rejects non-arrays, duplicates, malformed checks and contradictory server totals', () => {
    expect(readMdEvidenceRows(null)).toBeNull();
    expect(readMdEvidenceRows([])).toEqual([]);
    expect(readMdEvidenceRows(fixtures)).toEqual(fixtures);
    expect(readMdEvidenceRows([...fixtures, fixtures[0]])).toBeNull();
    expect(readMdEvidenceRows([{ ...fixtures[0], readinessPercent: 100 }])).toBeNull();
    expect(readMdEvidenceRows([{ ...fixtures[0], ready: true }])).toBeNull();
    expect(readMdEvidenceRows([{ ...fixtures[0], checks: { ...fixtures[0].checks, recentVisit: 'false' } }])).toBeNull();
    expect(readMdEvidenceRows([{ ...fixtures[0], checks: { ...fixtures[0].checks, unknown: true } }])).toBeNull();
    expect(readMdEvidenceRows([{ ...fixtures[0], clientId: 'outside/path' }])).toBeNull();
  });

  it('keeps different plans with one case and does not mark mixed cases as complete', () => {
    const cases = groupMdEvidenceCases(fixtures);
    expect(cases.map(entry => [entry.clientId, entry.pendingPlans, entry.totalPlans])).toEqual([[client, 1, 2], [clientB, 0, 1]]);
    expect(filterMdEvidenceCases(cases, 'roMER', 'pending')[0]?.plans.map(plan => plan.carePlanId)).toEqual([planA]);
    expect(filterMdEvidenceCases(cases, 'Zweiter Plan', 'pending')).toEqual([]);
    expect(filterMdEvidenceCases(cases, 'Zweiter Plan', 'all')[0]?.plans.map(plan => plan.carePlanId)).toEqual([planB]);
    expect(filterMdEvidenceCases(cases, '', 'matched').map(entry => entry.clientId)).toEqual([clientB]);
  });

  it('only carries known client / plan ids to exact destinations', () => {
    expect(mdEvidenceTarget(fixtures[0], 'recentEvaluation')?.path).toBe(`/pflege/evaluation?carePlanId=${planA}`);
    expect(mdEvidenceTarget(fixtures[0], 'recentVisit')?.path).toBe(`/pflege/visiten?clientId=${client}`);
    expect(mdEvidenceTarget(fixtures[0], 'signedDocumentation')?.path).toBe(`/pflege/dokumentation?clientId=${client}`);
    expect(mdEvidenceTarget(fixtures[0], 'risksCurrent')?.path).toBe('/pflege/risiken');
    expect(mdEvidenceTarget({ ...fixtures[0], carePlanId: '../other' }, 'case')).toBeNull();
  });
});

describe('MD-Arbeitsliste', () => {
  let host: HTMLDivElement;
  let root: Root;
  const button = (name: string) => Array.from(host.querySelectorAll('button')).find(value => (value.getAttribute('aria-label') ?? value.textContent) === name);
  const click = async (name: string) => { const target = button(name); expect(target, name).toBeDefined(); await act(async () => target!.click()); };
  const render = async () => { await act(async () => root.render(<MdReadinessListScreen />)); };
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    api.token = 'first'; api.refreshError = null; api.allowed = ['office.access', 'pflege.access', 'pflege.md.readiness', 'pflege.evaluations.view', 'pflege.visits.view'];
    vi.resetAllMocks(); api.callbacks.clear(); api.fetch.mockResolvedValue({ ok: true, data: fixtures });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  it('opens only missing evidence on the same plan or case and hides ungranted actions', async () => {
    await render();
    expect(api.fetch).toHaveBeenCalledWith(api.tenant, 'business_admin', api.allowed);
    expect(host.textContent).toContain('Pflegefälle mit aktivem Plan: 2 · Mit offenen Prüfpunkten: 1');
    expect(host.textContent).not.toContain('Kai Winter');
    await click('Mara Römer: Pflegepläne anzeigen');
    expect(host.textContent).not.toContain('Zweiter Plan');
    await click('Erster Plan: Prüfpunkte anzeigen');
    expect(host.textContent).toContain('Keine erfasste Evaluation des Plans aus den letzten 90 Tagen gefunden.');
    expect(host.textContent).toContain('Kein signierter Eintrag mit Erfassungszeit in den letzten 30 Tagen gefunden.');
    expect(button('Dokumentation dieses Falls öffnen')).toBeUndefined();
    expect(button('Pflegeakte öffnen')).toBeUndefined();
    await click('Evaluationen dieses Plans öffnen');
    await click('Visiten dieses Falls öffnen');
    expect(api.push.mock.calls).toEqual([[`/pflege/evaluation?carePlanId=${planA}`], [`/pflege/visiten?clientId=${client}`]]);
  });

  it('fences retained actions after loss of the current scope and hides data on refresh failure', async () => {
    await render();
    await click('Mara Römer: Pflegepläne anzeigen'); await click('Erster Plan: Prüfpunkte anzeigen');
    const retained = api.callbacks.get('Evaluationen dieses Plans öffnen')!;
    api.refreshError = 'Datenquelle offline'; await render();
    expect(host.textContent).toContain('Frühere Werte werden');
    expect(host.textContent).not.toContain('Mara Römer');
    await act(async () => retained()); expect(api.push).not.toHaveBeenCalled();
    api.refreshError = null; api.allowed = []; api.token = 'changed'; await render();
    expect(host.textContent).toContain('fehlt die aktuelle Berechtigung');
    expect(host.textContent).not.toContain('Mara Römer');
    await act(async () => retained()); expect(api.push).not.toHaveBeenCalled();
  });
});
