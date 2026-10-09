// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = { invoke: vi.fn(), ticket: vi.fn(), push: vi.fn(), clients: vi.fn(), recovery: vi.fn(), reset: vi.fn(), signOut: vi.fn(), url: null as string | null, can: true, speechEvents: new Map<string, (event: any) => void>(), speechStart: vi.fn(), speechAbort: vi.fn() };
const Box = (p: any) => <div>{p.children}</div>;
const Input = (p: any) => <input aria-label={p.accessibilityLabel ?? p.label} value={p.value} disabled={p.editable === false} onInput={e => (p.onChangeText ?? p.onChange)(e.currentTarget.value)} />;
const Button = (p: any) => <button aria-label={p.accessibilityLabel} disabled={p.disabled} onClick={p.onPress}>{p.children ?? p.label}</button>;
const native = { View: Box, Text: (p: any) => <span>{p.children}</span>, Image: () => null, ActivityIndicator: () => <span>Loading</span>, Pressable: Button, TextInput: Input, ScrollView: Box, KeyboardAvoidingView: Box, Modal: (p: any) => p.visible ? <div role="dialog">{p.children}</div> : null, Platform: { OS: 'android' }, StyleSheet: { create: (s: any) => s, flatten: (s: any) => s }, AppState: { addEventListener: () => ({ remove() {} }) } };
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-native': native,
  'react-native-safe-area-context': { SafeAreaView: Box, useSafeAreaInsets: () => ({ bottom: 16 }) },
  'expo-router': { useRouter: () => ({ push: api.push, canGoBack: () => false }), usePathname: () => '/business' },
  'expo-crypto': { randomUUID: () => 'native-request-id' }, 'expo-file-system': { File: class {} }, 'expo-document-picker': { getDocumentAsync: vi.fn() },
  '@/components/inputs/CareDateInput': { CareDateInput: Input }, '@/components/inputs/CareTimeInput': { CareTimeInput: Input },
  '@/lib/googleWorkspace/googleWorkspaceService': { invokeGoogleWorkspaceAction: api.invoke },
  '@/liquid-command/screens/AccessScreens': { AccessShell: Box }, '@/liquid-command/components/LiquidPrimitives': { LiquidSurface: Box, LiquidField: Input, LiquidButton: Button, LiquidState: (p: any) => <div>{p.title} {p.message}</div> },
  'expo-linking': { useURL: () => api.url }, '@/lib/auth/passwordResetService.native': { requestBusinessPasswordReset: api.recovery, completeBusinessPasswordReset: api.reset }, '@/lib/supabase/authService': { signOut: api.signOut },
  '@/lib/support/publicSupportService': { submitPublicSupportTicket: api.ticket },
  '@/lib/auth/context': { useAuth: () => ({ authReady: true, isAuthenticated: true, user: { id: 'user' }, profile: { roleKey: 'business_admin', displayName: 'Alex' } }) },
  '@/hooks/usePermissions': { usePermissions: () => ({ can: () => api.can, hasModuleGate: () => api.can }) }, '@/hooks/useServiceTenantId': {},
  '@/hooks/useTenantId': { useServiceTenantId: () => 'tenant' }, '@/hooks/useDesktopWeather.native': { useDesktopWeather: () => ({ data: null, refresh: vi.fn() }) },
  '@/lib/office/clientListService': { fetchClientList: api.clients }, '@/components/brand/brandassets': { CARESUITE_ROBOT_LOGO: 1 }, '@/components/brand/appStartIntroSession': { useAppStartIntroReady: () => true },
  'expo-audio': { createAudioPlayer: () => ({ play: vi.fn(), remove: vi.fn() }) }, 'expo-speech': { speak: vi.fn(), stop: vi.fn() },
  'expo-speech-recognition': { ExpoSpeechRecognitionModule: { isRecognitionAvailable: () => true, supportsOnDeviceRecognition: () => true, requestPermissionsAsync: async () => ({ granted: true }), start: api.speechStart, abort: api.speechAbort, stop: vi.fn() }, useSpeechRecognitionEvent: (event: string, handler: (value: any) => void) => api.speechEvents.set(event, handler) },
};
function compile(file: string, name: string) {
  const code = buildSync({ entryPoints: [file], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.png': 'empty', '.mp3': 'empty' }, external: Object.keys(dependencies) }).outputFiles[0].text;
  const module = { exports: {} as any }; new Function('require', 'module', 'exports', code)((id: string) => { if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`); return dependencies[id]; }, module, module.exports); return module.exports[name];
}
const Form = compile('src/components/googleWorkspace/WorkspaceActionForm.native.tsx', 'WorkspaceActionForm');
const Support = compile('src/screens/support/PublicSupportScreen.native.tsx', 'default');
const Neo = compile('src/ai/robot/RobotNavigationAssistant.native.tsx', 'RobotNavigationAssistant');
const Recovery = compile('src/screens/auth/BusinessPasswordRecovery.native.tsx', 'NativeBusinessPasswordRecoveryScreen');
const Reset = compile('src/screens/auth/BusinessPasswordRecovery.native.tsx', 'NativeBusinessPasswordResetScreen');
let root: Root, host: HTMLDivElement;
const find = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === text || button.getAttribute('aria-label') === text)!;
const click = async (text: string) => { expect(find(text), text).toBeTruthy(); await act(async () => find(text).click()); };
const fill = async (label: string, text: string) => { const input = host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; expect(input, label).toBeTruthy(); await act(async () => { input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); }); };
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); api.speechEvents.clear(); api.can = true; api.url = null; api.reset.mockReset(); api.recovery.mockReset(); api.signOut.mockResolvedValue({ ok: true }); api.invoke.mockReset(); api.ticket.mockReset(); api.clients.mockReset(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('native recovery forms', () => {
  it('locks duplicate mail requests and preserves the email after an unconfirmed result', async () => {
    await act(async () => root.render(<Recovery />)); await fill('Verwaltungs-E-Mail', 'admin@example.test');
    let done!: (value: any) => void; api.recovery.mockImplementation(() => new Promise(resolve => { done = resolve; }));
    await act(async () => { find('Rücksetz-Link anfordern').click(); find('Rücksetz-Link anfordern').click(); });
    expect(api.recovery).toHaveBeenCalledTimes(1);
    await act(async () => done({ ok: false, error: 'Unterbrochen' }));
    expect(host.textContent).toContain('Unterbrochen'); expect(host.querySelector<HTMLInputElement>('[aria-label="Verwaltungs-E-Mail"]')!.value).toBe('admin@example.test');
  });
  it('opens an app token in native password inputs, preserves a failed attempt and clears only a confirmed change', async () => {
    api.url = `caresuiteplus:///auth/reset-password#token_hash=${'a'.repeat(64)}&type=recovery`;
    await act(async () => root.render(<Reset />)); await fill('Neues Passwort', 'Password123'); await fill('Passwort bestätigen', 'Password123');
    api.reset.mockResolvedValueOnce({ ok: false, error: 'Unterbrochen' }).mockResolvedValueOnce({ ok: true });
    await click('Neues Passwort speichern'); expect(host.textContent).toContain('Unterbrochen'); expect(host.querySelector<HTMLInputElement>('[aria-label="Neues Passwort"]')!.value).toBe('Password123'); expect(api.signOut).not.toHaveBeenCalled();
    await click('Neues Passwort speichern'); expect(api.reset).toHaveBeenCalledTimes(2); expect(host.textContent).toContain('Passwort geändert'); expect(host.querySelector('[aria-label="Neues Passwort"]')).toBeNull(); expect(api.signOut).toHaveBeenCalledTimes(1);
  });
});
describe('Native Workspace writes', () => {
  it('requires valid mail fields and locks repeated submission while keeping failed drafts', async () => {
    await act(async () => root.render(<Form service="gmail" onSaved={vi.fn()} onCancel={vi.fn()} />)); await click('Senden'); expect(api.invoke).not.toHaveBeenCalled();
    await fill('Empfänger:in', 'name@example.invalid'); await fill('Betreff', 'Native Nachricht'); await fill('Nachricht', 'Nachricht mit Umlauten: Grüße');
    let reject!: (error: Error) => void; api.invoke.mockImplementation(() => new Promise((_, fail) => { reject = fail; })); await act(async () => { find('Senden').click(); find('Senden').click(); });
    expect(api.invoke).toHaveBeenCalledTimes(1); expect(api.invoke).toHaveBeenCalledWith('gmail_send', expect.objectContaining({ raw: expect.any(String) }), true);
    await act(async () => reject(new Error('Verbindung unterbrochen'))); expect(host.textContent).toContain('Verbindung unterbrochen'); expect(host.querySelector<HTMLInputElement>('[aria-label="Nachricht"]')!.value).toContain('Grüße');
  });
  it('rejects reversed dates before contacting Google', async () => { await act(async () => root.render(<Form service="calendar" onSaved={vi.fn()} onCancel={vi.fn()} />)); await fill('Titel', 'Termin'); await fill('Beginn · Datum', '2026-10-09'); await fill('Beginn · Ortszeit', '15:00'); await fill('Ende · Datum', '2026-10-09'); await fill('Ende · Ortszeit', '14:00'); await click('Speichern'); expect(api.invoke).not.toHaveBeenCalled(); expect(host.textContent).toContain('Ende muss nach'); });
});
describe('Native public support', () => {
  it('validates consent, keeps input on errors and displays a confirmed receipt', async () => { await act(async () => root.render(<Support />)); await click('Support-Ticket einreichen'); expect(api.ticket).not.toHaveBeenCalled(); await fill('Ihr Name', 'Alex Beispiel'); await fill('Ihre E-Mail-Adresse', 'alex@example.invalid'); await fill('Betreff', 'Anmeldung'); await fill('Was können wir für Sie tun?', 'Die Anmeldung schlägt mit einer Meldung fehl.'); const checkbox = host.querySelector<HTMLButtonElement>('button[aria-label]') ?? [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Datenschutzhinweise zur Bearbeitung'))!; await act(async () => checkbox.click());
    api.ticket.mockResolvedValueOnce({ ok: false, error: 'Bitte erneut versuchen.' }); await click('Support-Ticket einreichen'); expect(host.textContent).toContain('Bitte erneut versuchen.'); expect(host.querySelector<HTMLInputElement>('[aria-label="Betreff"]')!.value).toBe('Anmeldung');
    api.ticket.mockResolvedValueOnce({ ok: true, data: { reference: 'PUB-123456' } }); await click('Support-Ticket einreichen'); expect(host.textContent).toContain('PUB-123456'); expect(api.ticket.mock.calls[0][0].nonce).toBe(api.ticket.mock.calls[1][0].nonce);
  });
});
describe('Native Neo navigation', () => {
  it('uses on-device recognition and ignores late results after closing the assistant', async () => { await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen'); await click('Befehl sprechen'); expect(api.speechStart).toHaveBeenCalledWith(expect.objectContaining({ lang: 'de-DE', requiresOnDeviceRecognition: true })); await click('Schließen'); await act(async () => api.speechEvents.get('result')!({ isFinal: true, results: [{ transcript: 'Kalender öffnen' }] })); expect(api.push).not.toHaveBeenCalled(); expect(api.speechAbort).toHaveBeenCalled(); });
  it('requires a choice for duplicate names and opens only the chosen native client route', async () => { api.clients.mockResolvedValue({ ok: true, data: [{ id: 'one', tenantId: 'tenant', firstName: 'Anna', lastName: 'Müller', city: 'Berlin' }, { id: 'two', tenantId: 'tenant', firstName: 'Anna', lastName: 'Müller', city: 'Herne' }] }); await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen'); await fill('Befehl für Neo', 'Akte von Anna Müller öffnen'); await click('Ausführen'); expect(api.push).not.toHaveBeenCalled(); await click('2. Anna Müller · Herne'); expect(api.push).toHaveBeenCalledWith('/office/clients/two'); });
});
