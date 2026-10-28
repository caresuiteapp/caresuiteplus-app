// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ query: vi.fn(), decide: vi.fn(), pick: vi.fn(), upload: vi.fn(), claim: vi.fn(), refresh: vi.fn(), refreshWithResult: vi.fn(), pdf: vi.fn(), open: vi.fn(), actor: { tenantId: 'tenant-fixture', employeeId: 'employee-fixture' as string | null, actorId: 'user-fixture', roleKey: 'employee_portal', isReady: true, isLinkedReady: true, isResolvingEmployeeLink: false } }));
vi.mock('react-native', () => {
  const View = ({ children }: any) => <div>{children}</div>;
  return { View, ScrollView: View, Text: ({ children }: any) => <span>{children}</span>, Pressable: ({ children, onPress, accessibilityLabel }: any) => <button aria-label={accessibilityLabel} onClick={onPress}>{children}</button>, Modal: ({ children, visible }: any) => visible ? <div role="dialog">{children}</div> : null, Linking: { openURL: h.open }, Platform: { OS: 'android' }, StyleSheet: { create: (styles: any) => styles, absoluteFill: {} } };
});
vi.mock('@/components/ui', async () => ({
  ...await import('@/components/ui/WorkflowFeedbackOverlay'),
  PremiumButton: ({ title, onPress, loading, disabled }: any) => <button disabled={disabled || loading} onClick={onPress}>{title}</button>,
  PremiumInput: ({ label, value, onChangeText }: any) => <input aria-label={label} value={value} onInput={event => onChangeText(event.currentTarget.value)} />,
  PremiumCard: ({ children }: any) => <div>{children}</div>, SectionPanel: ({ title, children }: any) => <section><h2>{title}</h2>{children}</section>,
  PremiumBadge: ({ label }: any) => <span>{label}</span>, InfoBanner: ({ message }: any) => <p>{message}</p>, EmptyState: ({ title }: any) => <p>{title}</p>, LoadingState: ({ message }: any) => <p>{message}</p>, ErrorState: ({ message }: any) => <p>{message}</p>,
}));
vi.mock('@/components/icons/SemanticArtwork', () => ({ SemanticArtwork: ({ children }: any) => <span>{children}</span> }));
vi.mock('@/components/brand/CareSuiteLoadingIndicator', () => ({ CareSuiteLoadingIndicator: () => <span>CareSuite</span> }));
vi.mock('@/components/brand/appStartIntroSession', () => ({ useAppStartIntroReady: () => true }));
vi.mock('@/design/tokens/portalPremium', async original => ({ ...await original<object>(), usePortalPremiumRuntimeTheme: () => ({ active: true }) }));
vi.mock('@/design/ThemeModeProvider', () => ({ useThemeMode: () => ({ mode: 'light', desktopThemeMode: 'dark' }) }));
vi.mock('@/lib/dom/workflowFeedbackInteractionLock', () => ({ acquireWorkflowFeedbackInteractionLock: vi.fn() }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({ isPhone: true }) }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ ...h.actor }) }));
vi.mock('@/hooks/core/useAsyncQuery', () => ({ useAsyncQuery: h.query }));
vi.mock('@/screens/portal/PortalTabScreen', () => ({ PortalTabScreen: ({ children }: any) => <main>{children}</main> }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: h.pick }));
vi.mock('@/lib/payroll', async () => ({ ...await import('@/lib/payroll/payrollCalculator'), loadEmployeePayrollMonth: vi.fn(), decidePayrollStatement: h.decide, uploadExpenseReceipt: h.upload, createExpenseClaim: h.claim, getPayrollPdfUrl: h.pdf }));

import { calculatePayrollSnapshot } from '@/lib/payroll/payrollCalculator';
import { EmployeePayrollMonthScreen } from '@/screens/portal/EmployeePayrollMonthScreen';

const snapshot = calculatePayrollSnapshot({ employeeId: 'employee-fixture', employeeName: 'Mara Beispiel', periodYear: 2026, periodMonth: 10, compensationType: 'hourly', compensationAmount: 2000, actualWorkMinutes: 480, travelMinutes: 60, vacationMinutes: 0, sickMinutes: 0, otherPaidAbsenceMinutes: 0, plannedMinutes: 600, expenses: [], now: '2026-10-26T08:00:00.000Z' });
let root: Root, host: HTMLDivElement;
const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent === label)!;
const render = async () => { await act(async () => root.render(<EmployeePayrollMonthScreen />)); };
const click = async (label: string) => { await act(async () => button(label).click()); };
const reason = async (value: string) => { await act(async () => { const input = host.querySelector<HTMLInputElement>('[aria-label="Ablehnungsgrund (nur bei Ablehnung)"]')!; input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }); };
const close = async () => { await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Meldung schließen"]')!.click()); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks();
  Object.assign(h.actor, { tenantId: 'tenant-fixture', employeeId: 'employee-fixture', actorId: 'user-fixture', roleKey: 'employee_portal', isReady: true, isLinkedReady: true, isResolvingEmployeeLink: false });
  h.query.mockReturnValue({ data: { statement: { id: 'statement-fixture', version: 1, status: 'published', pdfPath: null, snapshot }, expenses: [], mileageRateCents: 30 }, loading: false, error: null, refreshError: null, refresh: h.refresh, refreshWithResult: h.refreshWithResult });
  h.decide.mockResolvedValue({ ok: true, data: {} }); h.refreshWithResult.mockResolvedValue(true);
  h.pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///fixture-receipt.pdf', name: 'Beleg.pdf', mimeType: 'application/pdf' }] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('actual native payroll screen actions with inert services', () => {
  it.each(['abc', '123456789', '  123456789  ', '😀😀😀😀😀'])('rejects short rejection reason %s before calling the decision service', async value => {
    await render(); await reason(value); await click('Ablehnen');
    expect(h.decide).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('mindestens 10 Zeichen');
    expect(h.refreshWithResult).not.toHaveBeenCalled();
  });
  it.each(['0123456789', '😀😀😀😀😀😀😀😀😀😀'])('accepts exactly ten characters and keeps the decision ID, reason and reread contract (%s)', async value => {
    await render(); await reason(value); await click('Ablehnen');
    expect(h.decide).toHaveBeenCalledExactlyOnceWith('statement-fixture', 'reject', value);
    expect(h.refreshWithResult).toHaveBeenCalledOnce();
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('mit Begründung abgelehnt');
  });
  it('preserves confirmation without a rejection reason', async () => {
    await render(); await click('Verbindlich bestätigen');
    expect(h.decide).toHaveBeenCalledExactlyOnceWith('statement-fixture', 'confirm', '');
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('verbindlich bestätigt');
  });
  it('keeps a saved decision distinct from a failed reread', async () => {
    h.refreshWithResult.mockResolvedValue(false); await render(); await reason('0123456789'); await click('Ablehnen');
    expect(h.decide).toHaveBeenCalledOnce();
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('gespeichert. Die Monatsübersicht konnte noch nicht aktualisiert');
  });
  it('surfaces picker rejection in the actual feedback modal and permits a successful retry without a write', async () => {
    h.pick.mockRejectedValueOnce(new Error('Dateiauswahl nicht verfügbar'));
    await render(); await click('Quittung / Ticket auswählen');
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Beleg konnte nicht ausgewählt werden');
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Dateiauswahl nicht verfügbar');
    expect(h.upload).not.toHaveBeenCalled(); expect(h.claim).not.toHaveBeenCalled();
    await close(); await click('Quittung / Ticket auswählen');
    expect(button('Beleg: Beleg.pdf')).toBeDefined(); expect(h.pick).toHaveBeenCalledTimes(2);
    expect(h.upload).not.toHaveBeenCalled(); expect(h.claim).not.toHaveBeenCalled();
  });
  it('shows an understandable fallback for a non-Error picker failure', async () => {
    h.pick.mockRejectedValueOnce(null); await render(); await click('Quittung / Ticket auswählen');
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Beleg konnte nicht ausgewählt werden. Bitte erneut versuchen.');
  });
  it('preserves an already selected receipt when a later picker is cancelled', async () => {
    await render(); await click('Quittung / Ticket auswählen'); h.pick.mockResolvedValueOnce({ canceled: true, assets: null });
    await click('Beleg: Beleg.pdf'); expect(button('Beleg: Beleg.pdf')).toBeDefined();
    expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(h.upload).not.toHaveBeenCalled();
  });
});

const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const changeActor = async () => { Object.assign(h.actor, { actorId: 'other-user', employeeId: 'other-employee' }); await render(); };
describe('payroll async actor boundaries', () => {
 it.each([true,false])('does not expose a submission form without a verified employee link (resolving=%s)',async resolving=>{
  h.actor.employeeId=null; h.actor.isLinkedReady=false; h.actor.isResolvingEmployeeLink=resolving; await render();
  expect(button('Auslage einreichen')).toBeUndefined();
  expect(host.textContent).toContain(resolving?'Mitarbeitendenkonto wird geprüft':'Mitarbeitendenkonto ist noch nicht vollständig verknüpft');
 });
 it('does not refresh or publish an old decision response after actor change',async()=>{
  const pending=deferred<any>();h.decide.mockReturnValueOnce(pending.promise);await render();await click('Verbindlich bestätigen');await changeActor();
  await act(async()=>pending.resolve({ok:true,data:{}}));expect(h.refreshWithResult).not.toHaveBeenCalled();expect(host.querySelector('[role="dialog"]')).toBeNull();
 });
 it('keeps a current employee upload followed by claim and readback intact',async()=>{
  h.upload.mockResolvedValueOnce({ok:true,data:{path:'employee-fixture/receipt.pdf'}});h.claim.mockResolvedValueOnce({ok:true,data:{id:'claim-fixture'}});
  await render();await click('Quittung / Ticket auswählen');
  for(const [label,value] of [['Beschreibung','Dienstliches Ticket'],['Geschäftlicher Zweck','Anfahrt zum Einsatz'],['Betrag (EUR)','7,50']])await act(async()=>{const input=host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));});
  await click('Auslage einreichen');expect(h.claim).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({tenantId:'tenant-fixture',employeeId:'employee-fixture',receiptPath:'employee-fixture/receipt.pdf',amountCents:750}));
  expect(h.refreshWithResult).toHaveBeenCalledOnce();expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Auslage wurde mit Beleg zur Prüfung eingereicht');
 });
 it('clears a prior employee rejection draft and selected receipt on actor change', async () => {
  await render(); await reason('Alter personenbezogener Grund'); await click('Quittung / Ticket auswählen');
  await changeActor();
  expect(host.querySelector<HTMLInputElement>('[aria-label="Ablehnungsgrund (nur bei Ablehnung)"]')?.value).toBe('');
  expect(button('Quittung / Ticket auswählen')).toBeDefined(); expect(button('Beleg: Beleg.pdf')).toBeUndefined();
 });
 it('does not attach a late picker result to another employee', async () => {
  const pending=deferred<any>(); h.pick.mockReturnValueOnce(pending.promise); await render(); await click('Quittung / Ticket auswählen');
  await changeActor(); await act(async()=>pending.resolve({canceled:false,assets:[{uri:'file:///old.pdf',name:'Altes Konto.pdf'}]}));
  expect(button('Quittung / Ticket auswählen')).toBeDefined(); expect(button('Beleg: Altes Konto.pdf')).toBeUndefined();
 });
 it('does not proceed from a late old-employee upload to a new claim', async () => {
  const pending=deferred<any>(); h.upload.mockReturnValueOnce(pending.promise); await render(); await click('Quittung / Ticket auswählen'); await click('Auslage einreichen');
  expect(h.upload).toHaveBeenCalledOnce(); await changeActor(); await act(async()=>pending.resolve({ok:true,data:{path:'old-employee/receipt'}}));
  expect(h.claim).not.toHaveBeenCalled(); expect(h.refreshWithResult).not.toHaveBeenCalled(); expect(host.querySelector('[role="dialog"]')).toBeNull();
 });
 it('does not open a previous employee payroll PDF after an actor switch', async () => {
  const pending=deferred<any>(); h.pdf.mockReturnValueOnce(pending.promise);
  const current=h.query(); h.query.mockReturnValue({...current,data:{...current.data,statement:{...current.data.statement,pdfPath:'old-employee/payroll.pdf'}}});
  await render(); await click('PDF-Vorschau öffnen'); await changeActor();
  await act(async()=>pending.resolve({ok:true,data:'https://fixture.invalid/old-payroll.pdf'}));
  expect(h.open).not.toHaveBeenCalled();
 });
});
