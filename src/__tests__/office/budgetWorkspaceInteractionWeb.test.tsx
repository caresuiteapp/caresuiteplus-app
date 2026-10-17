// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientBillingWarning, ClientBudgetTransaction } from '@/types/assist/clientAssistBilling';
import type { ClientFundingSourceKey } from '@/types/clients/clientFundingSource';
import { ClientCareGradeBudgetsPanel } from '@/components/office/ClientCareGradeBudgetsPanel.web';
import { ClientFundingSourceSelector } from '@/components/office/ClientFundingSourceSelector.web';
import type { BudgetWorkspaceProfile } from '@/lib/assist/budgetWorkspaceService.web';

type TestProfile = BudgetWorkspaceProfile;
const state = vi.hoisted(() => ({
  tenant: 'tenant-a' as string | null, user: 'user-a' as string | null, role: 'billing' as string | null,
  permissions: ['clients.billing_profile.view', 'clients.budgets.edit'] as string[],
  profile: null as TestProfile | null, profileError: null as string | null,
  transactions: [] as ClientBudgetTransaction[], transactionError: null as string | null,
  fetchProfile: vi.fn(), fetchTransactions: vi.fn(), save: vi.fn(), guard: vi.fn(),
}));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => state.tenant }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ user: state.user ? { id: state.user } : null }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: state.role, permissions: state.permissions, can: (key: string) => state.permissions.includes(key) }) }));
vi.mock('@/hooks/useUnsavedWebChanges.web', () => ({ useUnsavedWebChanges: (...args: unknown[]) => { state.guard(...args); return async () => true; } }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ useLiveRefresh: () => ({ isLiveConnected: true }), DEFAULT_LIVE_POLL_MS: 30_000 }));
vi.mock('@/lib/realtime/presets', () => ({ subscribeToClientBudgetChanges: vi.fn() }));
vi.mock('@/lib/assist/budgetWorkspaceService.web', () => ({ getBudgetWorkspaceProfile: (...args: unknown[]) => state.fetchProfile(...args), listBudgetWorkspaceTransactions: (...args: unknown[]) => state.fetchTransactions(...args) }));
vi.mock('@/lib/assist/budgetWorkspaceMutations.web', () => ({ setBudgetWorkspaceFundingSources: (...args: unknown[]) => state.save(...args) }));
vi.mock('@/components/office/ClientBudgetVisualCards.web', () => ({ ClientBudgetVisualCards: () => <div data-testid="budget-cards" /> }));
vi.mock('@/components/office/ClientCareGradeBudgetsModals.web', () => {
  const modal = (name: string) => ({ visible, onClose }: { visible: boolean; onClose: () => void }) => visible ? <div role="dialog" aria-label={name}><button onClick={onClose}>Dialog schließen</button></div> : null;
  return { EditCareGradeModal: modal('Pflegegrad bearbeiten'), EditCareFundModal: modal('Pflegekasse bearbeiten'), EditValidFromModal: modal('Gültigkeit bearbeiten'), ConversionToggleModal: modal('Umwandlung bearbeiten'), BudgetCorrectionModal: modal('Korrektur'), ExternalSachleistungModal: modal('Pflegedienstanteil'), BudgetRecalcModal: modal('Konten anlegen') };
});

function profile(overrides: Partial<TestProfile> = {}): TestProfile {
  return { asOfDate: '2026-10-17', budgetYear: 2026, careGrade: 'pg2', careEntitlement: null, careGradeNeedsConfirmation: false,
    fundingSources: ['entlastungsleistung'], fundingSelection: { id: 'selection-a', sources: overrides.fundingSources ?? ['entlastungsleistung'], effectiveFrom: '2026-01-01' }, planningProjection: { additionalCents: 0, unallocatedCents: 0, unpricedVisits: 0 }, conversionEligible: false,
    carePreventionMode: 'joint_annual_budget', serviceEntitlements: [], budgetAccounts: [], budgetVisualAccounts: [], priorityRules: [], warnings: [], templates: [], canUseBudgetByCatalogKey: {}, ...overrides };
}
function transaction(index: number): ClientBudgetTransaction {
  return { id: `tx-${index}`, tenantId: 'tenant-a', clientId: 'client-a', budgetAccountId: 'account-a', transactionType: index % 2 ? 'usage' : 'reservation', amountCents: index * 100, balanceAfterCents: 30000 - index * 100,
    referenceType: null, referenceId: null, note: `Buchung Nummer ${index}`, createdBy: null, createdAt: '2026-10-17T08:00:00.000Z', catalogKey: 'paragraph_45b' };
}
function warning(type: string, message: string, resolved = false): ClientBillingWarning {
  return { id: type, tenantId: 'tenant-a', clientId: 'client-a', warningType: type, severity: 'warning', catalogKey: null, budgetAccountId: null, message, isResolved: resolved, resolvedAt: null, createdAt: '2026-10-17T08:00:00.000Z' };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let host: HTMLDivElement, root: Root;
let clientId: string;
let onRecordRefresh: ReturnType<typeof vi.fn>;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.tenant = 'tenant-a'; state.user = 'user-a'; state.role = 'billing'; state.permissions = ['clients.billing_profile.view', 'clients.budgets.edit'];
  state.profile = profile(); state.profileError = null; state.transactions = []; state.transactionError = null;
  clientId = 'client-a'; onRecordRefresh = vi.fn();
  state.fetchProfile.mockReset().mockImplementation(async () => state.profileError ? { ok: false, error: state.profileError } : { ok: true, data: state.profile });
  state.fetchTransactions.mockReset().mockImplementation(async (_tenant, _client, options) => state.transactionError ? { ok: false, error: state.transactionError } : { ok: true, data: state.transactions.filter(tx => !options.transactionType || tx.transactionType === options.transactionType).slice(options.offset, options.offset + options.limit) });
  state.save.mockReset().mockImplementation(async (_tenant, _client, sources, effectiveFrom) => {
    state.profile = { ...state.profile!, fundingSources: sources, fundingSelection: { id: 'receipt-1', sources, effectiveFrom } };
    return { ok: true, data: { id: 'receipt-1', sources, effectiveFrom } };
  });
  state.guard.mockReset();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = async () => { await act(async () => root.render(<ClientCareGradeBudgetsPanel clientId={clientId} clientName={clientId === 'client-a' ? 'Erste Person' : 'Zweite Person'} onRecordRefresh={onRecordRefresh} />)); };
const button = (label: string) => { const result = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent?.trim() === label); expect(result, label).toBeTruthy(); return result!; };
const click = async (node: HTMLElement) => { await act(async () => node.click()); };
const checkbox = (label: string) => { const item = Array.from(host.querySelectorAll('label')).find(node => node.querySelector('strong')?.textContent === label); expect(item, label).toBeTruthy(); return item!.querySelector<HTMLInputElement>('input')!; };
const selected = () => Array.from(host.querySelectorAll<HTMLInputElement>('.cs-funding input:checked')).map(node => node.closest('label')!.querySelector('strong')!.textContent);
const save = () => { const result = host.querySelector<HTMLButtonElement>('.bw-funding-actions .bw-button--primary'); expect(result).toBeTruthy(); return result!; };

// The real useAsyncQuery is retained. Backend/auth/live refresh are mocked;
// these checks prove DOM interactions and state transitions, not visual geometry.
describe('Budget workspace funding workflow', () => {
  it('lets legacy inferred financing be explicitly confirmed without requiring a change', async () => {
    state.profile = profile({ fundingSelection: null }); await render();
    expect(save().disabled).toBe(false);
    await click(save());
    expect(state.save.mock.calls[0][2]).toEqual(['entlastungsleistung']);
    expect(state.save.mock.calls[0][4]).toEqual([]);
    expect(host.textContent).toContain('Finanzierungsarten gespeichert.');
    expect(save().disabled).toBe(true);
  });

  it('keeps a changed selection when the profile refreshes with unchanged saved sources', async () => {
    await render(); await click(checkbox('40-%-Umwandlung'));
    state.profile = { ...state.profile!, careGrade: 'pg3' };
    await click(button('Aktualisieren'));
    expect(selected()).toEqual(['Entlastungsleistungen', '40-%-Umwandlung']);
    expect(host.textContent).toContain('Pflegegrad 3'); expect(save().disabled).toBe(false);
    expect(state.save).not.toHaveBeenCalled(); expect(state.guard).toHaveBeenLastCalledWith(true, false);
  });

  it('blocks conflicting writes and offers the current saved selection without silently discarding the draft', async () => {
    await render(); await click(checkbox('40-%-Umwandlung'));
    state.profile = profile({ fundingSources: ['selbstzahler'] });
    await click(button('Aktualisieren'));
    expect(selected()).toEqual(['Entlastungsleistungen', '40-%-Umwandlung']);
    expect(host.textContent).toContain('inzwischen geändert'); expect(save().disabled).toBe(true);
    await click(save()); expect(state.save).not.toHaveBeenCalled();
    await click(button('Gespeicherte Auswahl übernehmen'));
    expect(selected()).toEqual(['Selbstzahler']); expect(save().disabled).toBe(true);
  });

  it('does not submit an empty funding selection', async () => {
    await render(); await click(checkbox('Entlastungsleistungen'));
    expect(selected()).toEqual([]); expect(save().disabled).toBe(true);
    await click(save()); expect(state.save).not.toHaveBeenCalled();
    await click(button('Zurücksetzen')); expect(selected()).toEqual(['Entlastungsleistungen']);
  });

  it('serializes same-tick clicks and does not show success before an acknowledged receipt', async () => {
    const pending = deferred<{ ok: true; data: { id: string; sources: ClientFundingSourceKey[] } }>();
    state.save.mockReturnValue(pending.promise);
    await render(); await click(checkbox('40-%-Umwandlung'));
    const action = save(); await act(async () => { action.click(); action.click(); });
    expect(state.save).toHaveBeenCalledTimes(1); expect(host.textContent).not.toContain('Finanzierungsarten gespeichert.');
    expect(button('Wird gespeichert …').disabled).toBe(true);
    state.profile = profile({ fundingSources: ['entlastungsleistung', 'umwandlung'] });
    await act(async () => pending.resolve({ ok: true, data: { id: 'receipt', sources: ['entlastungsleistung', 'umwandlung'] } }));
    expect(host.textContent).toContain('Finanzierungsarten gespeichert.'); expect(save().disabled).toBe(true);
  });

  it('keeps the acknowledged funding selection when an older profile poll finishes during save', async () => {
    await render(); await click(checkbox('40-%-Umwandlung'));
    const oldProfile = state.profile!;
    const poll = deferred<{ ok: true; data: TestProfile }>();
    state.fetchProfile.mockReturnValueOnce(poll.promise);
    await click(button('Aktualisieren'));
    expect(button('Wird aktualisiert …').disabled).toBe(true);
    await click(save());
    expect(selected()).toEqual(['Entlastungsleistungen', '40-%-Umwandlung']);
    expect(host.textContent).toContain('Finanzierungsarten gespeichert.');
    await act(async () => poll.resolve({ ok: true, data: oldProfile }));
    expect(selected()).toEqual(['Entlastungsleistungen', '40-%-Umwandlung']);
    expect(save().disabled).toBe(true); expect(state.save).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain('inzwischen geändert');
    expect(state.fetchProfile).toHaveBeenCalledTimes(3);
  });

  it('keeps a rejected draft editable and uses a fresh operation for a definitively rejected retry', async () => {
    state.save.mockResolvedValueOnce({ ok: false, error: 'Änderung abgelehnt.' });
    await render(); await click(checkbox('40-%-Umwandlung')); await click(save());
    const firstOperation = state.save.mock.calls[0][5];
    expect(selected()).toEqual(['Entlastungsleistungen', '40-%-Umwandlung']);
    expect(save().disabled).toBe(false); expect(host.textContent).not.toContain('Finanzierungsarten gespeichert.');
    await click(save()); expect(state.save.mock.calls[1][5]).not.toBe(firstOperation);
    expect(host.textContent).toContain('Finanzierungsarten gespeichert.');
  });

  it.each(['uncertain', 'throw'] as const)('preserves the exact operation and locked draft while checking an %s result', async kind => {
    if (kind === 'uncertain') state.save.mockResolvedValueOnce({ ok: false, error: 'Bestätigung fehlt.', uncertain: true });
    else state.save.mockRejectedValueOnce(new Error('lost response'));
    await render(); await click(checkbox('40-%-Umwandlung')); await click(save());
    const first = state.save.mock.calls[0];
    expect(host.querySelector<HTMLFieldSetElement>('.cs-funding')?.disabled).toBe(true);
    expect(host.textContent).not.toContain('Finanzierungsarten gespeichert.');
    expect(selected()).toEqual(['Entlastungsleistungen', '40-%-Umwandlung']);
    await click(button('Speicherstand prüfen'));
    expect(state.save.mock.calls[1]).toEqual(first);
    expect(host.textContent).toContain('Finanzierungsarten gespeichert.');
  });

  it('treats a mismatched positive response as uncertain and does not claim success', async () => {
    state.save.mockResolvedValueOnce({ ok: true, data: { id: 'receipt', sources: ['selbstzahler'] } });
    await render(); await click(checkbox('40-%-Umwandlung')); await click(save());
    expect(host.textContent).toContain('passt nicht zur Auswahl');
    expect(host.textContent).not.toContain('Finanzierungsarten gespeichert.');
    expect(selected()).toEqual(['Entlastungsleistungen', '40-%-Umwandlung']);
    await click(button('Speicherstand prüfen'));
    expect(state.save.mock.calls[1]).toEqual(state.save.mock.calls[0]);
  });

  it('does not repeat a confirmed save if its subsequent refresh fails', async () => {
    await render(); await click(checkbox('40-%-Umwandlung'));
    state.profileError = 'Aktueller Stand nicht abrufbar.';
    await click(save());
    expect(state.save).toHaveBeenCalledTimes(1); expect(host.textContent).toContain('Finanzierungsarten gespeichert.');
    expect(host.textContent).toContain('nicht vollständig neu geladen'); expect(save().disabled).toBe(true);
    state.profileError = null; await click(button('Aktualisieren'));
    expect(state.save).toHaveBeenCalledTimes(1); expect(selected()).toEqual(['Entlastungsleistungen', '40-%-Umwandlung']);
  });

  it('blocks editing while the retained profile has a refresh error', async () => {
    await render(); await click(checkbox('40-%-Umwandlung'));
    state.profileError = 'Abfrage abgelehnt.'; await click(button('Aktualisieren'));
    expect(host.textContent).toContain('zuletzt geladene Stand');
    expect(host.textContent).not.toContain('wurde gespeichert'); expect(state.save).not.toHaveBeenCalled();
    expect(save().disabled).toBe(true); expect(host.querySelector<HTMLFieldSetElement>('.cs-funding')?.disabled).toBe(true);
    expect(selected()).toEqual(['Entlastungsleistungen', '40-%-Umwandlung']);
  });
});

describe('Budget workspace history and warning actions', () => {
  it('exposes all records past the previous 12-row truncation and filters across pages', async () => {
    state.transactions = Array.from({ length: 47 }, (_, index) => transaction(index + 1));
    await render(); expect(host.querySelectorAll('.bw-timeline li')).toHaveLength(20);
    expect(host.querySelector('.bw-timeline')?.textContent).toContain('Buchung Nummer 20');
    await click(button('Ältere Buchungen'));
    expect(host.querySelector('.bw-timeline')?.textContent).toContain('Buchung Nummer 21');
    await click(button('Ältere Buchungen'));
    expect(host.querySelectorAll('.bw-timeline li')).toHaveLength(7);
    expect(host.querySelector('.bw-timeline')?.textContent).toContain('Buchung Nummer 47');
    expect(button('Ältere Buchungen').disabled).toBe(true);
    await click(button('Verbraucht'));
    expect(state.fetchTransactions).toHaveBeenLastCalledWith('tenant-a', 'client-a', { transactionType: 'usage', offset: 0, limit: 21 });
    expect(host.querySelectorAll('.bw-timeline li')).toHaveLength(20);
    await click(button('Ältere Buchungen'));
    expect(host.querySelectorAll('.bw-timeline li')).toHaveLength(4);
    expect(host.querySelector('.bw-timeline')?.textContent).toContain('Buchung Nummer 47');
    await click(button('Neuere Buchungen'));
    expect(host.querySelector('.bw-pagination')?.textContent).toContain('Seite 1');
  });

  it('keeps a failed history read distinct from an empty history', async () => {
    state.transactionError = 'Buchungen nicht freigegeben.'; await render();
    expect(host.textContent).toContain('Buchungen nicht freigegeben.');
    expect(host.textContent).not.toContain('Noch keine Budgetbewegungen');
    state.transactionError = null; state.transactions = [transaction(1)]; await click(button('Verlauf erneut laden'));
    expect(host.querySelectorAll('.bw-timeline li')).toHaveLength(1);
  });

  it('routes actionable warnings to a real edit flow and never dismisses them as Geklärt', async () => {
    state.profile = profile({ warnings: [warning('missing_care_grade', 'Pflegegrad fehlt.'), warning('unknown_gap', 'Offenen Sachverhalt prüfen.'), warning('old', 'Bereits erledigt.', true)] });
    await render();
    const section = host.querySelector('[aria-label="Hinweise zur Budgetübersicht"]')!;
    expect(section.textContent).not.toContain('Geklärt'); expect(section.textContent).not.toContain('Bereits erledigt.');
    expect(section.textContent).toContain('Offenen Sachverhalt prüfen.');
    await click(button('Pflegegrad hinterlegen'));
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Pflegegrad bearbeiten');
    expect(state.save).not.toHaveBeenCalled();
  });
});

describe('Budget workspace identity and access boundary', () => {
  it('requires a real identity and a positive view permission before fetching', async () => {
    for (const setup of [() => { state.permissions = []; }, () => { state.permissions = ['clients.budgets.edit']; }, () => { state.permissions = ['clients.billing_profile.view']; state.tenant = null; }, () => { state.tenant = 'tenant-a'; state.user = null; }, () => { state.user = 'user-a'; state.role = null; }, ...['employee_portal', 'client_portal', 'family_portal'].map(role => () => { state.role = role; })]) {
      setup(); await render(); expect(host.querySelector('.cs-funding')).toBeNull();
    }
    expect(state.fetchProfile).not.toHaveBeenCalled(); expect(state.fetchTransactions).not.toHaveBeenCalled();
  });

  it('allows a view-only account to read without exposing write controls', async () => {
    state.permissions = ['clients.billing_profile.view']; await render();
    expect(host.querySelector<HTMLFieldSetElement>('.cs-funding')?.disabled).toBe(true);
    expect(host.querySelector('.bw-admin')).toBeNull(); expect(host.textContent).not.toContain('Auswahl speichern');
    expect(state.fetchProfile).toHaveBeenCalledWith({ tenantId: 'tenant-a', clientId: 'client-a' });
  });

  it('preserves drafts for equivalent permission ordering and clears them on identity or permission changes', async () => {
    await render(); await click(checkbox('40-%-Umwandlung'));
    state.permissions.reverse(); await render(); expect(selected()).toContain('40-%-Umwandlung');
    state.permissions.push(state.permissions[0]); await render(); expect(selected()).toContain('40-%-Umwandlung');
    for (const change of [() => { state.tenant = 'tenant-b'; }, () => { state.user = 'user-b'; }, () => { state.role = 'business_manager'; }, () => { clientId = 'client-b'; }, () => { state.permissions.push('office.clients.view'); }]) {
      if (!selected().includes('40-%-Umwandlung')) await click(checkbox('40-%-Umwandlung'));
      change(); await render(); expect(selected()).toEqual(['Entlastungsleistungen']);
    }
  });

  it('ignores an old identity save receipt after the selected client changes', async () => {
    const pending = deferred<unknown>(); state.save.mockReturnValueOnce(pending.promise);
    await render(); await click(checkbox('40-%-Umwandlung')); await click(save());
    clientId = 'client-b'; state.profile = profile({ fundingSources: ['selbstzahler'] }); await render();
    await act(async () => pending.resolve({ ok: true, data: { id: 'old-receipt', sources: ['entlastungsleistung', 'umwandlung'] } }));
    expect(selected()).toEqual(['Selbstzahler']); expect(host.textContent).toContain('Zweite Person');
    expect(host.textContent).not.toContain('Finanzierungsarten gespeichert.'); expect(onRecordRefresh).not.toHaveBeenCalled();
  });
});

describe('Funding selector contract', () => {
  it('uses accessible checkboxes and emits only the new draft selection', async () => {
    const onChange = vi.fn(); await act(async () => root.render(<ClientFundingSourceSelector values={['entlastungsleistung']} onChange={onChange} error="Bitte Auswahl prüfen." />));
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(4);
    expect(host.querySelector('fieldset')?.getAttribute('aria-describedby')).toBe(host.querySelector('[role="alert"]')?.id);
    await click(checkbox('40-%-Umwandlung'));
    expect(onChange).toHaveBeenCalledWith(['entlastungsleistung', 'umwandlung']);
    expect(state.save).not.toHaveBeenCalled();
  });
});
