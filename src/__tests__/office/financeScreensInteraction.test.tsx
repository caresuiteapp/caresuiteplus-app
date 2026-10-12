// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ tenant: 'tenant-a', user: 'user-a', load: vi.fn(), push: vi.fn() }));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' }, AppState: { addEventListener: () => ({ remove() {} }) },
  ScrollView: ({ children }: any) => <div>{children}</div>, View: ({ children }: any) => <div>{children}</div>, Text: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: f.push }) }));
vi.mock('@/components/layout', () => ({ ScreenShell: ({ title, children }: any) => <main><h1>{title}</h1>{children}</main> }));
vi.mock('@/components/ui', () => ({
  LoadingState: ({ message }: any) => <p>{message}</p>, EmptyState: ({ title }: any) => <p>{title}</p>,
  ErrorState: ({ message, onRetry }: any) => <div role="alert">{message}<button onClick={onRetry}>Erneut versuchen</button></div>,
}));
vi.mock('@/components/ui/NativeWorkspaceUi', () => ({ nativeWorkspaceStyles: {},
  NativeAction: ({ label, disabled, onPress }: any) => <button disabled={disabled} onClick={onPress}>{label}</button>,
  NativeField: ({ label, value, onChangeText }: any) => <input aria-label={label} value={value} onInput={event => onChangeText(event.currentTarget.value)} />,
}));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: f.user, roleKey: 'business_admin' }, user: { id: f.user } }) }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ useLiveRefresh: () => ({ isLiveConnected: false }), DEFAULT_LIVE_POLL_MS: 30000 }));
vi.mock('@/lib/office/invoiceExtensionService', () => ({ fetchInvoiceRuns: f.load, fetchInvoicePayments: f.load, fetchInvoiceDunningCases: f.load, formatCurrency: (value: number) => `${value / 100} EUR` }));
import { InvoicePaymentsScreen } from '@/screens/business/office/OfficeInvoiceExtensionScreens';
let root: Root, host: HTMLDivElement;
const payment = (label: string) => ({ id: 'payment', invoiceId: 'invoice', invoiceNumber: label, clientName: 'Anna', paidAt: '2026-10-01', method: 'Überweisung', amountCents: 12345, status: 'completed' });
beforeEach(() => {
  vi.clearAllMocks(); f.tenant = 'tenant-a'; f.user = 'user-a';
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = () => act(async () => root.render(<InvoicePaymentsScreen />));
describe('finance page interactions', () => {
  it('shows a failed live read, retries, and opens the actual invoice', async () => {
    f.load.mockResolvedValueOnce({ ok: false, error: 'Keine Zahlungsberechtigung' }); await render();
    expect(host.textContent).toContain('Keine Zahlungsberechtigung'); expect(host.textContent).not.toContain('Keine Vorgänge');
    f.load.mockResolvedValueOnce({ ok: true, data: [payment('RE-Original')] });
    await act(async () => host.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
    expect(host.textContent).toContain('RE-Original'); expect(host.textContent).not.toContain('Keine Zahlungsberechtigung');
    const open = [...host.querySelectorAll('button')].find(button => button.textContent === 'Rechnung ansehen')!;
    await act(async () => open.click()); expect(f.push).toHaveBeenCalledWith('/office/invoices/invoice');
  });
  it('clears old tenant data and rejects an old refresh completion after a tenant switch', async () => {
    f.load.mockResolvedValueOnce({ ok: true, data: [payment('RE-Mandant-A')] }); await render();
    let resolve!: (value: unknown) => void;
    f.load.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Aktualisieren')!.click());
    f.tenant = 'tenant-b'; f.user = 'user-b'; f.load.mockResolvedValueOnce({ ok: true, data: [payment('RE-Mandant-B')] });
    await render(); expect(host.textContent).not.toContain('RE-Mandant-A'); expect(host.textContent).toContain('RE-Mandant-B');
    await act(async () => resolve({ ok: true, data: [payment('RE-Alter-Abruf')] }));
    expect(host.textContent).toContain('RE-Mandant-B'); expect(host.textContent).not.toContain('RE-Alter-Abruf');
  });
});
