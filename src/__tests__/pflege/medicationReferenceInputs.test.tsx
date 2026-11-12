// @vitest-environment happy-dom
import { act, useEffect, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MedicationCreateScreen } from '@/screens/pflege/MedicationCreateScreen.web';
import { doseWithSelectedUnit } from '@/components/pflege/MedicationReferenceInputs';

const mock = vi.hoisted(() => ({
  tenant: '10000000-0000-4000-8000-000000000001',
  profile: '10000000-0000-4000-8000-000000000002',
  client: '10000000-0000-4000-8000-000000000003',
  physician: '10000000-0000-4000-8000-000000000004',
  medication: '10000000-0000-4000-8000-000000000005',
  allowed: true,
  search: vi.fn(), searchDoctors: vi.fn(), saveDoctor: vi.fn(), create: vi.fn(),
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }), useNavigation: () => ({ dispatch: vi.fn() }) }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: vi.fn() }));
vi.mock('@/components/layout', () => ({ ScreenShell: ({ title, children }: { title: string; children: ReactNode }) => <main><h1>{title}</h1>{children}</main> }));
vi.mock('@/components/inputs/CareMedicationScheduleInput', () => ({ CareMedicationScheduleInput: () => null }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: async () => true }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => mock.tenant }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { tenantId: mock.tenant, id: mock.profile, roleKey: 'business_admin' } }) }));
vi.mock('@/hooks/pflege/useCareRuntimePermissions.web', () => ({ useCareRuntimePermissions: () => ({ roleKey: 'business_admin', roleLabel: 'Geschäftsführung', can: () => mock.allowed }) }));
vi.mock('@/lib/pflege/medicationLiveService', () => ({
  fetchMedicationClientOptions: async () => ({ ok: true, data: [{ id: mock.client, label: 'Testakte', allergies: null, specialNotes: null }] }),
  createLiveMedication: mock.create,
}));
vi.mock('@/lib/pflege/medicationMasterData', () => ({ searchMedicationPackages: mock.search, searchPhysicians: mock.searchDoctors, saveManualPhysician: mock.saveDoctor }));
vi.mock('@/lib/pflege/medicationCreateReceipt.web', () => ({ assertMedicationCreateReceipt: (value: unknown) => value, readMedicationCreateReceipt: async () => ({ id: mock.medication }) }));
vi.mock('@/hooks/core/useAsyncQuery', () => ({
  useAsyncQuery: (fetch: () => Promise<{ ok: boolean; data?: unknown; error?: string }>, deps: readonly unknown[], opts: { enabled: boolean }) => {
    const [result, setResult] = useState<{ loading: boolean; data?: unknown; error?: string }>({ loading: true });
    useEffect(() => {
      if (!opts.enabled) return;
      let current = true;
      void fetch().then((result) => { if (current) setResult({ loading: false, ...result }); });
      return () => { current = false; };
    }, [...deps, opts.enabled]);
    return result;
  },
}));
vi.mock('@/theme', () => ({
  colors: { textMuted: '#37526d' }, radius: { md: 8, lg: 12 }, spacing: { xs: 4, sm: 8, md: 12, xxl: 30 }, typography: {},
  useLegacyTheme: () => ({ colors: { borderStrong: '#adc5db', bgElevated: '#fff', bgInput: '#e6f3ff', primary: '#1462aa', textPrimary: '#13283b', textSecondary: '#37526d' } }),
}));
vi.mock('@/components/ui/PremiumButton', () => ({
  PremiumButton: ({ title, disabled, loading, onPress, accessibilityLabel }: { title: string; disabled?: boolean; loading?: boolean; onPress?: () => void; accessibilityLabel?: string }) =>
    <button aria-label={accessibilityLabel ?? title} type="button" disabled={disabled || loading} onClick={onPress}>{title}</button>,
}));
vi.mock('@/components/ui/PremiumInput', () => ({
  PremiumInput: ({ label, value, editable, onChangeText, hint }: { label: string; value: string; editable?: boolean; onChangeText?: (next: string) => void; hint?: string }) =>
    <label>{label}<input aria-label={label} disabled={editable === false} value={value} onInput={(event) => onChangeText?.(event.currentTarget.value)} />{hint ? <small>{hint}</small> : null}</label>,
}));
vi.mock('@/components/ui', async () => {
  const { PremiumButton } = await import('@/components/ui/PremiumButton');
  const { PremiumInput } = await import('@/components/ui/PremiumInput');
  return {
    PremiumButton, PremiumInput,
    FilterChipGroup: ({ options, onChange }: { options: { key: string; label: string }[]; onChange: (id: string) => void }) =>
      <div>{options.map((row) => <button key={row.key} type="button" onClick={() => onChange(row.key)}>{row.label}</button>)}</div>,
    SectionPanel: ({ title, children }: { title: string; children: ReactNode }) => <section><h2>{title}</h2>{children}</section>,
    InfoBanner: ({ title, message }: { title: string; message: string }) => <p>{title}: {message}</p>,
    ErrorState: ({ message }: { message: string }) => <p role="alert">{message}</p>,
    LoadingState: ({ message }: { message: string }) => <p>{message}</p>,
    SuccessState: ({ message }: { message: string }) => <p>{message}</p>,
  };
});

const testPackage = {
  pzn: '00000017', name: 'Testpräparat', ingredient: 'Testwirkstoff', strength: '5 Testeinheiten', dosageForm: 'Lösung',
  brand: 'Testmarke', manufacturer: 'Testhersteller', packageSize: 'Testpackung', source: 'test', sourceVersion: '2026-11',
};
const testDoctor = { id: mock.physician, displayName: 'Dr. Testperson', practiceName: 'Testpraxis', city: 'Testort', source: 'manual', sourceVersion: '1' };
let host: HTMLDivElement;
let root: Root;
const button = (title: string) => Array.from(host.querySelectorAll<HTMLElement>('button,[role=button]')).find((item) => item.textContent === title)!;
const field = (label: string) => host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
const render = () => act(async () => root.render(<MedicationCreateScreen />));
const click = (title: string) => act(async () => button(title).click());
const type = (label: string, value: string) => act(async () => {
  const input = field(label);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const finishSearch = () => act(async () => { await vi.advanceTimersByTimeAsync(250); });

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks(); vi.useFakeTimers(); mock.allowed = true;
  mock.search.mockResolvedValue({ ok: true, data: [testPackage] });
  mock.searchDoctors.mockResolvedValue({ ok: true, data: [testDoctor] });
  mock.saveDoctor.mockResolvedValue({ ok: true, data: testDoctor });
  mock.create.mockResolvedValue({ ok: true, data: { id: mock.medication } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe('Verzeichnisse in der Medikationsanlage', () => {
  it('übernimmt nur nach Auswahl die genaue Packung und den Arzteintrag; die Gabe bleibt unverändert', async () => {
    await render(); await click('Testakte');
    await type('Dosierung', 'Eigene Originalangabe');
    await click('Präparat im Verzeichnis suchen');
    await type('Präparatesuche', testPackage.pzn); await finishSearch();
    expect(mock.search).toHaveBeenCalledWith(mock.tenant, '00000017');
    expect(field('Präparat *').value).toBe('');
    await act(async () => host.querySelector<HTMLElement>('[role=button][aria-label^="Testpräparat, PZN"]')!.click());
    expect(field('Präparat *').value).toBe('Testpräparat');
    expect(field('Wirkstoff').value).toBe('Testwirkstoff');
    expect(field('Darreichungsform').value).toBe('Lösung');
    expect(field('Applikationsweg').value).toBe('');
    expect(field('Dosierung').value).toBe('Eigene Originalangabe');
    await click('Ärztin oder Arzt suchen'); await type('Arztsuche', 'Testpraxis'); await finishSearch();
    await act(async () => host.querySelector<HTMLElement>('[role=button][aria-label^="Dr. Testperson, Testpraxis"]')!.click());
    await click('Verordnung speichern');
    expect(mock.create).toHaveBeenCalledWith(mock.tenant, mock.profile, expect.objectContaining({
      clientId: mock.client, name: 'Testpräparat', productPzn: '00000017', productBrand: 'Testmarke', productManufacturer: 'Testhersteller',
      productCatalogSource: 'test', productCatalogVersion: '2026-11', dosage: 'Eigene Originalangabe', route: '', morningDose: '',
      prescribedBy: 'Dr. Testperson', prescriberDirectoryId: mock.physician,
    }), 'business_admin');
  });

  it('verwirft überholte Treffer und lässt nach einem Verzeichnisausfall eine manuelle Anlage zu', async () => {
    let resolveOld: (value: unknown) => void = () => {};
    mock.search.mockReturnValueOnce(new Promise((done) => { resolveOld = done; })).mockResolvedValueOnce({ ok: false, error: 'Transport' });
    await render(); await click('Testakte'); await click('Präparat im Verzeichnis suchen');
    await type('Präparatesuche', 'erste Suche'); await finishSearch();
    await type('Präparatesuche', 'zweite Suche'); await finishSearch();
    await act(async () => resolveOld({ ok: true, data: [testPackage] }));
    expect(host.textContent).not.toContain('Testpräparat');
    expect(host.textContent).toContain('Die manuelle Eingabe bleibt möglich.');
    await type('Präparat *', 'Manuelles Original'); await click('Verordnung speichern');
    expect(mock.create).toHaveBeenCalledWith(mock.tenant, mock.profile, expect.objectContaining({ name: 'Manuelles Original', productPzn: '', route: '' }), 'business_admin');
  });

  it('speichert eine Ärztin oder einen Arzt nur über die ausdrückliche Verzeichnisaktion', async () => {
    await render(); await click('Ärztin oder Arzt suchen'); await click('Eigenen Verzeichniseintrag anlegen');
    await type('Name der Ärztin oder des Arztes *', 'Dr. Testperson'); await type('Praxis', 'Testpraxis');
    expect(mock.saveDoctor).not.toHaveBeenCalled();
    await click('Im Verzeichnis speichern und auswählen');
    expect(mock.saveDoctor).toHaveBeenCalledWith(mock.tenant, expect.objectContaining({ displayName: 'Dr. Testperson', practiceName: 'Testpraxis' }));
    expect(field('Verordnet durch').value).toBe('Dr. Testperson');
  });

  it('hängt nach Änderungen an Stärke oder Name keine unpassenden Verzeichniskennungen an', async () => {
    await render(); await click('Testakte'); await click('Präparat im Verzeichnis suchen');
    await type('Präparatesuche', 'Testpräparat'); await finishSearch();
    await act(async () => host.querySelector<HTMLElement>('[role=button][aria-label^="Testpräparat, PZN"]')!.click());
    await click('Ärztin oder Arzt suchen'); await type('Arztsuche', 'Testpraxis'); await finishSearch();
    await act(async () => host.querySelector<HTMLElement>('[role=button][aria-label^="Dr. Testperson, Testpraxis"]')!.click());
    await type('Stärke', 'Korrigierte Originalstärke'); await type('Verordnet durch', 'Verordnende Person laut Original');
    expect(host.textContent).not.toContain('PZN 00000017');
    await click('Verordnung speichern');
    expect(mock.create).toHaveBeenCalledWith(mock.tenant, mock.profile, expect.objectContaining({
      name: 'Testpräparat', strength: 'Korrigierte Originalstärke', productPzn: '', productCatalogSource: '',
      prescribedBy: 'Verordnende Person laut Original', prescriberDirectoryId: '',
    }), 'business_admin');
  });

  it('verwendet bei einer Einheitenauswahl die eingegebene Zahl ohne Umrechnung und verändert Freitext nicht', () => {
    expect(doseWithSelectedUnit('0,5', 'ml')).toBe('0,5 ml');
    expect(doseWithSelectedUnit('0,5 ml', 'Tropfen')).toBeNull();
    expect(doseWithSelectedUnit('0,5–1 ml', 'mg')).toBeNull();
    expect(doseWithSelectedUnit('nach Verordnung', 'mg')).toBeNull();
  });
});
