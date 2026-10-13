// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ query: vi.fn(), pick: vi.fn(), upload: vi.fn(), receipt: vi.fn(), profile: vi.fn(), refresh: vi.fn(), refreshWithResult: vi.fn() }));
vi.mock('react-native', () => ({
  View: ({ children }: any) => <div>{children}</div>, ScrollView: ({ children }: any) => <div>{children}</div>, Text: ({ children }: any) => <span>{children}</span>,
  Pressable: ({ children, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{children}</button>,
  Linking: { openURL: vi.fn() }, Platform: { OS: 'android' }, StyleSheet: { create: (v: any) => v },
}));
vi.mock('@/components/ui', () => ({
  SectionPanel: ({ title, children }: any) => <section><h2>{title}</h2>{children}</section>, PremiumCard: ({ children }: any) => <div>{children}</div>,
  EmptyState: ({ title, message }: any) => <div>{title}{message}</div>, ErrorState: ({ message }: any) => <div>{message}</div>, LoadingState: ({ message }: any) => <div>{message}</div>,
  InfoBanner: ({ message }: any) => <div>{message}</div>, PremiumBadge: ({ label }: any) => <span>{label}</span>,
  PremiumButton: ({ title, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{title}</button>,
  PremiumInput: ({ label, value, onChangeText, editable }: any) => <input disabled={editable === false} aria-label={label} value={value} onInput={(e: any) => onChangeText(e.target.value)} />,
}));
vi.mock('@/components/images/CareSuiteImage', () => ({ CareSuiteImage: () => null }));
vi.mock('@/components/inputs/CareSignatureModal', () => ({ CareSignatureModal: () => null }));
vi.mock('@/components/inputs/CareEntitySelect', () => ({ CareEntitySelect: () => null }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: h.pick }));
vi.mock('@/hooks/core/useAsyncQuery', () => ({ useAsyncQuery: h.query }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ isReady: true, tenantId: 'tenant', employeeId: 'employee', displayName: 'Employee' }) }));
vi.mock('@/screens/portal/PortalTabScreen', () => ({ PortalTabScreen: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/lib/employeeLogbook', () => ({
  berlinToday: () => '2026-10-11', berlinDateKey: () => '2026-10-11', resolveEmployeeLogbookEligibility: vi.fn(), loadEmployeeLogbook: vi.fn(),
  uploadLogbookFile: h.upload, createLogbookReceipt: h.receipt, saveLogbookProfile: h.profile,
}));
vi.mock('@/lib/portal/portalAppointmentsLiveService', () => ({ fetchLivePortalAppointmentsForEmployee: vi.fn() }));
vi.mock('@/lib/portal/employeePortalClientRecordsService', () => ({ fetchEmployeePortalClientRecords: vi.fn() }));
vi.mock('@/lib/employeeLogbook/employeeLogbookAutomation', () => ({ createEmployeeLogbookTrackingGuard: (_tenant: string, _employee: string, options: any) => options?.shouldContinue ?? (() => true) }));
vi.mock('@/theme', () => ({ typography: { body: {}, caption: {}, h3: {} } }));
import { EmployeeLogbookScreen } from '@/screens/portal/EmployeeLogbookScreen';
let root: Root, host: HTMLDivElement;
const bundle = { profile: { tenantId: 'tenant', employeeId: 'employee', mileageRateCents: 30 }, trips: [], vehicles: [], confirmations: [], segments: [], receipts: [] };
beforeEach(() => {
  vi.clearAllMocks(); h.refresh.mockResolvedValue(undefined); h.refreshWithResult.mockResolvedValue(true);
  h.query.mockImplementation((_fetch, _deps, options) => ({ data: options.queryKey.startsWith('logbook-eligibility:') ? { eligible: true } : options.queryKey.startsWith('logbook-links:') ? { assignments: [], clients: [] } : bundle, loading: false, error: null, refreshError: null, refresh: h.refresh, refreshWithResult: h.refreshWithResult }));
  h.pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///receipt.pdf', name: 'receipt.pdf', mimeType: 'application/pdf' }] });
  h.upload.mockResolvedValue('stored-file'); h.receipt.mockResolvedValue(undefined); h.profile.mockResolvedValue(undefined);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const button = (text: string) => [...host.querySelectorAll('button')].find(node => node.textContent === text)!;
const render = async () => { await act(async () => root.render(<EmployeeLogbookScreen />)); };
const click = async (text: string) => { await act(async () => button(text).click()); };
const edit = async (label: string, value: string) => { await act(async () => { const input = host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement; input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }); };
describe('logbook receipt and driving-licence interactions', () => {
  it('shares the pending receipt save and releases controls on a persistence error', async () => {
    await render(); await click('Belege'); await click('Beleg auswählen'); await edit('Betrag (EUR)', '12,50');
    let reject!: (cause: Error) => void; h.receipt.mockReturnValue(new Promise((_resolve, r) => { reject = r; }));
    await act(async () => { button('Beleg speichern').click(); button('Beleg speichern').click(); });
    expect(h.upload).toHaveBeenCalledOnce(); expect(h.receipt).toHaveBeenCalledOnce(); expect(button('Beleg speichern').disabled).toBe(true);
    await act(async () => reject(new Error('Beleg wurde abgelehnt')));
    expect(host.textContent).toContain('Beleg wurde abgelehnt'); expect(button('Beleg speichern').disabled).toBe(false); expect(host.textContent).not.toContain('Beleg sicher gespeichert');
  });
  it('validates date and amount before uploading a file', async () => {
    await render(); await click('Belege'); await click('Beleg auswählen'); await edit('Betrag (EUR)', '12'); await edit('Datum (JJJJ-MM-TT)', '2026-02-30'); await click('Beleg speichern');
    expect(host.textContent).toContain('gültiges Belegdatum'); expect(h.upload).not.toHaveBeenCalled(); expect(h.receipt).not.toHaveBeenCalled();
  });
  it('reports picker failures and unlocks both licence sides for retry', async () => {
    h.pick.mockRejectedValue(new Error('Dateiauswahl nicht verfügbar')); await render(); await click('Führerschein'); await click('Vorderseite hochladen');
    expect(host.textContent).toContain('Dateiauswahl nicht verfügbar'); expect(button('Vorderseite hochladen').disabled).toBe(false); expect(button('Rückseite hochladen').disabled).toBe(false);
  });
  it('serializes both licence sides and distinguishes persisted upload from a failed reread', async () => {
    await render(); await click('Führerschein');
    let resolve!: (path: string) => void; h.upload.mockReturnValue(new Promise(r => { resolve = r; })); h.refreshWithResult.mockResolvedValue(false);
    await act(async () => { button('Vorderseite hochladen').click(); button('Rückseite hochladen').click(); });
    expect(h.pick).toHaveBeenCalledOnce(); expect(h.upload).toHaveBeenCalledOnce(); expect(button('Rückseite hochladen').disabled).toBe(true);
    await act(async () => resolve('front-file'));
    expect(h.profile).toHaveBeenCalledWith(expect.objectContaining({ licenseFrontPath: 'front-file' })); expect(h.refreshWithResult).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Führerschein wurde gespeichert. Die aktuelle Ansicht'); expect(button('Rückseite hochladen').disabled).toBe(false);
  });
  it('preserves the already saved front when a back upload follows a failed overview refresh', async () => {
    h.refreshWithResult.mockResolvedValue(false); h.upload.mockResolvedValueOnce('front-file').mockResolvedValueOnce('back-file');
    await render(); await click('Führerschein'); await click('Vorderseite hochladen'); await click('Rückseite hochladen');
    expect(h.profile).toHaveBeenCalledTimes(2);
    expect(h.profile.mock.calls[1][0]).toMatchObject({ licenseFrontPath: 'front-file', licenseBackPath: 'back-file' });
  });
});
