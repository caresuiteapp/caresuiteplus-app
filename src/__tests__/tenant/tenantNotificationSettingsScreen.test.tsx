// @vitest-environment happy-dom
import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantNotificationSettingsScreen } from '@/screens/settings/TenantNotificationSettingsScreen';
import type { TenantNotificationSettings } from '@/lib/tenant/tenantNotificationSettingsService';
import type { ServiceResult } from '@/types';

const h = vi.hoisted(() => ({
  tenantId: 'tenant-one', allowed: true, save: vi.fn(), refresh: vi.fn().mockResolvedValue(undefined),
  settings: {
    tenantId: 'tenant-one', exists: true, push_notifications_enabled: false,
    notify_assignment_changes: true, notify_new_message: true, notify_signature_required: false, notify_service_record_ready: true,
  } as TenantNotificationSettings,
}));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenantId }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({
  can: () => h.allowed, check: () => ({ reason: 'Keine Berechtigung.' }), roleKey: 'business_admin', roleLabel: 'Administration',
}) }));
vi.mock('@/hooks/core/useAsyncQuery', () => ({ useAsyncQuery: () => ({
  data: h.settings, error: null, refreshError: null, loading: false, refreshing: false, refresh: h.refresh,
}) }));
vi.mock('@/lib/tenant/tenantNotificationSettingsService', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/tenant/tenantNotificationSettingsService')>(),
  saveTenantNotificationSettings: (...args: unknown[]) => h.save(...args),
}));
vi.mock('@/design/tokens/auroraGlass', () => ({ useAuroraAdaptiveText: () => ({ primary: '#111', secondary: '#333' }) }));
vi.mock('@/components/settings/settingsscreenframe', () => ({ SettingsScreenFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/permissions', () => ({ LockedActionBanner: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('@/components/ui', () => ({
  ErrorState: ({ message }: { message: string }) => <p role="alert">{message}</p>,
  SuccessState: ({ message }: { message: string }) => <p role="status">{message}</p>,
  LoadingState: ({ message }: { message: string }) => <p>{message}</p>,
  SectionPanel: ({ title, children }: { title: string; children: ReactNode }) => <section><h2>{title}</h2>{children}</section>,
  PremiumButton: ({ title, onPress, loading, disabled }: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean }) => <button disabled={loading || disabled} onClick={onPress}>{title}</button>,
}));
vi.mock('react-native', () => ({
  StyleSheet: { create: (value: unknown) => value },
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Switch: ({ accessibilityLabel, value, onValueChange, disabled }: {
    accessibilityLabel: string; value: boolean; onValueChange: (next: boolean) => void; disabled: boolean;
  }) => <input aria-label={accessibilityLabel} type="checkbox" checked={value} disabled={disabled} onChange={event => onValueChange(event.target.checked)} />,
}));
let host: HTMLDivElement;
let root: Root;
const render = async () => { await act(async () => root.render(<TenantNotificationSettingsScreen />)); };
const input = (label: string) => host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
const button = (title: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(value => value.textContent === title)!;
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); h.tenantId = 'tenant-one'; h.allowed = true;
  h.settings = { tenantId: 'tenant-one', exists: true, push_notifications_enabled: false, notify_assignment_changes: true,
    notify_new_message: true, notify_signature_required: false, notify_service_record_ready: true };
  h.save.mockResolvedValue({ ok: true, data: { ...h.settings, push_notifications_enabled: true } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('tenant push preferences control', () => {
  it('shows stored disabled state without automatically enabling or saving', async () => {
    await render();
    expect(input('Push-Benachrichtigungen aktivieren').checked).toBe(false);
    expect(input('Neue Nachrichten').checked).toBe(true);
    expect(host.textContent).toContain('Push ist für diesen Mandanten ausgeschaltet.');
    expect(button('Push-Einstellungen speichern').disabled).toBe(true);
    expect(h.save).not.toHaveBeenCalled();
  });

  it('saves the explicit master switch while preserving the existing event selection', async () => {
    await render();
    await click(input('Push-Benachrichtigungen aktivieren'));
    expect(host.textContent).toContain('Änderungen sind noch nicht gespeichert.');
    expect(host.textContent).toContain('Push ist für diesen Mandanten ausgeschaltet.');
    await click(button('Push-Einstellungen speichern'));
    expect(h.save).toHaveBeenCalledWith('tenant-one', { push_notifications_enabled: true }, 'business_admin');
    expect(host.textContent).toContain('Push-Einstellungen gespeichert.');
    expect(host.textContent).toContain('Push ist für diesen Mandanten freigegeben.');
    expect(input('Neue Nachrichten').checked).toBe(true);
  });

  it('allows event options to be configured while the master switch is off', async () => {
    await render();
    await click(input('Unterschriften und Dokumente'));
    h.save.mockResolvedValue({ ok: true, data: { ...h.settings, notify_signature_required: true } });
    await click(button('Push-Einstellungen speichern'));
    expect(h.save).toHaveBeenCalledWith('tenant-one', { notify_signature_required: true }, 'business_admin');
    expect(input('Push-Benachrichtigungen aktivieren').checked).toBe(false);
  });

  it('retains unsaved choices and the stored disabled status after server rejection', async () => {
    h.save.mockResolvedValue({ ok: false, error: 'Server verweigert diese Änderung.' });
    await render(); await click(input('Push-Benachrichtigungen aktivieren')); await click(button('Push-Einstellungen speichern'));
    expect(host.textContent).toContain('Server verweigert diese Änderung.');
    expect(host.textContent).not.toContain('Push-Einstellungen gespeichert.');
    expect(input('Push-Benachrichtigungen aktivieren').checked).toBe(true);
    expect(host.textContent).toContain('Push ist für diesen Mandanten ausgeschaltet.');
  });

  it('blocks duplicate submission and reload while a save is pending', async () => {
    let resolve: (value: ServiceResult<TenantNotificationSettings>) => void = () => {};
    h.save.mockImplementation(() => new Promise<ServiceResult<TenantNotificationSettings>>(done => { resolve = done; }));
    await render(); await click(input('Push-Benachrichtigungen aktivieren'));
    await act(async () => { button('Push-Einstellungen speichern').click(); button('Push-Einstellungen speichern').click(); });
    expect(h.save).toHaveBeenCalledOnce();
    expect(input('Neue Nachrichten').disabled).toBe(true);
    expect(button('Gespeicherten Stand neu laden').disabled).toBe(true);
    await act(async () => resolve({ ok: true, data: { ...h.settings, push_notifications_enabled: true } }));
  });

  it('does not expose controls to a role without tenant management permission', async () => {
    h.allowed = false; await render();
    expect(host.textContent).toContain('Keine Berechtigung.');
    expect(host.querySelector('input')).toBeNull();
    expect(h.save).not.toHaveBeenCalled();
  });

  it('does not apply a previous tenant save response after switching tenant scope', async () => {
    let resolve: (value: ServiceResult<TenantNotificationSettings>) => void = () => {};
    h.save.mockImplementation(() => new Promise<ServiceResult<TenantNotificationSettings>>(done => { resolve = done; }));
    await render(); await click(input('Push-Benachrichtigungen aktivieren')); await click(button('Push-Einstellungen speichern'));
    const previous = { ...h.settings, push_notifications_enabled: true };
    h.tenantId = 'tenant-two'; h.settings = { ...h.settings, tenantId: 'tenant-two' };
    await render();
    await act(async () => resolve({ ok: true, data: previous }));
    expect(input('Push-Benachrichtigungen aktivieren').checked).toBe(false);
    expect(host.textContent).not.toContain('Push-Einstellungen gespeichert.');
    expect(h.save).toHaveBeenCalledWith('tenant-one', { push_notifications_enabled: true }, 'business_admin');
  });

  it('creates missing settings with exactly the displayed choices on the first explicit save', async () => {
    h.settings = { ...h.settings, exists: false, notify_assignment_changes: false, notify_new_message: false, notify_service_record_ready: false };
    await render(); await click(input('Push-Benachrichtigungen aktivieren')); await click(input('Neue Nachrichten'));
    await click(button('Push-Einstellungen speichern'));
    expect(h.save).toHaveBeenCalledWith('tenant-one', {
      push_notifications_enabled: true, notify_assignment_changes: false, notify_new_message: true,
      notify_signature_required: false, notify_service_record_ready: false,
    }, 'business_admin');
  });
});
