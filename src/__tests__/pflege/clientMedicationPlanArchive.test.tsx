// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientMedicationPlanArchive } from '@/components/pflege/ClientMedicationPlanArchive.web';
import { takeMedicationPlanOrderHandoff } from '@/lib/pflege/medicationPlanOrderHandoff';

const mocks = vi.hoisted(() => ({ list: vi.fn(), read: vi.fn(), push: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('expo-crypto', async () => ({ randomUUID: (await import('node:crypto')).randomUUID }));
vi.mock('react-native', () => ({ StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/theme', () => ({ colors: {}, spacing: { sm: 8, xs: 4 }, typography: {} }));
vi.mock('@/components/ui', () => ({
  PremiumButton: ({ title, onPress }: { title: string; onPress: () => void }) => <button type="button" onClick={onPress}>{title}</button>,
  SectionPanel: ({ title, children }: { title: string; children: ReactNode }) => <section><h2>{title}</h2>{children}</section>,
}));
vi.mock('@/lib/pflege/medicationPlanImportService', () => ({ listMedicationPlanImports: mocks.list, getMedicationPlanImport: mocks.read }));

let host: HTMLDivElement, root: Root;
let allowed: boolean, manage: boolean;
const scope = { tenantId: '10000000-0000-0000-0000-000000000001', actorId: '10000000-0000-0000-0000-000000000002', isCurrent: () => allowed };
const item = { id: '10000000-0000-0000-0000-000000000003', clientId: '10000000-0000-0000-0000-000000000004', fileName: 'Testplan.xml', createdAt: '2026-11-12T08:00:00Z', positionCount: 1, confirmedCount: 1 };
const originalRow = { kind: 'medication', name: 'Testposition', pzn: null, ingredients: [], form: null, formCode: null,
  morning: '1', noon: null, evening: null, night: null, doseText: null, weekdayCode: null, page: 1, section: { label: null, code: null },
  unit: 'Tablette', unitCode: null, instructions: null, indication: 'Originalangabe', additionalText: null, source: { attributes: {} } };
const stored = { ...item, plan: { issuer: { name: 'Testaussteller' }, rows: [originalRow] }, confirmed: [{ rowIndex: 0 }] };
const render = () => act(async () => { root.render(<ClientMedicationPlanArchive scope={scope} clientId={item.clientId} canTransfer={() => manage} />); });
const button = (title: string) => [...host.querySelectorAll('button')].find(b => b.textContent === title)!;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  allowed = true; manage = false; host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  mocks.list.mockReset().mockResolvedValue([item]); mocks.read.mockReset().mockResolvedValue(stored);
  mocks.push.mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Medikationsplan in der eigenen Klientenakte', () => {
  it('shows only the case-scoped draft and exact read-only position', async () => {
    await render();
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: scope.tenantId, actorId: scope.actorId }), item.clientId);
    expect(host.textContent).toContain('1 von 1 bestätigt');
    await act(async () => button('Entwurf ansehen').click());
    expect(mocks.read).toHaveBeenCalledWith(expect.any(Object), item.id, item.clientId);
    await act(async () => button('Originalangaben anzeigen').click());
    expect(host.textContent).toContain('Originalangabe');
    expect(button('Einzelprüfung bestätigen')).toBeUndefined();
    expect(button('Im Verordnungsformular öffnen')).toBeUndefined();
  });

  it('does not display a delayed response once the current case grant is lost', async () => {
    let finish!: (value: typeof stored) => void;
    mocks.read.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await render(); await act(async () => button('Entwurf ansehen').click());
    allowed = false; await render();
    await act(async () => finish(stored));
    expect(host.textContent).toBe('');
  });

  it('offers exactly one eligible row and sends only an opaque one-time ticket', async () => {
    manage = true;
    mocks.read.mockResolvedValue({ ...stored, plan: { ...stored.plan, rows: [originalRow, { ...originalRow, weekdayCode: '2' },
      { ...originalRow, kind: 'note', additionalText: 'Nur Hinweis' }, { ...originalRow, name: 'Noch nicht geprüft' }] },
    confirmed: [{ rowIndex: 0 }, { rowIndex: 1 }, { rowIndex: 2 }] });
    await render(); await act(async () => button('Entwurf ansehen').click());
    expect([...host.querySelectorAll('button')].filter(b => b.textContent === 'Im Verordnungsformular öffnen')).toHaveLength(1);
    expect(host.textContent).toContain('wöchentliche Gabe');
    await act(async () => { button('Im Verordnungsformular öffnen').click(); button('Im Verordnungsformular öffnen').click(); });
    expect(mocks.push).toHaveBeenCalledTimes(1);
    const route = mocks.push.mock.calls[0][0];
    expect(route).toEqual({ pathname: '/pflege/medikation/new', params: { bmp: expect.any(String) } });
    expect(JSON.stringify(route)).not.toContain(item.clientId);
    expect(JSON.stringify(route)).not.toContain(item.id);
    expect(takeMedicationPlanOrderHandoff(route.params.bmp, scope)).toEqual({ tenantId: scope.tenantId, actorId: scope.actorId,
      clientId: item.clientId, importId: item.id, rowIndex: 0 });
    expect(takeMedicationPlanOrderHandoff(route.params.bmp, scope)).toBeNull();
  });

  it('checks the live write grant when clicking a previously rendered button', async () => {
    manage = true;
    await render(); await act(async () => button('Entwurf ansehen').click());
    const transferButton = button('Im Verordnungsformular öffnen');
    expect(transferButton).toBeDefined();
    manage = false;
    await act(async () => transferButton.click());
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
