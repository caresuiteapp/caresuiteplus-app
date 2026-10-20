// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), dirty: false, permitted: true }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => h.permitted ? null : { ok: false, error: 'Kein Zugriff' } }));
vi.mock('@/hooks/useUnsavedWebChanges.web', () => ({ useUnsavedWebChanges: (dirty: boolean, busy: boolean) => { h.dirty = dirty; return async () => !dirty && !busy; } }));
vi.mock('@/lib/tenant/companyCostCenters.web', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/tenant/companyCostCenters.web')>(), loadCompanyCostCenters: (...args: unknown[]) => h.load(...args), saveCompanyCostCenter: (...args: unknown[]) => h.save(...args) }));
import { CompanyCostCentersPanel } from '@/components/company/CompanyCostCentersPanel.web';
const T = '11111111-1111-4111-8111-111111111111'; const C = '22222222-2222-4222-8222-222222222222';
const cost = { id: C, code: 'VERW', name: 'Verwaltung', organizationId: null, isActive: true, updatedAt: 'v1' };
let host: HTMLDivElement; let root: Root;
const render = (tenantId = T) => act(async () => root.render(<CompanyCostCentersPanel tenantId={tenantId} roleKey="business_admin" effectivePermissions={['business.tenant.manage']} />));
const button = (text: string) => Array.from(host.querySelectorAll('button')).find(item => item.textContent === text)!;
const click = (text: string) => act(async () => button(text).click());
const change = async (input: HTMLInputElement, value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; h.permitted = true; h.load.mockReset().mockResolvedValue({ ok: true, data: { costCenters: [cost], organizations: [] } }); h.save.mockReset().mockResolvedValue({ ok: true, data: { ...cost, name: 'Leitung', updatedAt: 'v2' } }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('company cost center panel', () => {
  it('edits a real cost center and preserves its previous version for saving', async () => {
    await render(); await click('Bearbeiten'); const inputs = host.querySelectorAll<HTMLInputElement>('form input'); await change(inputs[1], 'Leitung'); expect(h.dirty).toBe(true);
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(h.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: T }), expect.objectContaining({ id: C, expectedUpdatedAt: 'v1', name: 'Leitung' })); expect(host.textContent).toContain('Kostenstelle gespeichert.'); expect(host.querySelector('form')).toBeNull();
  });
  it('keeps a conflicted draft and blocks duplicate save attempts', async () => {
    h.save.mockResolvedValue({ ok: false, reloadRequired: true, error: 'Inzwischen geändert' }); await render(); await click('Bearbeiten'); await change(host.querySelectorAll<HTMLInputElement>('form input')[1], 'Leitung');
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(host.querySelectorAll<HTMLInputElement>('form input')[1].value).toBe('Leitung'); expect(host.querySelector('fieldset')?.disabled).toBe(true); expect(button('Kostenstelle speichern').disabled).toBe(true); expect(h.save).toHaveBeenCalledTimes(1);
  });
  it('shows no data for denied rights and clears drafts when tenant changes', async () => {
    await render(); await click('Bearbeiten'); await change(host.querySelectorAll<HTMLInputElement>('form input')[1], 'Entwurf'); await render('33333333-3333-4333-8333-333333333333'); expect(host.querySelector('form')).toBeNull();
    h.permitted = false; await render('44444444-4444-4444-8444-444444444444'); expect(host.querySelector('section')).toBeNull();
  });
});
