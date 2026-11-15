// @vitest-environment happy-dom
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {takeVitalCaptureClient} from '@/lib/pflege/vitalCaptureHandoff';
import {fixture, julian, mara, people, profileId, tenantId} from './vitalCaptureWorkspace.fixture';

vi.mock('react-native', () => ({
  View: ({children}: any) => <div>{children}</div>,
  Text: ({children}: any) => <span>{children}</span>,
  ScrollView: ({children}: any) => <div>{children}</div>,
  Pressable: ({accessibilityLabel, accessibilityState, children, disabled, onPress}: any) => (
    <button aria-label={accessibilityLabel} aria-pressed={accessibilityState?.selected} disabled={disabled} onClick={onPress}>{children}</button>
  ),
  StyleSheet: {create: (value: unknown) => value},
  Platform: {OS: 'web'},
}));
vi.mock('expo-router', async () => ({useRouter: (await import('./vitalCaptureWorkspace.fixture')).useRouter}));
vi.mock('@/components/layout', () => ({
  ScreenShell: ({title, subtitle, rightSlot, children}: any) => <main><h1>{title}</h1><p>{subtitle}</p>{rightSlot}{children}</main>,
}));
vi.mock('@/components/ui', () => ({
  LoadingState: ({message}: any) => <div role="status">{message}</div>,
  ErrorState: ({message}: any) => <div role="alert">{message}</div>,
  EmptyState: ({title, message}: any) => <div><h2>{title}</h2>{message}</div>,
  InfoBanner: ({title, message}: any) => <div><strong>{title}</strong>{message}</div>,
  SuccessState: ({message}: any) => <div>{message}</div>,
  SectionPanel: ({title, children}: any) => <section><h2>{title}</h2>{children}</section>,
  PremiumButton: ({title, accessibilityLabel, onPress, disabled}: any) => (
    <button aria-label={accessibilityLabel} disabled={disabled} onClick={onPress}>{title}</button>
  ),
  PremiumInput: ({label, accessibilityLabel, value, onChangeText, editable}: any) => (
    <input aria-label={accessibilityLabel ?? label} value={value} disabled={editable === false} onInput={event => onChangeText?.(event.currentTarget.value)}/>
  ),
  FilterChipGroup: ({options, value, onChange}: any) => (
    <div>{options.map(({key, label}: {key: string; label: string}) => (
      <button key={key} aria-pressed={value === key} disabled={!onChange} onClick={() => onChange?.(key)}>{label}</button>
    ))}</div>
  ),
}));
vi.mock('@/lib/auth/context', async () => ({useAuth: (await import('./vitalCaptureWorkspace.fixture')).useAuth}));
vi.mock('@/hooks/useTenantId', async () => ({useServiceTenantId: (await import('./vitalCaptureWorkspace.fixture')).useServiceTenantId}));
vi.mock('@/hooks/pflege/useCareRuntimePermissions.web', async () => ({useCareRuntimePermissions: (await import('./vitalCaptureWorkspace.fixture')).useCareRuntimePermissions}));
vi.mock('@/hooks/core/useAsyncQuery', async () => ({useAsyncQuery: (await import('./vitalCaptureWorkspace.fixture')).useAsyncQuery}));
vi.mock('@/hooks/useMedicationSubmission.web', async () => ({useMedicationSubmission: (await import('./vitalCaptureWorkspace.fixture')).useMedicationSubmission}));
vi.mock('@/design/tokens/carelightadaptive', () => ({useCareLightPalette: () => ({c: {}})}));
vi.mock('@/theme', () => ({spacing: {}, radius: {}, typography: {}}));
vi.mock('@/components/pflege/VitalMeasurementArtwork', () => ({VitalMeasurementArtwork: () => null}));
vi.mock('@/components/pflege/VitalHistoryChartPanel.web', () => ({VitalHistoryChartPanel: () => null}));
vi.mock('@/components/pflege/MedicationEventTimeInput.web', () => ({
  MedicationEventTimeInput: () => <div>Messzeitpunkt</div>,
  currentMedicationEventTime: () => ({date: '2026-11-14', time: '10:20', selected: ''}),
  medicationEventInstant: () => '2026-11-14T10:20:00+01:00',
}));
vi.mock('@/lib/permissions/carePermissionOwner.web', async () => ({carePermissionOwner: (await import('./vitalCaptureWorkspace.fixture')).carePermissionOwner}));
vi.mock('@/lib/supabase/config', async () => ({isDemoMode: (await import('./vitalCaptureWorkspace.fixture')).isDemoMode}));
vi.mock('@/lib/pflege/vitalHistoryViewRuntime.web', async () => await import('./vitalCaptureWorkspace.fixture'));
vi.mock('@/lib/pflege/vitalHistoryClientsOriginalRead.web', async () => await import('./vitalCaptureWorkspace.fixture'));
vi.mock('@/lib/pflege/vitalCreateRuntime.web', async () => await import('./vitalCaptureWorkspace.fixture'));
vi.mock('@/lib/pflege/vitalCreateOriginalRead.web', async () => await import('./vitalCaptureWorkspace.fixture'));
vi.mock('@/lib/pflege/vitalCreateNativeWrite.web', async () => await import('./vitalCaptureWorkspace.fixture'));

import {VitalReadingsListScreen} from '@/screens/pflege/VitalReadingsListScreen.web';
import {VitalReadingCreateScreen} from '@/screens/pflege/VitalReadingCreateScreen.web';

let host: HTMLDivElement;
let root: Root;
const push = vi.fn();
const captureLabel = 'Messung erfassen';
const confirmLabel = 'Klientenauswahl aus dem Verlauf bestätigen';
const page = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
const button = (label: string) => Array.from(host.querySelectorAll('button'))
  .find(node => (node.getAttribute('aria-label') || node.textContent?.trim()) === label);
const click = async (label: string) => {
  const control = button(label);
  expect(control, label).toBeDefined();
  expect(control?.disabled, label).toBe(false);
  await act(async () => control!.click());
};
const readChoiceKeys = () => [...fixture.enabledQueryKeys].filter(key => key.endsWith(':vital-choices'));
const selectFromHistory = async () => {
  await page(<VitalReadingsListScreen/>);
  expect(button(captureLabel)?.disabled ?? true).toBe(true);
  await click(mara.name);
  await click(captureLabel);
  expect(push).toHaveBeenCalledExactlyOnceWith('/pflege/vitalwerte/create');
};

beforeEach(() => {
  (globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.createPeople = [...people];
  fixture.historyPeople = [...people];
  fixture.mayRead = true;
  fixture.mayManage = true;
  fixture.enabledQueryKeys.clear();
  fixture.router.push = push;
  push.mockReset();
  takeVitalCaptureClient({tenantId, profileId, roleKey: 'nurse'});
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('Vitalwerte · Übersicht und Erfassung', () => {
  it('shows and filters the full catalog without an eligible case and sends no case-specific request', async () => {
    fixture.createPeople = [];
    await page(<VitalReadingCreateScreen/>);
    expect(host.textContent).toContain('42 Messarten');
    expect(host.textContent).toContain('Körperoberfläche');
    expect(host.textContent).toContain('Sauerstoffpartialdruck');
    expect(readChoiceKeys()).toEqual([]);
    expect(button('Messung speichern')?.disabled).toBe(true);
    await click('Körpermaße');
    expect(host.textContent).toContain('5 Messarten');
    expect(host.textContent).not.toContain('Sauerstoffpartialdruck');
  });

  it('opens a generic create route and waits for explicit confirmation before loading that case’s catalog', async () => {
    await selectFromHistory();
    await page(<React.StrictMode><VitalReadingCreateScreen/></React.StrictMode>);
    expect(button(confirmLabel)).toBeDefined();
    expect(host.textContent).toContain(mara.name);
    expect(readChoiceKeys()).toEqual([]);
    expect(button('Nichtinvasiver Blutdruck auswählen')).toBeUndefined();

    await click(confirmLabel);
    expect(readChoiceKeys()).toEqual([expect.stringContaining(mara.id)]);
    expect(button('Nichtinvasiver Blutdruck auswählen')).toBeDefined();
    expect(button('Körperoberfläche auswählen')).toBeUndefined();
    await click('Alle Messarten im Katalog');
    expect(button('Körperoberfläche – nicht für diese Akte aktiviert')?.disabled).toBe(true);
    expect(host.querySelector('[aria-label="Systolisch in mmHg"]')).toBeNull();
    await click('Nichtinvasiver Blutdruck auswählen');
    expect(host.querySelector<HTMLInputElement>('[aria-label="Systolisch in mmHg"]')?.value).toBe('');
    expect(host.querySelector<HTMLInputElement>('[aria-label="Diastolisch in mmHg"]')?.value).toBe('');
  });

  it('zeigt Kontextoptionen großgeschrieben, übernimmt die Auswahl und erlaubt eigene Angaben', async () => {
    await page(<VitalReadingCreateScreen/>);
    await click(`Pflegefall auswählen: ${mara.name}`);
    await click('Nichtinvasiver Blutdruck auswählen');
    await click('Körperlage: Auswählen');
    expect(button('Linke Seitenlage')).toBeDefined();
    expect(button('Sitzend')).toBeDefined();
    expect(button('sitzend')).toBeUndefined();
    await click('Sitzend');
    expect(button('Körperlage: Sitzend')).toBeDefined();
    await click('Körperlage: Sitzend');
    await click('Eigene Angabe');
    expect(host.querySelector('[aria-label="Körperlage · Eigene Angabe"]')).not.toBeNull();
  });

  it('does not suggest a case missing from the fresh create receipt', async () => {
    await selectFromHistory();
    fixture.createPeople = [julian];
    await page(<VitalReadingCreateScreen/>);
    expect(button(confirmLabel)).toBeUndefined();
    expect(host.textContent).not.toContain(mara.name);
    expect(button(`Pflegefall auswählen: ${julian.name}`)).toBeDefined();
    expect(readChoiceKeys()).toEqual([]);
  });

  it('keeps a read-only case out of the recording workflow', async () => {
    fixture.mayManage = false;
    await page(<VitalReadingsListScreen/>);
    await click(mara.name);
    expect(button(captureLabel)?.disabled ?? true).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expect(takeVitalCaptureClient({tenantId, profileId, roleKey: 'nurse'})).toBeNull();
  });

  it('rechecks permission when a rendered capture button is clicked after a revocation', async () => {
    await page(<VitalReadingsListScreen/>);
    await click(mara.name);
    fixture.mayManage = false;
    await click(captureLabel);
    expect(push).not.toHaveBeenCalled();
    expect(takeVitalCaptureClient({tenantId, profileId, roleKey: 'nurse'})).toBeNull();
  });
});
