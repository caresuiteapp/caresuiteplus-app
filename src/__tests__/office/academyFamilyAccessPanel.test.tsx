// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ list: vi.fn(), manage: vi.fn(), copy: vi.fn() }));
vi.mock('@/lib/clients/academyFamilyAccessService', () => ({ listAcademyFamilyAccess: f.list, manageAcademyFamilyAccess: f.manage }));
vi.mock('@/lib/platform/clipboard', () => ({ copyTextToClipboard: f.copy }));
import { AcademyFamilyAccessPanel } from '@/components/clients/AcademyFamilyAccessPanel.web';
import type { ClientContactRecord } from '@/types/modules/client';

const contact = { id: 'contact', firstName: 'Eva', lastName: 'Kontakt', contactType: 'relative', relationship: 'angehoerige' } as ClientContactRecord;
const account = { id: 'account', tenantId: 'tenant', clientId: 'client', contactId: 'contact', username: 'eva.kontakt', enabled: true, status: 'aktiv', lastLoginAt: null };
let host: HTMLDivElement; let root: Root;
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); f.list.mockResolvedValue({ accesses: [], ready: true }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (clientId = 'client') => act(async () => root.render(<AcademyFamilyAccessPanel tenantId="tenant" clientId={clientId} contacts={[contact]} isReadOnly={false} />));
const button = (label: string) => { const found = [...host.querySelectorAll('button')].find(b => b.textContent === label); if (!found) throw new Error(label); return found; };
async function selectContact() { await act(async () => { const select = host.querySelector('select')!; select.value = 'contact'; select.dispatchEvent(new Event('change', { bubbles: true })); }); }

describe('central family Academy access management', () => {
  it('keeps setup and activation closed until the server boundary is ready while allowing deactivation', async () => {
    f.list.mockResolvedValue({ accesses: [account], ready: false });
    f.manage.mockResolvedValue({ access: { ...account, enabled: false, status: 'deaktiviert' }, credentials: null });
    await render(); expect(button('Akademiezugang einrichten').disabled).toBe(true); expect(button('Code erneuern').disabled).toBe(true);
    expect(button('Deaktivieren').disabled).toBe(false);
    await act(async () => button('Deaktivieren').click());
    expect(f.manage).toHaveBeenCalledWith(expect.objectContaining({ action: 'disable', accountId: 'account', contactId: 'contact' }));
    expect(button('Aktivieren').disabled).toBe(true);
  });
  it('creates the selected contact account once, then shows that person’s one-time credentials', async () => {
    let finish!: (value: unknown) => void; f.manage.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await render(); await selectContact();
    await act(async () => { button('Akademiezugang einrichten').click(); button('Akademiezugang einrichten').click(); });
    expect(f.manage).toHaveBeenCalledTimes(1); expect(f.manage).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'contact', firstName: 'Eva', lastName: 'Kontakt', action: 'setup' }));
    await act(async () => finish({ access: account, credentials: { username: 'eva.kontakt', accessCode: '123456' } }));
    expect(host.textContent).toContain('Zugangsdaten für Eva Kontakt'); expect(host.textContent).toContain('123456');
    await act(async () => button('Zugangsdaten ausblenden').click()); expect(host.textContent).not.toContain('123456');
  });
  it('discards late credentials when the user changes the central client record', async () => {
    let finish!: (value: unknown) => void; f.manage.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await render(); await selectContact(); await act(async () => button('Akademiezugang einrichten').click());
    await render('other-client');
    await act(async () => finish({ access: account, credentials: { username: 'previous-person', accessCode: '123456' } }));
    expect(host.textContent).not.toContain('previous-person'); expect(host.textContent).not.toContain('123456');
  });
});
