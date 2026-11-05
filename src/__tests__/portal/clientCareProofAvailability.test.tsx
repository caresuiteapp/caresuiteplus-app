// @vitest-environment happy-dom
import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalActor } from '@/hooks/usePortalActor';

const f = vi.hoisted(() => ({ actor: {} as PortalActor, rpc: vi.fn() }));
vi.mock('react-native', () => {
  const Host = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { View: Host, Text: Host, Image: () => <img alt="Unterschrift" />, Platform: { OS: 'web' }, AppState: { addEventListener: () => ({ remove() {} }) } };
});
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => f.actor }));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useCareLightPalette: () => ({ c: { text: '#123251', muted: '#52677D' } }) }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: f.rpc }) }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: (error: { message?: string }) => error.message ?? 'Datenbankfehler' }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/hooks/core', async () => await import('@/hooks/core/useAsyncQuery'));
vi.mock('@/lib/services/queryTimeout', () => ({ withServiceQueryTimeout: (promise: unknown) => promise }));
vi.mock('@/components/inputs/CareSignatureModal', () => ({ CareSignatureModal: ({ visible, onConfirm }: any) => visible ? <button onClick={() => onConfirm('data:image/png;base64,test')}>Unterschrift bestätigen</button> : null }));
vi.mock('@/components/pflege/CareStopOpeningPanel', () => ({ CareStopOpeningPanel: () => null }));
vi.mock('@/components/pflege/CareStopTimePanel', () => ({ CareStopTimePanel: () => null }));
vi.mock('@/components/pflege/CareStopTasksPanel', () => ({ CareStopTasksPanel: () => null }));
vi.mock('@/components/pflege/CareStopUnreachablePanel', () => ({ CareStopUnreachablePanel: () => null }));
vi.mock('@/components/ui', () => ({
  SectionPanel: ({ title, children }: any) => <section><h2>{title}</h2>{children}</section>,
  LoadingState: ({ message }: any) => <div role="status">{message}</div>,
  ErrorState: ({ message, presentation = 'overlay', onRetry }: any) => <div role={presentation === 'inline' ? 'alert' : 'dialog'}>{message}{onRetry ? <button onClick={onRetry}>Erneut versuchen</button> : null}</div>,
  PremiumButton: ({ title, onPress, disabled }: any) => <button onClick={onPress} disabled={disabled}>{title}</button>,
  PremiumInput: ({ label, value, onChangeText }: any) => <input aria-label={label} value={value} onChange={event => onChangeText(event.target.value)} />,
}));

import { ClientCareProofPanel, EmployeeCareToursPanel } from '@/components/pflege/PortalCarePanels';
import { fetchMyCareProofs, signMyCareProof } from '@/lib/pflege/carePortalService';

const proof = { id: 'proof-a', date: '2026-11-04', startedAt: '2026-11-04T10:00:00+01:00', endedAt: '2026-11-04T10:30:00+01:00', service: 'Bereitgestellte Grundpflege', employee: 'Pflegekraft', note: 'Leistung erbracht', amountCents: 3275, status: 'submitted', signer: '', signedAt: null, signature: null, rejectionReason: '' };
let host: HTMLDivElement, root: Root;
const render = async () => { await act(async () => root.render(<><p>Meine Leistungsnachweise</p><ClientCareProofPanel /></>)); };
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(item => item.textContent === label);
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  f.rpc.mockReset().mockResolvedValue({ data: [proof], error: null });
  f.actor = { tenantId: 'tenant-a', clientId: 'client-a', actorId: 'account-a', roleKey: 'client_portal', displayName: 'Testperson', isLinkedReady: true } as PortalActor;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('optional client care proof capability with real query and RPC service', () => {
  it.each(['PGRST202', 'PGRST205', '42883', '42P01', '42501'])('keeps unavailable server capability %s out of the client page', async code => {
    f.rpc.mockResolvedValue({ data: null, error: { code, message: 'Die Pflegeanbindung ist noch nicht freigeschaltet.' } });
    await render();
    expect(host.textContent).toBe('Meine Leistungsnachweise');
    expect(host.querySelector('[role=dialog]')).toBeNull();
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith('get_my_ambulatory_care_proofs', { p_offset: 0 });
  });

  it('does not flash an optional panel or refresh action before server availability is known', async () => {
    const pending = deferred<unknown>(); f.rpc.mockReturnValue(pending.promise);
    await render();
    expect(host.textContent).toBe('Meine Leistungsnachweise');
    await act(async () => pending.resolve({ data: [proof], error: null }));
    expect(host.textContent).toContain('Ambulante Pflegenachweise');
    expect(host.textContent).toContain(proof.service);
  });

  it.each(['PGRST202', '42501'])('removes stale proofs and actions when refresh returns %s', async code => {
    await render();
    expect(host.textContent).toContain(proof.service);
    f.rpc.mockResolvedValue({ data: null, error: { code } });
    await click('Pflegenachweise aktualisieren');
    expect(host.textContent).toBe('Meine Leistungsnachweise');
    expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('[role=dialog]')).toBeNull();
  });

  it('keeps a genuine read failure visible as a safe inline error and supports retry', async () => {
    f.rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'Datenbankfehler: internal schema detail' } });
    await render();
    expect(host.querySelector('[role=dialog]')).toBeNull();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Ihre Pflegenachweise konnten gerade nicht geladen werden.');
    expect(host.textContent).not.toContain('schema');
    expect(host.textContent).not.toContain('Noch keine bereitgestellten');
    await click('Erneut versuchen');
    expect(host.querySelector('[role=alert]')).toBeNull();
    expect(host.textContent).toContain(proof.service);
  });

  it('retains previously loaded proofs after a genuine refresh failure', async () => {
    await render();
    f.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'Datenbankfehler' } });
    await click('Pflegenachweise aktualisieren');
    expect(host.textContent).toContain(proof.service);
    expect(host.querySelector('[role=alert]')).not.toBeNull();
    expect(host.querySelector('[role=dialog]')).toBeNull();
  });

  it('reports an unavailable signature action without exposing capability codes or false success', async () => {
    await render();
    await click('Leistung prüfen und unterschreiben');
    await click('Unterschrift erfassen');
    f.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await click('Unterschrift bestätigen');
    expect(host.querySelector('[role=dialog]')).toBeNull();
    expect(host.textContent).toContain('Ihre Unterschrift konnte gerade nicht gespeichert werden.');
    expect(host.textContent).not.toMatch(/PORTAL_|freigeschaltet/);
    expect(host.textContent).toContain('Unterschrift bestätigen');
  });

  it('keeps PDF failures in the page without displaying internal activation details', async () => {
    await render();
    f.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await click('Pflegenachweis als PDF herunterladen');
    expect(host.querySelector('[role=dialog]')).toBeNull();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Das PDF konnte gerade nicht erstellt werden.');
    expect(host.textContent).toContain(proof.service);
    expect(host.textContent).not.toMatch(/PORTAL_|freigeschaltet/);
  });

  it('does not display an internal module notice for a failed signature read', async () => {
    f.rpc.mockResolvedValueOnce({ data: [{ ...proof, status: 'signed' }], error: null });
    await render();
    f.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await click('Gespeicherte Unterschrift anzeigen');
    expect(host.querySelector('[role=dialog]')).toBeNull();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Die gespeicherte Unterschrift konnte nicht geladen werden.');
    expect(host.textContent).not.toMatch(/PORTAL_|freigeschaltet/);
  });

  it.each(['family_portal', 'employee_portal'])('does not request client care data for %s', async roleKey => {
    f.actor = { ...f.actor, roleKey: roleKey as PortalActor['roleKey'] };
    await render();
    expect(f.rpc).not.toHaveBeenCalled();
    expect(host.textContent).toBe('Meine Leistungsnachweise');
  });

  it('does not request care data until the client identity is linked', async () => {
    f.actor.isLinkedReady = false;
    await render();
    expect(f.rpc).not.toHaveBeenCalled();
    expect(host.textContent).toBe('Meine Leistungsnachweise');
  });

  it('preserves pagination and does not turn a missing later page into a successful empty list', async () => {
    f.rpc.mockResolvedValueOnce({ data: Array.from({ length: 25 }, (_, i) => ({ ...proof, id: `proof-${i}` })), error: null });
    f.rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } });
    expect(await fetchMyCareProofs()).toEqual({ ok: false, error: 'PORTAL_CARE_UNAVAILABLE' });
    expect(f.rpc.mock.calls.map(call => call[1])).toEqual([{ p_offset: 0 }, { p_offset: 25 }]);
  });

  it('does not treat an unavailable write as a successful signature', async () => {
    f.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    expect(await signMyCareProof('proof-a', 'Testperson', 'png')).toEqual({ ok: false, error: 'PORTAL_CARE_UNAVAILABLE' });
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith('sign_my_ambulatory_care_proof', { p_id: 'proof-a', p_name: 'Testperson', p_png: 'png' });
  });

  it('also consumes unavailable capability codes safely in the employee panel sharing the service', async () => {
    f.actor = { ...f.actor, roleKey: 'employee_portal', employeeId: 'employee-a' };
    f.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await act(async () => root.render(<EmployeeCareToursPanel />));
    expect(host.textContent).toBe('');
    expect(host.querySelector('[role=dialog]')).toBeNull();
    expect(f.rpc.mock.calls[0][0]).toBe('get_my_ambulatory_care_tours');
  });
});
