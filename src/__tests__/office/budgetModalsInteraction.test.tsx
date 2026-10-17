// @vitest-environment happy-dom
// DOM behavior only; does not establish browser geometry or visual acceptance.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetCorrectionModal, BudgetDeactivateModal, BudgetRecalcModal, ConversionToggleModal, EditCareFundModal, EditCareGradeModal, EditValidFromModal, ExternalSachleistungModal } from '@/components/office/ClientCareGradeBudgetsModals.web';
import { isBudgetModalDate, parseBudgetModalAmount } from '@/components/office/budgetModalModel.web';
import type { ClientAssistBillingProfile, ClientBudgetAccount } from '@/types/assist/clientAssistBilling';

const h = vi.hoisted(() => ({ tenant: 'tenant-a' as string | null, close: vi.fn(), saved: vi.fn(), leave: vi.fn(), dirty: false, busy: false, grade: vi.fn(), fund: vi.fn(), date: vi.fn(), conversion: vi.fn(), correction: vi.fn(), external: vi.fn(), preview: vi.fn(), apply: vi.fn(), deactivate: vi.fn() }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenant }));
vi.mock('@/hooks/useUnsavedWebChanges.web', () => ({ useUnsavedWebChanges: (dirty: boolean, busy: boolean) => { h.dirty = dirty; h.busy = busy; return h.leave; } }));
vi.mock('@/lib/assist/budgetWorkspaceMutations.web', () => ({ changeClientCareGrade: h.grade, updateClientCareFund: h.fund, updateCareEntitlementValidFrom: h.date, setClientConversionEnabled: h.conversion, bookBudgetCorrection: h.correction, updateClientBudgetAccount: h.external, previewBudgetRecalculationFromCatalog: h.preview, applyBudgetRecalculation: h.apply, deactivateClientBudgetAccount: h.deactivate }));

function account(patch: Partial<ClientBudgetAccount> = {}): ClientBudgetAccount { return { id: 'account-a', tenantId: 'tenant-a', clientId: 'client-a', catalogTemplateId: 'template-a', catalogKey: 'paragraph_45b', catalogYear: 2026, period: 'monthly', periodStart: '2026-10-01', periodEnd: '2026-10-31', allocatedCents: 13100, usedCents: 1000, reservedCents: 2000, isIndividualOverride: false, individualAmountCents: null, standardAmountCents: 13100, locked: false, lockReason: null, isEnabled: true, catalogSnapshot: {}, billingPriority: 1, status: 'active', notes: null, label: 'Entlastungsbudget', ...patch }; }
function profile(patch: Partial<ClientAssistBillingProfile> = {}): ClientAssistBillingProfile { return { asOfDate: '2026-10-17', budgetYear: 2026, careGrade: 'pg2', careEntitlement: { id: 'entitlement-a', tenantId: 'tenant-a', clientId: 'client-a', careGrade: 'pg2', validFrom: '2026-01-01', validUntil: null, conversionEnabled: false, careFundName: 'Beispielkasse', careFundMemberId: 'A123', mdAssessmentDate: null, notes: null, source: 'manual' }, conversionEligible: true, carePreventionMode: 'joint_annual_budget', serviceEntitlements: [], budgetAccounts: [account()], priorityRules: [], warnings: [], templates: [], canUseBudgetByCatalogKey: {}, ...patch }; }
const diff = { accountId: 'account-a', catalogKey: 'paragraph_45b', label: 'Entlastungsbudget', currentAllocatedCents: 10000, catalogAmountCents: 13100, deltaCents: 3100, skipped: false };
const base = () => ({ visible: true, clientId: 'client-a', isReadOnly: false, onClose: h.close, onSaved: h.saved });
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); h.tenant = 'tenant-a'; h.dirty = false; h.busy = false;
  h.leave.mockResolvedValue(true); h.saved.mockResolvedValue(undefined);
  for (const fn of [h.grade, h.fund, h.date, h.conversion, h.external, h.deactivate]) fn.mockReset().mockResolvedValue({ ok: true, data: { id: 'receipt' } });
  h.correction.mockReset().mockResolvedValue({ ok: true, data: { transactionId: 'transaction-a' } }); h.preview.mockReset().mockResolvedValue({ ok: true, data: [diff] }); h.apply.mockReset().mockResolvedValue({ ok: true, data: { updated: 1, created: 0 } });
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
function button(label: string) { const node = [...document.querySelectorAll<HTMLButtonElement>('.cbm-dialog button')].find(item => item.textContent?.trim() === label || item.getAttribute('aria-label') === label); expect(node, label).toBeDefined(); return node!; }
const click = async (label: string) => { await act(async () => button(label).click()); };
const submit = async () => { await act(async () => document.querySelector('.cbm-dialog form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); };
async function field(label: string, value: string) {
  const node = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`.cbm-dialog [aria-label="${label}"]`)!; expect(node, label).not.toBeNull();
  await act(async () => { const proto = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(node, value); node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); if (node instanceof HTMLInputElement && node.type === 'date') node.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function correctionFields() { await field('Korrekturbetrag (€)', '-25,50'); await field('Wirksamkeitsdatum', '2026-10-17'); await field('Begründung', 'Abgleich mit Bescheid'); }
const content = () => document.querySelector('.cbm-dialog')?.textContent ?? '';

describe('Web budget input validation', () => {
  it.each([['50', 5000], ['-25,50', -2550], ['1.234,56', 123456], ['50.25', 5025], ['+0,01', 1], ['1.234', 123400], ['0', 0]])('parses exact cents %s', (text, expected) => expect(parseBudgetModalAmount(text)).toBe(expected));
  it.each(['', '50abc', 'Infinity', 'NaN', '1e3', '1,234', '1.2.3', '5 000', '21474836,48'])('rejects ambiguous or invalid amount %s', text => expect(parseBudgetModalAmount(text)).toBeNull());
  it('rejects impossible calendar dates rather than normalizing them', () => { expect(isBudgetModalDate('2026-02-30')).toBe(false); expect(isBudgetModalDate('2026-02-29')).toBe(false); expect(isBudgetModalDate('2028-02-29')).toBe(true); expect(isBudgetModalDate('0000-01-01')).toBe(false); expect(isBudgetModalDate('2026-13-01')).toBe(false); });
});

describe('Web budget modal workflows', () => {
  it('keeps edits across profile polling and awaits refresh after one confirmed care-fund save', async () => {
    let finish!: () => void; h.saved.mockReturnValue(new Promise<void>(resolve => { finish = resolve; })); const initial = profile();
    await render(<EditCareFundModal {...base()} profile={initial} />); await field('Pflegekasse', 'Neue Kasse'); await field('Begründung', 'Kassenwechsel');
    await render(<EditCareFundModal {...base()} profile={{ ...initial, careEntitlement: { ...initial.careEntitlement!, notes: 'Hintergrundaktualisierung' } }} />);
    expect((document.querySelector('[aria-label="Pflegekasse"]') as HTMLInputElement).value).toBe('Neue Kasse');
    await submit(); expect(h.fund).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', { careFundName: 'Neue Kasse', careFundMemberId: 'A123', reason: 'Kassenwechsel' }, expect.any(String), initial.careEntitlement);
    expect(button('Dialog schließen').disabled).toBe(true); expect(h.close).not.toHaveBeenCalled();
    await act(async () => finish()); expect(button('Fertig').disabled).toBe(false); expect(h.close).not.toHaveBeenCalled(); await click('Fertig'); expect(h.close).toHaveBeenCalledOnce();
  });
  it('validates required care-fund fields before sending anything', async () => {
    await render(<EditCareFundModal {...base()} profile={profile()} />); await field('Pflegekasse', ''); await submit();
    expect(h.fund).not.toHaveBeenCalled(); expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2);
  });
  it('books exact negative cents once and prevents close or duplicate submit while pending', async () => {
    let finish!: (value: unknown) => void; h.correction.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await render(<BudgetCorrectionModal {...base()} accounts={[account()]} />); await correctionFields();
    await act(async () => { const node = document.querySelector('.cbm-dialog form')!; node.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); node.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(h.correction).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', { budgetAccountId: 'account-a', amountCents: -2550, effectiveDate: '2026-10-17', reason: 'Abgleich mit Bescheid' }, expect.any(String));
    await act(async () => document.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));
    expect(h.close).not.toHaveBeenCalled(); expect(button('Abbrechen').disabled).toBe(true);
    await act(async () => finish({ ok: true, data: { transactionId: 'transaction-a' } })); expect(content()).toContain('Budgetkorrektur wurde gebucht'); expect(h.saved).toHaveBeenCalledOnce();
  });
  it('requires explicit account choice for multiple months and rejects out-of-period dates', async () => {
    await render(<BudgetCorrectionModal {...base()} accounts={[account(), account({ id: 'account-b', periodStart: '2026-09-01', periodEnd: '2026-09-30' })]} />); await correctionFields(); await submit();
    expect(h.correction).not.toHaveBeenCalled(); expect(content()).toContain('Budgetkonto auswählen');
    await field('Budgetkonto', 'account-b'); await submit(); expect(content()).toContain('im Zeitraum des gewählten Kontos'); expect(h.correction).not.toHaveBeenCalled();
    await field('Wirksamkeitsdatum', '2026-09-25'); await submit(); expect(h.correction).toHaveBeenCalledOnce();
  });
  it('rejects junk monetary prefixes without losing the correction draft', async () => {
    await render(<BudgetCorrectionModal {...base()} accounts={[account()]} />); await correctionFields(); await field('Korrekturbetrag (€)', '25abc'); await submit();
    expect(h.correction).not.toHaveBeenCalled(); expect((document.querySelector('[aria-label="Korrekturbetrag (€)"]') as HTMLInputElement).value).toBe('25abc');
  });
  it('retains a rejected operation and permits a corrected retry', async () => {
    h.correction.mockResolvedValueOnce({ ok: false, error: 'Korrektur würde Verbrauch unterschreiten.' });
    await render(<BudgetCorrectionModal {...base()} accounts={[account()]} />); await correctionFields(); await submit(); expect(content()).toContain('Verbrauch unterschreiten'); expect(h.saved).not.toHaveBeenCalled();
    await field('Korrekturbetrag (€)', '25,50'); await submit(); expect(h.correction).toHaveBeenCalledTimes(2); expect(h.saved).toHaveBeenCalledOnce();
  });
  it('locks uncertain or receiptless financial writes until the overview is checked', async () => {
    h.correction.mockResolvedValueOnce({ ok: true, data: {} }); await render(<BudgetCorrectionModal {...base()} accounts={[account()]} />); await correctionFields(); await submit();
    expect(content()).toContain('nicht vollständig bestätigt'); expect(button('Korrektur buchen').disabled).toBe(true); await submit(); expect(h.correction).toHaveBeenCalledOnce(); expect(h.saved).not.toHaveBeenCalled();
    expect(button('Abbrechen').disabled).toBe(true); await click('Speicherstand prüfen'); expect(h.saved).toHaveBeenCalledOnce(); expect(h.close).not.toHaveBeenCalled(); expect(h.correction).toHaveBeenCalledTimes(2); expect(h.correction.mock.calls[1]).toEqual(h.correction.mock.calls[0]);
  });
  it('handles thrown transport errors without closing or permitting duplicate writes', async () => {
    h.grade.mockRejectedValueOnce(new Error('transport')); await render(<EditCareGradeModal {...base()} profile={profile()} />); await click('PG 3'); await field('Begründung', 'Neuer Bescheid'); await submit();
    expect(content()).toContain('Ob die Änderung gespeichert wurde, ist noch unklar'); expect(h.close).not.toHaveBeenCalled(); expect(h.saved).not.toHaveBeenCalled(); expect(button('Speichern').disabled).toBe(true);
  });
  it('separates a successful write from a failed overview refresh and never writes twice', async () => {
    h.saved.mockRejectedValueOnce(new Error('reload')); await render(<EditCareFundModal {...base()} profile={profile()} />); await field('Pflegekasse', 'Neue Kasse'); await field('Begründung', 'Bescheid'); await submit();
    expect(content()).toContain('Änderung ist gespeichert'); expect(h.fund).toHaveBeenCalledOnce(); await submit(); expect(h.fund).toHaveBeenCalledOnce();
    await click('Übersicht aktualisieren'); expect(h.saved).toHaveBeenCalledTimes(2); expect(content()).not.toContain('Übersicht konnte jedoch'); expect(h.fund).toHaveBeenCalledOnce();
  });
  it('protects dirty dialog closure and clears a draft only on the next opening', async () => {
    h.leave.mockResolvedValue(false); const props = { ...base(), profile: profile() }; await render(<EditCareFundModal {...props} />); await field('Pflegekasse', 'Entwurf'); await click('Abbrechen');
    expect(h.dirty).toBe(true); expect(h.close).not.toHaveBeenCalled(); await render(<EditCareFundModal {...props} visible={false} />); expect(document.querySelector('dialog')).toBeNull();
    await render(<EditCareFundModal {...props} />); expect((document.querySelector('[aria-label="Pflegekasse"]') as HTMLInputElement).value).toBe('Beispielkasse');
  });
  it('prevents mutation even for manually dispatched submissions in read-only or missing-tenant mode', async () => {
    await render(<EditCareFundModal {...base()} isReadOnly profile={profile()} />); await submit(); expect(h.fund).not.toHaveBeenCalled(); expect(document.querySelector('fieldset')?.disabled).toBe(true);
    h.tenant = null; await render(<EditCareFundModal {...base()} profile={profile()} />); await submit(); expect(h.fund).not.toHaveBeenCalled(); expect(content()).toContain('Unternehmenszuordnung fehlt');
  });
  it('records grade and corrected effective date with required reasons', async () => {
    await render(<EditCareGradeModal {...base()} profile={profile()} />); await click('PG 4'); await field('Gültig ab', '2026-09-01'); await field('Begründung', 'Neuer Bescheid'); await submit();
    expect(h.grade).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', { newCareGrade: 'pg4', effectiveFrom: '2026-09-01', reason: 'Neuer Bescheid' }, expect.any(String), expect.objectContaining({ id: 'entitlement-a' }));
    await render(<EditValidFromModal {...base()} profile={profile()} />); await field('Gültig ab', '2026-02-01'); await field('Begründung', 'Datumsberichtigung'); await submit(); expect(h.date).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', { validFrom: '2026-02-01', reason: 'Datumsberichtigung' }, expect.any(String), expect.objectContaining({ id: 'entitlement-a' }));
  });
  it('preserves the intended conversion target and blocks a conflicting concurrent change', async () => {
    const initial = profile(); await render(<ConversionToggleModal {...base()} profile={initial} />); await field('Begründung', 'Einwilligung liegt vor');
    await render(<ConversionToggleModal {...base()} profile={{ ...initial, careEntitlement: { ...initial.careEntitlement!, conversionEnabled: true } }} />); await submit(); expect(h.conversion).not.toHaveBeenCalled(); expect(content()).toContain('zwischenzeitlich geändert'); expect(content()).toContain('Umwandlung § 45a aktivieren');
  });
  it('selects only the displayed conversion month and accepts zero to clear a known amount', async () => {
    const accounts = [account({ id: 'old', catalogKey: 'umwandlung_pg2', periodStart: '2026-09-01', periodEnd: '2026-09-30', externalSachleistungCents: 20000 }), account({ id: 'current', catalogKey: 'umwandlung_pg2', externalSachleistungCents: 10000 })];
    await render(<ExternalSachleistungModal {...base()} accounts={accounts} asOfDate="2026-10-17" />); expect(document.querySelector('option[value="old"]')).toBeNull(); await field('Pflegesachleistung anderer Anbieter (€)', '0'); await field('Quelle / Begründung', 'Kasse bestätigt 0 Euro'); await submit();
    expect(h.external).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', 'current', { externalSachleistungCents: 0, auditReason: 'Kasse bestätigt 0 Euro' }, expect.any(String), accounts[1]);
  });
  it('blocks disabled, locked and foreign accounts from a correction', async () => {
    await render(<BudgetCorrectionModal {...base()} accounts={[account({ isEnabled: false }), account({ id: 'locked', locked: true }), account({ id: 'foreign', clientId: 'other' })]} />);
    expect(button('Korrektur buchen').disabled).toBe(true); await submit(); expect(h.correction).not.toHaveBeenCalled(); expect(content()).toContain('kein aktives, freigegebenes Budgetkonto');
  });
  it('never applies fallback diffs after a failed preview and offers a fresh retry', async () => {
    h.preview.mockResolvedValueOnce({ ok: false, error: 'Katalog nicht erreichbar' }); await render(<BudgetRecalcModal {...base()} profile={profile()} />); await field('Begründung', 'Jahresabgleich'); await submit();
    expect(h.apply).not.toHaveBeenCalled(); expect(button('Änderungen übernehmen').disabled).toBe(true); await click('Vorschau erneut laden'); await submit();
    expect(h.apply).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', [diff], 'Jahresabgleich', expect.any(String)); expect(h.preview).toHaveBeenCalledWith('tenant-a', 'client-a', 2026, 'pg2', true, expect.any(Object), '2026-10-17');
  });
  it('does not report zero-row recalculation as success', async () => {
    h.apply.mockResolvedValue({ ok: true, data: { updated: 0 } }); await render(<BudgetRecalcModal {...base()} profile={profile()} />); await field('Begründung', 'Jahresabgleich'); await submit();
    expect(content()).toContain('nicht vollständig bestätigt'); expect(h.saved).not.toHaveBeenCalled(); expect(button('Änderungen übernehmen').disabled).toBe(true);
  });
  it('can explicitly initialize a new account with a zero catalogue amount', async () => {
    const create = { ...diff, accountId: 'new:template', currentAllocatedCents: 0, catalogAmountCents: 0, deltaCents: 0, create: true }; h.preview.mockResolvedValue({ ok: true, data: [create] });
    await render(<BudgetRecalcModal {...base()} profile={profile({ budgetAccounts: [] })} />); expect(content()).toContain('Neues Konto'); await field('Begründung', 'Konten anlegen'); await submit(); expect(h.apply).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', [create], 'Konten anlegen', expect.any(String));
  });
  it('ignores an old preview after its modal closes and another session opens', async () => {
    let finish!: (value: unknown) => void; h.preview.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })); const props = { ...base(), profile: profile() };
    await render(<BudgetRecalcModal {...props} />); await render(<BudgetRecalcModal {...props} visible={false} />); await render(<BudgetRecalcModal {...props} />);
    await act(async () => finish({ ok: true, data: [{ ...diff, label: 'Veraltete Vorschau' }] })); expect(content()).not.toContain('Veraltete Vorschau'); expect(content()).toContain('Entlastungsbudget');
  });


  it('reconciles the identical pending operation even if its saved data arrives through polling first', async () => {
    h.fund.mockResolvedValueOnce({ ok: false, error: 'Antwort fehlt', uncertain: true }); const initial = profile();
    await render(<EditCareFundModal {...base()} profile={initial} />); await field('Pflegekasse', 'Neue Kasse'); await field('Begründung', 'Abgleich'); await submit();
    await render(<EditCareFundModal {...base()} profile={{ ...initial, careEntitlement: { ...initial.careEntitlement!, careFundName: 'Neue Kasse' } }} />);
    expect(button('Abbrechen').disabled).toBe(true); await click('Speicherstand prüfen'); expect(h.fund).toHaveBeenCalledTimes(2); expect(h.fund.mock.calls[1]).toEqual(h.fund.mock.calls[0]); expect(h.saved).toHaveBeenCalledOnce(); expect(button('Fertig').disabled).toBe(false);
  });
  it('blocks stale care details while preserving the draft for deliberate review', async () => {
    const initial = profile(); await render(<EditCareFundModal {...base()} profile={initial} />); await field('Pflegekasse', 'Mein Entwurf'); await field('Begründung', 'Abgleich');
    await render(<EditCareFundModal {...base()} profile={{ ...initial, careEntitlement: { ...initial.careEntitlement!, careFundName: 'Parallel geändert' } }} />); await submit();
    expect(h.fund).not.toHaveBeenCalled(); expect(content()).toContain('zwischenzeitlich geändert'); expect((document.querySelector('[aria-label="Pflegekasse"]') as HTMLInputElement).value).toBe('Mein Entwurf');
  });
  it('passes the opening entitlement snapshot when changing conversion', async () => {
    const initial = profile(); await render(<ConversionToggleModal {...base()} profile={initial} />); await field('Begründung', 'Einwilligung liegt vor'); await submit();
    expect(h.conversion).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', true, 'Einwilligung liegt vor', expect.any(String), initial.careEntitlement);
  });
  it('blocks a concurrent external amount change without replacing the typed amount', async () => {
    const source = account({ catalogKey: 'umwandlung_pg2', externalSachleistungCents: 10000 }); await render(<ExternalSachleistungModal {...base()} accounts={[source]} asOfDate="2026-10-17" />);
    await field('Pflegesachleistung anderer Anbieter (€)', '200'); await field('Quelle / Begründung', 'Abgleich');
    await render(<ExternalSachleistungModal {...base()} accounts={[{ ...source, externalSachleistungCents: 15000 }]} asOfDate="2026-10-17" />); await submit();
    expect(h.external).not.toHaveBeenCalled(); expect(content()).toContain('zwischenzeitlich geändert'); expect((document.querySelector('[aria-label="Pflegesachleistung anderer Anbieter (€)"]') as HTMLInputElement).value).toBe('200');
  });
  it('requires a reason to deactivate and retains historical account identity', async () => {
    await render(<BudgetDeactivateModal {...base()} account={account()} />); await submit(); expect(h.deactivate).not.toHaveBeenCalled(); await field('Begründung', 'Anspruch beendet'); await submit(); expect(h.deactivate).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', 'account-a', 'Anspruch beendet', expect.any(String));
  });
});
