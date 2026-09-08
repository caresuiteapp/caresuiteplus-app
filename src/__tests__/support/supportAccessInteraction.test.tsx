// @vitest-environment happy-dom
import React, { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ rpc: vi.fn(), confirm: vi.fn(), refresh: vi.fn(), dirty: vi.fn(), error: vi.fn() }));
vi.mock('react-native', async () => {
  const React = await import('react');
  const element = (tag: string) => (props: any) => React.createElement(tag, { onClick: props.onPress, disabled: props.disabled, 'aria-label': props.accessibilityLabel, role: props.accessibilityRole }, props.children);
  return { Platform: { OS: 'web' }, Linking: { openURL: vi.fn() }, StyleSheet: { create: (styles: any) => styles }, Text: element('span'), View: element('div'), Pressable: element('button'), TextInput: (props: any) => React.createElement('textarea', { 'aria-label': props.accessibilityLabel, readOnly: props.editable === false, value: props.value, onInput: (event: any) => props.onChangeText(event.currentTarget.value) }) };
});
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: api.confirm }));
vi.mock('@/lib/support/supportService', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/support/supportService')>(), supportRpc: api.rpc }));
import { SupportAccessPanel } from '@/components/support/SupportAccessPanel';
import { SupportRequestError, type SupportDetail, type SupportRecord } from '@/lib/support/supportService';

const baseDetail = (): SupportDetail => ({
  ticket: { id: 't1', number: 1, subject: 'Anfrage', tenant_id: 'tenant1', tenant_name: 'Musterbetrieb', status: 'open', category: 'technical', priority: 'normal', assigned_name: null, updated_at: '2026-09-08T10:00:00Z' },
  messages: [], audit: [], can_approve: false, can_write: true, can_support_write: true,
  requests: [{ id: 'r1', ticket_id: 't1', requester_name: 'CareSuite Support', reason: 'Einsatznotiz gemeinsam prüfen', scopes: ['assignments.read', 'assignments.notes.write'], status: 'approved', duration_minutes: 30, created_at: '2026-09-08T10:00:00Z', expires_at: '2026-09-08T10:30:00Z', is_requester: true }],
});
const rows: SupportRecord[] = [
  { id: 'a1', title: 'Erster Einsatz', internal_notes: 'Erste Notiz', updated_at: '2026-09-08T10:00:00Z' },
  { id: 'a2', title: 'Zweiter Einsatz', internal_notes: 'Zweite Notiz', updated_at: '2026-09-08T10:00:00Z' },
];
let host: HTMLDivElement; let root: Root;
function Harness({ detail, platformMode }: { detail: SupportDetail; platformMode: boolean }) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await action(); } catch (error) { api.error(error); }
    finally { lock.current = false; setBusy(false); }
  };
  return <SupportAccessPanel {...{ detail, platformMode, busy, run }} refresh={api.refresh} onDirtyChange={api.dirty} />;
}
const buttons = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].filter(node => node.getAttribute('aria-label') === label);
const input = () => host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Interne Notizen"]');
async function render(detail = baseDetail(), platformMode = true) { await act(async () => root.render(<Harness {...{ detail, platformMode }} />)); }
async function click(label: string, index = 0) { await act(async () => buttons(label)[index].click()); }
async function edit() {
  await click('Einsätze, Zeiten und Dokumentationsstatus einsehen');
  await click('Interne Notiz bearbeiten');
  await act(async () => { input()!.value = 'Ungespeicherte Korrektur'; input()!.dispatchEvent(new Event('input', { bubbles: true })); });
}
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-08T10:01:00Z'));
  Object.values(api).forEach(mock => mock.mockReset());
  api.confirm.mockResolvedValue(true); api.refresh.mockResolvedValue(undefined); api.rpc.mockResolvedValue({ rows });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe('support access consent', () => {
  it('requires explicit company confirmation including requester, reason, scope and duration', async () => {
    const detail = baseDetail(); detail.can_approve = true; detail.can_support_write = false;
    detail.requests[0] = { ...detail.requests[0], status: 'requested', expires_at: null };
    await render(detail, false);
    api.confirm.mockResolvedValueOnce(false);
    await click('Zugriff freigeben');
    expect(api.rpc).not.toHaveBeenCalled();
    const prompt = api.confirm.mock.calls[0][0].message;
    for (const value of ['CareSuite Support', '30 Minuten', detail.requests[0].reason, 'Interne Einsatznotizen bearbeiten']) expect(prompt).toContain(value);
    await click('Zugriff freigeben');
    expect(api.rpc).toHaveBeenCalledWith('support_decide_access', { p_request_id: 'r1', p_decision: 'approve' });
    detail.requests[0].status = 'approved'; detail.requests[0].expires_at = '2026-09-08T10:30:00Z';
    await render(detail, false); await click('Freigabe sofort widerrufen');
    expect(api.rpc).toHaveBeenLastCalledWith('support_decide_access', { p_request_id: 'r1', p_decision: 'revoke' });
  });
  it('does not offer approval or data access to the wrong role/requester', async () => {
    const detail = baseDetail(); detail.requests[0].is_requester = false;
    await render(detail);
    expect(buttons('Zugriff freigeben')).toHaveLength(0);
    expect(buttons('Einsätze, Zeiten und Dokumentationsstatus einsehen')).toHaveLength(0);
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it.each(['revoked', 'expired'] as const)('removes displayed records after access is %s', async mode => {
    const detail = baseDetail(); await render(detail); await edit();
    if (mode === 'revoked') { detail.requests = [{ ...detail.requests[0], status: 'revoked' }]; await render(detail); }
    else { await act(async () => { vi.setSystemTime(new Date('2026-09-08T10:30:01Z')); await vi.advanceTimersByTimeAsync(1000); }); }
    expect(host.textContent).not.toContain('Freigegebener Arbeitsbereich');
    expect(host.textContent).not.toContain('Erster Einsatz');
    expect(input()).toBeNull();
  });
});

describe('support editing', () => {
  it('preserves dirty fields when closing is declined and discards them only after confirmation', async () => {
    await render(); await edit();
    api.confirm.mockResolvedValueOnce(false); await click('Arbeitsbereich schließen');
    expect(input()?.value).toBe('Ungespeicherte Korrektur');
    expect(api.dirty).toHaveBeenLastCalledWith(true);
    api.confirm.mockResolvedValueOnce(false); await click('Bearbeitung abbrechen');
    expect(input()?.value).toBe('Ungespeicherte Korrektur');
    await click('Arbeitsbereich schließen');
    expect(input()).toBeNull(); expect(api.dirty).toHaveBeenLastCalledWith(false);
  });
  it('keeps edits on reselecting the same record and on declining a different record', async () => {
    await render(); await edit();
    await click('Interne Notiz bearbeiten');
    expect(input()?.value).toBe('Ungespeicherte Korrektur');
    api.confirm.mockResolvedValueOnce(false); await click('Interne Notiz bearbeiten', 1);
    expect(input()?.value).toBe('Ungespeicherte Korrektur');
    await click('Interne Notiz bearbeiten', 1);
    expect(input()?.value).toBe('Zweite Notiz');
  });
  it('retains the correction after a conflict and removes records after permission is denied', async () => {
    await render(); await edit();
    api.rpc.mockRejectedValueOnce(new SupportRequestError('Zwischenzeitlich geändert', '40001'));
    await click('Änderung speichern');
    expect(input()?.value).toBe('Ungespeicherte Korrektur');
    expect(api.rpc).toHaveBeenLastCalledWith('support_workspace_update', expect.objectContaining({ p_request_id: 'r1', p_record_id: 'a1', p_scope: 'assignments.notes.write', p_expected_updated_at: rows[0].updated_at, p_patch: { internal_notes: 'Ungespeicherte Korrektur' } }));
    api.rpc.mockRejectedValueOnce(new SupportRequestError('Zugriff beendet', '42501'));
    await click('Änderung speichern');
    expect(host.textContent).not.toContain('Freigegebener Arbeitsbereich');
    expect(input()).toBeNull();
  });
  it('does not allow closing while a confirmed save is still running', async () => {
    await render(); await edit();
    let finish!: (value: unknown) => void;
    api.rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await click('Änderung speichern');
    expect(buttons('Arbeitsbereich schließen')[0].disabled).toBe(true);
    await act(async () => { finish({}); });
    expect(buttons('Arbeitsbereich schließen')[0].disabled).toBe(false);
  });
});
