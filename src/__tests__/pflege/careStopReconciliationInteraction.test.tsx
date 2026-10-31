// @vitest-environment happy-dom
import React, { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CareWriteReconciliationNotice as WebNotice } from '@/components/pflege/CareWriteReconciliationNotice.web';
import { CareWriteReconciliationNotice as NativeNotice } from '@/components/pflege/CareWriteReconciliationNotice.native';
import { freezeCareStopWriteRequest, type CareStopWriteReconciliation } from '@/lib/pflege/careStopWriteReconciliationDomain';

const h = vi.hoisted(() => ({ reconcile: vi.fn(), press: null as null | (() => void) }));
vi.mock('@/lib/pflege/careStopWriteReconciliationService', () => ({ reconcileCareStopWrite: h.reconcile }));
vi.mock('react-native', () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children, accessibilityRole }: { children?: ReactNode; accessibilityRole?: string }) => <span role={accessibilityRole}>{children}</span>,
}));
vi.mock('@/components/ui/CareSuiteNativeText', () => ({ CareSuiteNativeText: ({ children, accessibilityRole }: { children?: ReactNode; accessibilityRole?: string }) => <span role={accessibilityRole}>{children}</span> }));
vi.mock('@/components/ui', () => ({ PremiumButton: ({ title, disabled, onPress }: { title: string; disabled?: boolean; onPress: () => void }) => {
  h.press = onPress; return <button disabled={disabled} onClick={onPress}>{title}</button>;
} }));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useCareLightPalette: () => ({ c: { text: '#111', muted: '#444', danger: '#900', green: '#060', warning: '#640' } }) }));
vi.mock('@/lib/formatters/dateTimeFormatters', () => ({ formatTime: (value: string) => value }));
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const request = (n = 1) => freezeCareStopWriteRequest('stop_completion', id(n), { stopId: id(9), documentation: 'Original', nested: { value: 'original' } });
const receipt = (n = 1): CareStopWriteReconciliation => ({ state: 'confirmed', operation: 'stop_completion', requestId: id(n), stopId: id(9), recordId: id(8), recordedAt: '2026-10-31T04:00:00.123456Z', serverCheckedAt: '2026-10-31T04:00:01.123456Z', requestFingerprint: 'a'.repeat(32), message: 'Eigenes Original bestätigt' });

describe.each([['Web', WebNotice], ['Native', NativeNotice]] as const)('%s original request reconciliation', (_platform, Notice) => {
  let host: HTMLDivElement, root: Root, props: ComponentProps<typeof WebNotice>, resolve: (value: unknown) => void;
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.resetAllMocks(); h.press = null;
    h.reconcile.mockImplementation(() => new Promise(done => { resolve = done; }));
    props = { tenantId: id(2), role: 'business_admin', request: request(), onConfirmed: vi.fn() };
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(<Notice {...props} />));
  });
  afterEach(async () => { if (root) await act(async () => root.unmount()); host.remove(); });
  const click = () => act(async () => { host.querySelector('button')!.click(); });
  it('checks only the exact frozen original and ignores duplicate held actions while busy or confirmed', async () => {
    const held = h.press!;
    await act(async () => { held(); held(); }); expect(h.reconcile).toHaveBeenCalledOnce();
    expect(h.reconcile).toHaveBeenCalledWith(id(2), 'business_admin', props.request);
    expect(h.reconcile.mock.calls[0][2]).not.toBe(props.request);
    expect(Object.isFrozen(h.reconcile.mock.calls[0][2].payload.nested)).toBe(true);
    await act(async () => resolve({ ok: true, data: receipt() }));
    expect(props.onConfirmed).toHaveBeenCalledOnce(); expect(host.querySelector('button')!.disabled).toBe(true);
    await act(async () => held()); expect(h.reconcile).toHaveBeenCalledOnce();
  });
  it('retains an unresolved original without confirming or sending another clinical operation', async () => {
    await click(); await act(async () => resolve({ ok: true, data: { state: 'not_found', operation: 'stop_completion', requestId: id(1), serverCheckedAt: receipt().serverCheckedAt, message: 'Noch ungeklärt' } }));
    expect(props.onConfirmed).not.toHaveBeenCalled(); expect(host.textContent).toContain('Keinen neuen Vorgang anlegen');
    expect(host.querySelector('button')!.disabled).toBe(false); expect(h.reconcile).toHaveBeenCalledOnce();
  });
  it('blocks a conflict even through a retained old button callback', async () => {
    const held = h.press!; await click();
    await act(async () => resolve({ ok: true, data: { state: 'conflict', operation: 'stop_completion', requestId: id(1), serverCheckedAt: receipt().serverCheckedAt, message: 'Konflikt' } }));
    await act(async () => held()); expect(h.reconcile).toHaveBeenCalledOnce(); expect(props.onConfirmed).not.toHaveBeenCalled();
    expect(host.querySelector('button')!.disabled).toBe(true);
  });
  for (const change of ['request', 'tenant', 'role', 'disabled', 'callback'] as const) it(`does not adopt a late original after changed ${change}`, async () => {
    const previous = props.onConfirmed; await click();
    if (change === 'request') props = { ...props, request: request(3) };
    if (change === 'tenant') props = { ...props, tenantId: id(3) };
    if (change === 'role') props = { ...props, role: 'nurse' };
    if (change === 'disabled') props = { ...props, disabled: true };
    if (change === 'callback') props = { ...props, onConfirmed: vi.fn() };
    await act(async () => root.render(<Notice {...props} />));
    await act(async () => resolve({ ok: true, data: receipt() }));
    expect(previous).not.toHaveBeenCalled(); expect(props.onConfirmed).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Eigenes Original bestätigt');
  });
  it('does not adopt a response after unmount', async () => {
    await click(); await act(async () => root.unmount());
    await act(async () => resolve({ ok: true, data: receipt() })); expect(props.onConfirmed).not.toHaveBeenCalled();
  });
  it('rejects mutated nested original data even when the outer request identity is retained', async () => {
    await click(); (props.request.payload.nested as { value: string }).value = 'changed';
    await act(async () => resolve({ ok: true, data: receipt() })); expect(props.onConfirmed).not.toHaveBeenCalled();
    expect(h.reconcile.mock.calls[0][2].payload.nested.value).toBe('original');
  });
  it('rejects a substituted receipt and preserves the original request after a service failure', async () => {
    await click(); await act(async () => resolve({ ok: true, data: receipt(3) }));
    expect(props.onConfirmed).not.toHaveBeenCalled(); expect(host.textContent).toContain('Die ursprüngliche Anfrage bleibt erhalten');
    expect(host.querySelector('button')!.disabled).toBe(false);
  });
  it('retains a confirmed original when the subsequent screen refresh fails', async () => {
    props = { ...props, onConfirmed: vi.fn(async () => { throw new Error('screen refresh failed'); }) };
    await act(async () => root.render(<Notice {...props} />)); await click();
    await act(async () => resolve({ ok: true, data: receipt() }));
    expect(props.onConfirmed).toHaveBeenCalledOnce(); expect(host.textContent).toContain('Das Original ist bestätigt');
    expect(host.textContent).toContain('Ansicht konnte nicht aktualisiert'); expect(host.querySelector('button')!.disabled).toBe(true);
    expect(h.reconcile).toHaveBeenCalledOnce();
  });
});
