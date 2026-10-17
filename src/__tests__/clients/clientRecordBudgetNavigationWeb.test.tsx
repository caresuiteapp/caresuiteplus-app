// @vitest-environment happy-dom
import React, { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';

const state = vi.hoisted(() => ({ setParams: vi.fn(), confirm: vi.fn(), requested: 'pflegegrad_budgets' as ClientRecordTabKey | undefined, stored: undefined as ClientRecordTabKey | undefined, identity: 'client-a', tabs: ['uebersicht', 'pflegegrad_budgets', 'dokumente'] as ClientRecordTabKey[] }));
const router = { setParams: state.setParams };
vi.mock('expo-router', () => ({ useRouter: () => router }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: (...args: unknown[]) => state.confirm(...args) }));
vi.mock('@/screens/business/office/ClientRecordTabPanels.tsx', () => {
  const stub = () => null;
  return { ClientRecordTabContent: stub, ClientRecordConsentsPanel: stub, ClientRecordTasksPanel: stub, ClientRecordLeistungsbereichePanel: stub, ClientRecordMedicationPanel: stub, ClientRecordVitalsPanel: stub, ClientRecordTimelinePanel: stub, ClientRecordModulesPanel: stub, ClientRecordPortalPanel: stub, ClientRecordBudgetCorePanel: stub, ClientRecordShiftsTabPanel: stub };
});
vi.mock('@/components/office/ClientRecordContractsPanel.web', () => ({ ClientRecordContractsPanel: () => null }));
vi.mock('@/components/documents/DocumentRecommendations.web', () => ({ DocumentRecommendations: () => null }));
vi.mock('@/hooks/usePageTab', () => ({ usePageTab: (_name: string, initial: string) => useState(initial) }));
vi.mock('@/components/office/ClientCareGradeBudgetsPanel.web', () => ({ ClientCareGradeBudgetsPanel: ({ clientId, onDirtyChange, onBusyChange }: any) => {
  const [value, setValue] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { onDirtyChange?.(Boolean(value)); }, [value, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onDirtyChange?.(false); onBusyChange?.(false); }, [onDirtyChange, onBusyChange]);
  return <section data-budget-client={clientId}><input aria-label="Finanzierungsauswahl" value={value} onInput={event => setValue(event.currentTarget.value)} /><button onClick={() => setBusy(previous => !previous)}>Budgetbearbeitung</button></section>;
} }));
import { useBudgetRecordTabs } from '@/hooks/useBudgetRecordTabs.web';
import { ClientRecordTabContent } from '@/screens/business/office/ClientRecordTabPanels.web';

function Harness() {
  const initial = state.requested ?? state.stored;
  const { activeTab, selectTab, budgetNavigationNotice, onBudgetDirtyChange, onBudgetBusyChange } = useBudgetRecordTabs({ tabs: state.tabs, initialTab: initial && state.tabs.includes(initial) ? initial : 'uebersicht', requestedTab: state.requested, storedUrlTab: state.stored });
  return <main><nav>{state.tabs.map(tab => <button key={tab} onClick={() => selectTab(tab)} aria-pressed={activeTab === tab}>{tab}</button>)}</nav>{budgetNavigationNotice ? <p role="status">{budgetNavigationNotice}</p> : null}
    {activeTab === 'pflegegrad_budgets' ? <ClientRecordTabContent tab={activeTab} clientId={state.identity} fullClient={null} canViewSensitive onBudgetDirtyChange={onBudgetDirtyChange} onBudgetBusyChange={onBudgetBusyChange} /> : <section data-other-tab={activeTab}>{activeTab}</section>}
  </main>;
}
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); state.setParams.mockReset(); state.confirm.mockReset().mockResolvedValue(false);
  state.requested = 'pflegegrad_budgets'; state.stored = undefined; state.identity = 'client-a'; state.tabs = ['uebersicht', 'pflegegrad_budgets', 'dokumente'];
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async () => { await act(async () => root.render(<Harness key={state.identity} />)); };
const budget = () => host.querySelector('[data-budget-client]');
const input = () => host.querySelector<HTMLInputElement>('[aria-label="Finanzierungsauswahl"]')!;
const click = async (label: string) => { await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === label)!.click()); };
const edit = async () => { await act(async () => { input().value = 'unsaved'; input().dispatchEvent(new Event('input', { bubbles: true })); }); };

describe('budget drafts inside the Web client record', () => {
  it('forwards the real Web panel guard and retains its draft when discarding is rejected', async () => {
    await render(); await edit(); const previous = input(); await click('dokumente');
    expect(state.confirm).toHaveBeenCalledOnce(); expect(input()).toBe(previous); expect(input().value).toBe('unsaved'); expect(state.setParams).not.toHaveBeenCalled();
  });
  it('changes the tab and both persisted address keys only after discard is accepted', async () => {
    await render(); await edit(); state.confirm.mockResolvedValue(true); await click('dokumente');
    expect(budget()).toBeNull(); expect(host.querySelector('[data-other-tab=dokumente]')).toBeTruthy();
    expect(state.setParams).toHaveBeenLastCalledWith({ tab: 'dokumente', csPage_ClientRecordScreen_activeTab: 'dokumente' });
  });
  it('blocks a local tab change while a budget mutation or modal is active', async () => {
    await render(); await click('Budgetbearbeitung'); await click('dokumente');
    expect(budget()).toBeTruthy(); expect(state.confirm).not.toHaveBeenCalled(); expect(host.querySelector('[role=status]')?.textContent).toContain('Budgetbearbeitung');
    await click('Budgetbearbeitung'); await click('dokumente'); expect(budget()).toBeNull();
  });
  it('keeps the budget mounted during external tab parameters and restores a rejected URL', async () => {
    await render(); await edit(); const previous = input(); state.requested = 'dokumente'; await render();
    expect(input()).toBe(previous); expect(input().value).toBe('unsaved');
    expect(state.setParams).toHaveBeenLastCalledWith({ tab: 'pflegegrad_budgets', csPage_ClientRecordScreen_activeTab: 'pflegegrad_budgets' });
    state.requested = 'pflegegrad_budgets'; await render(); state.confirm.mockResolvedValue(true); state.requested = 'dokumente'; await render(); expect(budget()).toBeNull();
  });
  it('also guards the legacy persisted csPage tab parameter before it can unmount a draft', async () => {
    state.requested = undefined; state.stored = 'pflegegrad_budgets'; await render(); await edit();
    state.stored = 'dokumente'; await render(); expect(input().value).toBe('unsaved'); expect(state.confirm).toHaveBeenCalledOnce();
  });
  it('preserves the selected tab after list refresh and supports ordinary clean tab navigation', async () => {
    await render(); await click('dokumente'); state.tabs = [...state.tabs]; await render();
    expect(host.querySelector('[data-other-tab=dokumente]')).toBeTruthy(); expect(state.confirm).not.toHaveBeenCalled();
    state.requested = 'dokumente'; state.stored = 'dokumente'; await render(); await click('pflegegrad_budgets'); expect(budget()).toBeTruthy();
  });
  it('does not apply a pending discard after the record identity changes', async () => {
    let resolve!: (value: boolean) => void; state.confirm.mockReturnValue(new Promise<boolean>(done => { resolve = done; }));
    await render(); await edit(); await click('dokumente'); state.identity = 'client-b'; await render();
    state.setParams.mockClear(); await act(async () => resolve(true));
    expect(host.querySelector('[data-budget-client=client-b]')).toBeTruthy(); expect(input().value).toBe(''); expect(state.setParams).not.toHaveBeenCalled();
  });
  it('removes the inaccessible tab immediately if role permissions revoke it', async () => {
    await render(); await edit(); state.tabs = ['uebersicht', 'dokumente']; await render();
    expect(budget()).toBeNull(); expect(host.querySelector('[data-other-tab=uebersicht]')).toBeTruthy(); expect(state.confirm).not.toHaveBeenCalled();
  });
});
