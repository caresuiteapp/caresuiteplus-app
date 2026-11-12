// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientMedicationPlanArchive } from '@/components/pflege/ClientMedicationPlanArchive.web';

const mocks = vi.hoisted(() => ({ list: vi.fn(), read: vi.fn() }));
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
let allowed: boolean;
const scope = { tenantId: 'test-tenant', actorId: 'test-actor', isCurrent: () => allowed };
const item = { id: 'test-draft', clientId: 'test-client', fileName: 'Testplan.xml', createdAt: '2026-11-12T08:00:00Z', positionCount: 1, confirmedCount: 1 };
const originalRow = { kind: 'medication', name: 'Testposition', pzn: null, ingredients: [], form: null, formCode: null,
  morning: 'Originalangabe', noon: null, evening: null, night: null, doseText: null, weekdayCode: null,
  unit: null, unitCode: null, instructions: null, indication: null, additionalText: null, source: { attributes: {} } };
const stored = { ...item, plan: { issuer: { name: 'Testaussteller' }, rows: [originalRow] }, confirmed: [{ rowIndex: 0 }] };
const render = () => act(async () => { root.render(<ClientMedicationPlanArchive scope={scope} clientId={item.clientId} />); });
const button = (title: string) => [...host.querySelectorAll('button')].find(b => b.textContent === title)!;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  allowed = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  mocks.list.mockReset().mockResolvedValue([item]); mocks.read.mockReset().mockResolvedValue(stored);
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
  });

  it('does not display a delayed response once the current case grant is lost', async () => {
    let finish!: (value: typeof stored) => void;
    mocks.read.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await render(); await act(async () => button('Entwurf ansehen').click());
    allowed = false; await render();
    await act(async () => finish(stored));
    expect(host.textContent).toBe('');
  });
});
