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
  bmp: undefined as string | undefined,
  planId: '10000000-0000-4000-8000-000000000006',
  getPlan: vi.fn(), getLink: vi.fn(), takeHandoff: vi.fn(), confirm: vi.fn(),
  search: vi.fn(), searchAuthorizations: vi.fn(), searchDoctors: vi.fn(), searchPractices: vi.fn(), searchNational: vi.fn(), saveDoctor: vi.fn(), create: vi.fn(),
}));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ bmp: mock.bmp }), useRouter: () => ({ back: vi.fn(), push: vi.fn() }), useNavigation: () => ({ dispatch: vi.fn() }) }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: vi.fn() }));
vi.mock('@/components/layout', () => ({ ScreenShell: ({ title, children }: { title: string; children: ReactNode }) => <main><h1>{title}</h1>{children}</main> }));
vi.mock('@/components/inputs/CareMedicationScheduleInput', () => ({ CareMedicationScheduleInput: () => null }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: mock.confirm }));
vi.mock('@/lib/pflege/medicationPlanImportService', () => ({ getMedicationPlanImport: mock.getPlan, getMedicationPlanOrderLink: mock.getLink }));
vi.mock('@/lib/pflege/medicationPlanOrderHandoff', () => ({ takeMedicationPlanOrderHandoff: mock.takeHandoff }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => mock.tenant }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { tenantId: mock.tenant, id: mock.profile, roleKey: 'business_admin' } }) }));
vi.mock('@/hooks/pflege/useCareRuntimePermissions.web', () => ({ useCareRuntimePermissions: () => ({ roleKey: 'business_admin', roleLabel: 'Geschäftsführung', can: () => mock.allowed }) }));
vi.mock('@/lib/pflege/medicationLiveService', () => ({
  fetchMedicationClientOptions: async () => ({ ok: true, data: [{ id: mock.client, label: 'Testakte', allergies: null, specialNotes: null }] }),
  createLiveMedication: mock.create,
}));
vi.mock('@/lib/pflege/medicationMasterData', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/pflege/medicationMasterData')>(),
  searchMedicationPackages: mock.search, searchPhysicians: mock.searchDoctors,
  searchAuthorizedMedicines: mock.searchAuthorizations, searchPracticeLocations: mock.searchPractices,
  searchNationalPracticeLocations: mock.searchNational, saveManualPhysician: mock.saveDoctor,
}));
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
  mock.bmp = undefined; mock.confirm.mockResolvedValue(true); mock.getLink.mockResolvedValue(null);
  mock.search.mockResolvedValue({ ok: true, data: [testPackage] });
  mock.searchAuthorizations.mockResolvedValue({ ok: true, data: [] });
  mock.searchDoctors.mockResolvedValue({ ok: true, data: [testDoctor] });
  mock.searchPractices.mockResolvedValue({ ok: true, data: [] });
  mock.saveDoctor.mockResolvedValue({ ok: true, data: testDoctor });
  mock.create.mockResolvedValue({ ok: true, data: { id: mock.medication } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});

function reviewedPlan(overrides = {}) {
  mock.bmp = 'opaque-ticket';
  mock.takeHandoff.mockReturnValue({ tenantId: mock.tenant, actorId: mock.profile, clientId: mock.client, importId: mock.planId, rowIndex: 0 });
  mock.getPlan.mockResolvedValue({ id: mock.planId, clientId: mock.client, fileName: 'Synthetischer BMP', confirmed: [{ rowIndex: 0 }], plan: { rows: [{
    kind: 'medication', name: 'Präparat im BMP', pzn: '00000017', ingredients: [{ name: 'Originalwirkstoff', strength: '5 mg' }],
    section: { code: '412', label: null }, form: 'Tablette', formCode: null, page: 1,
    morning: '1', noon: '0', evening: '1', night: '0', doseText: null, unit: null, unitCode: '1', weekdayCode: null,
    instructions: null, additionalText: null, indication: 'Testindikation', ...overrides,
  }] } });
}

describe('Geprüfte Position aus einem BMP', () => {
  it('sperrt die Akte und speichert erst nach Prüfung, exakter Einzeldosis und bewusster Bestätigung', async () => {
    reviewedPlan(); await render();
    expect(host.textContent).toContain('Geprüfte Originalposition 1');
    expect(field('Klient:in suchen')).toBeNull();
    expect(field('Präparat *').value).toBe('Präparat im BMP');
    expect(field('Dosierung').value).toBe('');
    expect((button('Tageswerte aus dem Original übernehmen') as HTMLButtonElement).disabled).toBe(true);
    await type('Dosierung', '1 Stück'); await click('Tageswerte aus dem Original übernehmen');
    await type('Applikationsweg', 'oral'); await type('Verordnet durch', 'Testarzt');
    await type('Bestätigter Therapiebeginn *', '2026-11-12');
    mock.confirm.mockResolvedValueOnce(false);
    await click('Verordnung speichern'); expect(mock.create).not.toHaveBeenCalled();
    await click('Verordnung speichern');
    expect(mock.create).toHaveBeenCalledExactlyOnceWith(mock.tenant, mock.profile, expect.objectContaining({
      clientId: mock.client, bmpImportId: mock.planId, bmpRowIndex: 0, productPzn: '',
      dosage: '1 Stück', schedule: '1-0-1-0', morningDose: '1', eveningDose: '1', startDate: '2026-11-12',
    }), 'business_admin');
  });

  it('öffnet bei bestehender Übernahme und bei einem Wochenplan keine neue Anlage', async () => {
    reviewedPlan(); mock.getLink.mockResolvedValueOnce(mock.medication); await render();
    expect(host.textContent).toContain('Position bereits übernommen');
    expect(button('Verordnung speichern')).toBeUndefined();
    mock.bmp = 'another-ticket'; reviewedPlan({ weekdayCode: '2' }); mock.bmp = 'another-ticket'; await render();
    expect(button('Verordnung speichern')).toBeUndefined();
    expect(mock.create).not.toHaveBeenCalled();
  });

  it('liest bei unklarer Antwort den Originalbezug nach, ohne erneut anzulegen', async () => {
    reviewedPlan(); await render();
    await type('Dosierung', '1 Stück'); await click('Tageswerte aus dem Original übernehmen');
    await type('Applikationsweg', 'oral'); await type('Verordnet durch', 'Testarzt');
    await type('Bestätigter Therapiebeginn *', '2026-11-12');
    mock.create.mockResolvedValueOnce({ ok: false, error: 'Transport unterbrochen' });
    await click('Verordnung speichern');
    expect(host.textContent).toContain('Anlagenbeleg prüfen');
    mock.getLink.mockResolvedValueOnce(mock.medication);
    await click('Speicherergebnis erneut lesen');
    expect(host.textContent).toContain('Anlagenbeleg gelesen');
    expect(mock.getLink).toHaveBeenLastCalledWith(expect.objectContaining({ tenantId: mock.tenant, actorId: mock.profile }), mock.planId, mock.client, 0);
    expect(mock.create).toHaveBeenCalledTimes(1);
  });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe('Verzeichnisse in der Medikationsanlage', () => {
  it('zeigt EMA-Zulassungen mit Quelle und Geltungsbereich an, ohne die Verordnung oder PZN zu verändern', async () => {
    mock.searchAuthorizations.mockResolvedValue({ ok: true, data: [
      { id: mock.medication, source: 'ema-article57', sourceVersion: '12.11.2026', name: 'EMA-Prüfpräparat',
        activeSubstance: 'EMA-Wirkstoff', authorizationHolder: 'EU-Zulassungsinhaber', authorizationScope: 'EU' },
    ] });
    await render(); await click('Testakte');
    await type('Präparat *', 'Geprüftes Original'); await type('Dosierung', 'Eigene Originalangabe');
    await type('Applikationsweg', 'oral');
    await click('Zugelassene Arzneimittel suchen');
    await type('Zulassungssuche', 'EMA'); await finishSearch();
    expect(mock.searchAuthorizations).toHaveBeenCalledWith(mock.tenant, 'EMA');
    expect(mock.search).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Die Einträge enthalten keine PZN');
    await act(async () => host.querySelector<HTMLElement>('[role=button][aria-label^="EMA-Prüfpräparat, EU-Zulassung"]')!.click());
    expect(host.textContent).toContain('Zulassungseintrag · Nur zur Ansicht');
    expect(host.textContent).toContain('Zulassungsinhaber: EU-Zulassungsinhaber');
    expect(host.textContent).toContain('EMA-Datenstand: 12.11.2026');
    expect(field('Präparat *').value).toBe('Geprüftes Original');
    expect(field('Wirkstoff').value).toBe('');
    expect(field('Applikationsweg').value).toBe('oral');
    expect(field('Dosierung').value).toBe('Eigene Originalangabe');
    await click('Verordnung speichern');
    expect(mock.create).toHaveBeenCalledWith(mock.tenant, mock.profile, expect.objectContaining({
      name: 'Geprüftes Original', productPzn: '', productCatalogSource: '',
    }), 'business_admin');
  });

  it('verwirft eine verspätete EMA-Antwort beim Wechsel zur Packungssuche', async () => {
    let resolveSearch = (_value: unknown) => {};
    mock.searchAuthorizations.mockReturnValue(new Promise((resolve) => { resolveSearch = resolve; }));
    await render(); await click('Zugelassene Arzneimittel suchen');
    await type('Zulassungssuche', 'EMA'); await finishSearch();
    await click('Präparat im Verzeichnis suchen');
    await act(async () => resolveSearch({ ok: true, data: [{ id: mock.medication, name: 'Veraltete EMA-Antwort', source: 'ema-article57' }] }));
    expect(host.textContent).not.toContain('Veraltete EMA-Antwort');
    await type('Präparatesuche', '00000017'); await finishSearch();
    expect(mock.search).toHaveBeenCalledWith(mock.tenant, '00000017');
    expect(host.textContent).toContain('Testpräparat');
  });

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

  it('übernimmt RVR-Praxisdaten erst in einen Kontaktentwurf, der den Namen der verordnenden Person offenlässt', async () => {
    mock.searchPractices.mockResolvedValue({ ok: true, data: [{
      id: 'rvr-4', displayName: 'Gemeinschaftspraxis Muster', practiceName: 'Praxis Muster', specialty: 'Allgemeinmedizin',
      city: 'Herne', postalCode: '44623', street: 'Musterstraße 1', phone: null, source: 'rvr-ruhr-praxis',
      sourceVersion: '2026-11-12', sourceUpdatedAt: '2024-10-12',
    }] });
    await render(); await click('Testakte');
    await type('Verordnet durch', 'Bisherige Person');
    await click('Ärztin oder Arzt suchen'); await click('Praxissuche Ruhrgebiet');
    await type('Praxissuche Ruhrgebiet', 'Herne'); await finishSearch();
    expect(mock.searchPractices).toHaveBeenCalledWith(mock.tenant, 'Herne');
    expect(mock.searchDoctors).not.toHaveBeenCalled();
    expect(host.textContent).toContain('© Regionalverband Ruhr');
    expect(host.textContent).toContain('Lizenz dl-de/by-2-0');
    expect(host.textContent).toContain('Stand des Eintrags: 12.10.2024');
    await act(async () => host.querySelector<HTMLElement>('[role=button][aria-label^="Gemeinschaftspraxis Muster, Praxisstandort"]')!.click());
    expect(field('Verordnet durch').value).toBe('Bisherige Person');
    expect(field('Name der Ärztin oder des Arztes *').value).toBe('');
    expect(field('Praxis').value).toBe('Praxis Muster');
    expect(field('Praxisanschrift').value).toBe('Musterstraße 1');
    expect((button('Im Verzeichnis speichern und auswählen') as HTMLButtonElement).disabled).toBe(true);
    expect(mock.saveDoctor).not.toHaveBeenCalled();
    await type('Name der Ärztin oder des Arztes *', 'Dr. Testperson');
    await click('Im Verzeichnis speichern und auswählen');
    expect(mock.saveDoctor).toHaveBeenCalledWith(mock.tenant, expect.objectContaining({ displayName: 'Dr. Testperson', practiceName: 'Praxis Muster' }));
    expect(field('Verordnet durch').value).toBe('Dr. Testperson');
  });

  it('zeigt FAIR IOP als Forschungsbestand und behält den Quellenhinweis nach der Auswahl', async () => {
    mock.search.mockResolvedValue({ ok: true, data: [{ ...testPackage, source: 'fair-iop-2024', sourceVersion: '2024-v1' }] });
    await render(); await click('Testakte');
    await click('Präparat im Verzeichnis suchen'); await type('Präparatesuche', testPackage.pzn); await finishSearch();
    expect(host.textContent).toContain('FAIR IOP Medication Database · Forschungsstand 2024');
    expect(host.textContent).toContain('Lizenz CC BY 4.0');
    await act(async () => host.querySelector<HTMLElement>('[role=button][aria-label^="Testpräparat, PZN"]')!.click());
    expect(host.textContent).toContain('Datensatz FAIR IOP (DOI)');
    expect(host.textContent).toContain('PZN und Angaben mit der aktuellen Packung abgleichen.');
    expect(field('Dosierung').value).toBe('');
  });

  it('sucht bundesweit mit Bundeslandfilter und speichert einen Standort nicht als verordnende Person', async () => {
    mock.searchNational.mockResolvedValue({ ok: true, data: [{
      id: 'osm-1', name: 'Prüfpraxis', displayName: 'Prüfpraxis', practiceName: null, specialty: null,
      city: 'Berlin', postalCode: '10115', street: 'Teststraße 8', phone: null, stateCode: 'DE-BE', stateName: 'Berlin',
      source: 'osm-de-praxis', sourceVersion: '2026-11-12', sourceUpdatedAt: null,
    }] });
    await render(); await click('Testakte'); await click('Ärztin oder Arzt suchen'); await click('Praxissuche Deutschland');
    await click('Bundesland: Alle'); await click('Berlin'); await type('Praxissuche Deutschland', 'Teststraße'); await finishSearch();
    expect(mock.searchNational).toHaveBeenCalledWith(mock.tenant, 'Teststraße', 'DE-BE');
    expect(mock.searchPractices).not.toHaveBeenCalled();
    expect(host.textContent).toContain('© OpenStreetMap-Mitwirkende');
    await act(async () => host.querySelector<HTMLElement>('[role=button][aria-label^="Prüfpraxis, Praxisstandort"]')!.click());
    expect(field('Name der Ärztin oder des Arztes *').value).toBe('');
    expect(field('Praxis').value).toBe('Prüfpraxis');
    expect(field('Verordnet durch').value).toBe('');
    expect(mock.saveDoctor).not.toHaveBeenCalled();
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
