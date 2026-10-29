// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeLogbookBundle } from '@/types/modules/employeeLogbook';

const h = vi.hoisted(() => ({
  actor: { isReady: true, isResolvingEmployeeLink: false, tenantId: 'tenant', employeeId: null as string | null, displayName: 'Testkonto' },
  load: vi.fn(), eligibility: vi.fn(), errors: [] as unknown[], platform: 'web' as 'web' | 'android',
}));
vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  const primitive = ({ children, onPress, disabled, accessibilityLabel, testID }: any) => <div data-testid={testID} aria-label={accessibilityLabel} onClick={disabled ? undefined : onPress}>{children}</div>;
  return { ...actual, View: primitive, ScrollView: primitive, Text: primitive, Pressable: primitive, Platform: { ...actual.Platform, get OS() { return h.platform; } } };
});
vi.mock('@/components/ui', () => ({
  SectionPanel: ({ title, children }: any) => <section><h2>{title}</h2>{children}</section>,
  PremiumCard: ({ children }: any) => <div>{children}</div>,
  EmptyState: ({ title, message }: any) => <div>{title}{message}</div>,
  ErrorState: ({ title, message, onRetry }: any) => <div role="alert">{title}{message}{onRetry ? <button onClick={onRetry}>Erneut versuchen</button> : null}</div>,
  LoadingState: ({ message }: any) => <div role="status">{message}</div>,
  InfoBanner: ({ message }: any) => <div>{message}</div>, PremiumBadge: ({ label }: any) => <span>{label}</span>,
  PremiumButton: ({ title, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{title}</button>,
  PremiumInput: () => null,
}));
vi.mock('@/components/images/CareSuiteImage', () => ({ CareSuiteImage: () => null }));
vi.mock('@/components/inputs/CareSignatureModal', () => ({ CareSignatureModal: () => null }));
vi.mock('@/components/inputs/CareEntitySelect', () => ({ CareEntitySelect: () => null }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => h.actor }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 60_000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/screens/portal/PortalTabScreen', () => ({ PortalTabScreen: ({ title, children }: any) => <main><h1>{title}</h1>{children}</main> }));
vi.mock('@/lib/employeeLogbook', () => ({
  berlinToday: () => '2026-10-29', berlinDateKey: () => '2026-10-29',
  resolveEmployeeLogbookEligibility: h.eligibility, loadEmployeeLogbook: h.load,
}));
vi.mock('@/lib/portal/portalAppointmentsLiveService', () => ({ fetchLivePortalAppointmentsForEmployee: async () => ({ ok: true, data: [] }) }));
vi.mock('@/lib/portal/employeePortalClientRecordsService', () => ({ fetchEmployeePortalClientRecords: async () => ({ ok: true, data: [] }) }));
vi.mock('@/lib/employeeLogbook/employeeLogbookAutomation', () => ({ createEmployeeLogbookTrackingGuard: (_tenant: string, _employee: string, options: any) => options.shouldContinue }));
vi.mock('@/theme', () => ({ typography: { body: {}, caption: {}, h3: {} } }));

import { EmployeeLogbookScreen } from '@/screens/portal/EmployeeLogbookScreen';

let host: HTMLDivElement, root: Root;
let releaseBundle: (value: EmployeeLogbookBundle) => void;
const bundle: EmployeeLogbookBundle = { profile: { tenantId: 'tenant', employeeId: 'employee', defaultVehicleId: null, mileageRateCents: 30, gpsConsent: false, licenseFrontPath: null, licenseBackPath: null }, trips: [], vehicles: [], confirmations: [], segments: [], receipts: [] };
const render = async () => { await act(async () => root.render(<EmployeeLogbookScreen />)); };

beforeEach(() => {
  vi.clearAllMocks(); h.errors = []; h.actor.employeeId = null; h.platform = 'web';
  h.load.mockImplementation(() => new Promise<EmployeeLogbookBundle>(resolve => { releaseBundle = resolve; }));
  h.eligibility.mockResolvedValue({ eligible: true });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host, { onUncaughtError: error => h.errors.push(error) });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('logbook with actual asynchronous query lifecycle', () => {
  it.each(['web', 'android'] as const)('keeps the page visible while an initially unresolved employee becomes linked on %s', async platform => {
    h.platform = platform;
    await render();
    expect(host.textContent).toContain('Mitarbeitendenkonto ist noch nicht vollständig verknüpft');
    expect(h.load).not.toHaveBeenCalled();

    h.actor.employeeId = 'employee';
    await render();
    expect(h.errors).toEqual([]);
    expect(host.querySelector('main')).not.toBeNull();
    expect(host.textContent).toContain('Fahrtenbuch wird sicher geladen');
    expect(h.load).toHaveBeenCalledWith('tenant', 'employee');

    await act(async () => releaseBundle(bundle));
    expect(h.errors).toEqual([]);
    expect(host.textContent).toContain('Monatsübersicht');
    expect(host.textContent).toContain('Bereit für die nächste Fahrt');
  });

  it('shows a failed read and recovers through retry after the employee link resolves', async () => {
    await render();
    h.load.mockRejectedValue(new Error('Fahrtenbuch konnte nicht geladen werden.'));
    h.actor.employeeId = 'employee';
    await render();
    expect(h.errors).toEqual([]);
    expect(host.textContent).toContain('Fahrtenbuch konnte nicht geladen werden.');
    expect(host.textContent).not.toContain('Fahrtenbuch wird sicher geladen');

    h.load.mockResolvedValue(bundle);
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(host.textContent).toContain('Monatsübersicht');
    expect(h.errors).toEqual([]);
  });

  it('waits for the vehicle eligibility result and respects its denial', async () => {
    await render();
    let releaseEligibility!: (value: { eligible: boolean; reason: string }) => void;
    h.load.mockResolvedValue(bundle);
    h.eligibility.mockImplementation(() => new Promise(resolve => { releaseEligibility = resolve; }));
    h.actor.employeeId = 'employee';
    await render();
    expect(h.errors).toEqual([]);
    expect(host.textContent).toContain('Fahrtenbuch wird sicher geladen');
    expect(host.textContent).not.toContain('Monatsübersicht');

    await act(async () => releaseEligibility({ eligible: false, reason: 'no_car_mode' }));
    expect(host.textContent).toContain('kein PKW als Verkehrsmittel hinterlegt');
    expect(host.textContent).not.toContain('Neue Fahrt aufzeichnen');
    expect(h.errors).toEqual([]);
  });

  it('clears the previous employee view while a new employee logbook loads', async () => {
    await render();
    h.load.mockResolvedValueOnce(bundle);
    h.actor.employeeId = 'employee';
    await render();
    expect(host.textContent).toContain('Monatsübersicht');

    h.actor.employeeId = 'employee-other';
    await render();
    expect(host.textContent).toContain('Fahrtenbuch wird sicher geladen');
    expect(host.textContent).not.toContain('Monatsübersicht');
    expect(h.load).toHaveBeenLastCalledWith('tenant', 'employee-other');
    expect(h.errors).toEqual([]);
  });
});
