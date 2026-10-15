// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantCustomFieldDefinition } from '@/types/tenant/tenantCenter';
const h = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), dirty: false, busy: false, permitted: true }));
vi.mock('@/hooks/useUnsavedWebChanges.web', () => ({ useUnsavedWebChanges: (dirty: boolean, busy: boolean) => { h.dirty = dirty; h.busy = busy; return async () => !dirty && !busy; } }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => h.permitted ? null : { ok: false, error: 'Kein Zugriff' } }));
vi.mock('@/lib/tenant/companyCustomValues.web', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/tenant/companyCustomValues.web')>(), loadCompanyCustomValues: (...args: unknown[]) => h.load(...args), saveCompanyCustomValue: (...args: unknown[]) => h.save(...args) }));
import { CompanyCustomValuesPanel } from '@/components/company/CompanyCustomValuesPanel.web';
let root: Root; let host: HTMLDivElement;
const field: TenantCustomFieldDefinition = { id: 'f1', groupId: null, fieldKey: 'office', label: 'Büronummer', dataType: 'text', moduleKey: null, functionKey: 'documents', visibility: { office: true }, validation: {}, isActive: true, sortOrder: 0 };
const render = (tenantId = 't1', fields = [field]) => act(async () => root.render(<CompanyCustomValuesPanel tenantId={tenantId} roleKey="business_admin" effectivePermissions={['business.tenant.manage']} fields={fields} />));
const change = async (value: string) => act(async () => { const input = host.querySelector('input')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
const submit = () => act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; h.permitted = true; h.load.mockReset(); h.save.mockReset(); h.load.mockResolvedValue({ ok: true, data: [{ definitionId: 'f1', value: 'Alt', updatedAt: 'v1' }] }); h.save.mockResolvedValue({ ok: true, data: { definitionId: 'f1', value: 'Neu', updatedAt: 'v2' } }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('company custom values editor', () => {
  it('loads existing values, marks drafts dirty and saves with expected timestamp', async () => {
    await render(); expect(host.querySelector('input')?.value).toBe('Alt'); await change('Neu'); expect(h.dirty).toBe(true);
    await submit(); expect(h.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't1' }), 'f1', 'Neu', 'v1'); expect(h.dirty).toBe(false); expect(host.textContent).toContain('Eigene Angaben gespeichert');
  });
  it('retains unconfirmed edits and prevents another write until reload', async () => {
    h.save.mockResolvedValue({ ok: false, reloadRequired: true, error: 'Bitte neu laden' }); await render(); await change('Unbestätigt'); await submit();
    expect(host.querySelector('input')?.value).toBe('Unbestätigt'); expect(host.querySelector('input')?.disabled).toBe(true); expect(h.dirty).toBe(true); await submit(); expect(h.save).toHaveBeenCalledTimes(1);
  });
  it('clears prior tenant drafts and ignores late data from an old tenant', async () => {
    let finish!: (value: unknown) => void; h.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await render('t1'); await render('t2'); expect(host.querySelector('input')?.value).toBe('Alt');
    await act(async () => finish({ ok: true, data: [{ definitionId: 'f1', value: 'OLD TENANT', updatedAt: 'old' }] }));
    expect(host.querySelector('input')?.value).toBe('Alt'); expect(host.textContent).not.toContain('OLD TENANT');
  });
  it('does not confuse false with an unset field and hides protected definitions', async () => {
    h.load.mockResolvedValue({ ok: true, data: [{ definitionId: 'f1', value: false, updatedAt: 'v1' }] });
    await render('t1', [{ ...field, dataType: 'boolean' }, { ...field, id: 'secret', label: 'Geheimnis', visibility: { office: true, protected: true } }]);
    expect(host.querySelector('select')?.value).toBe('false'); expect(host.textContent).not.toContain('Geheimnis'); expect(h.dirty).toBe(false);
  });
  it('performs no read and renders no values without permission', async () => {
    h.permitted = false; await render(); expect(h.load).not.toHaveBeenCalled(); expect(host.querySelector('input')).toBeNull();
  });
});
