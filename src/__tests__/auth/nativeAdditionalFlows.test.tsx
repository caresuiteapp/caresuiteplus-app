// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = { invoke: vi.fn(), ticket: vi.fn(), push: vi.fn(), clients: vi.fn(), recovery: vi.fn(), reset: vi.fn(), signOut: vi.fn(), url: null as string | null, can: true, pathname: '/business', ready: true, speechAvailable: true, speechPermission: true, speak: vi.fn(), appState: null as null | ((state: string) => void), speechEvents: new Map<string, (event: any) => void>(), speechStart: vi.fn(), speechAbort: vi.fn(), locales: vi.fn(), permission: vi.fn(), downloadModel: vi.fn(), available: vi.fn(), pan: null as any, width: 1280, height: 800 };
const flatten = (s: any): any => Array.isArray(s) ? Object.assign({}, ...s.map(flatten)) : s ?? {};
const Box = (p: any) => <div data-testid={p.testID} style={flatten(p.style)}>{p.children}</div>;
const Input = (p: any) => <input aria-label={p.accessibilityLabel ?? p.label} value={p.value} disabled={p.editable === false} onInput={e => (p.onChangeText ?? p.onChange)(e.currentTarget.value)} />;
const Button = (p: any) => <button aria-label={p.accessibilityLabel} disabled={p.disabled} onClick={p.onPress}>{p.children ?? p.label}</button>;
const native = { View: Box, Text: (p: any) => <span>{p.children}</span>, Image: () => null, ActivityIndicator: () => <span>Loading</span>, Pressable: Button, TextInput: Input, ScrollView: Box, KeyboardAvoidingView: Box, Modal: (p: any) => p.visible ? <div role="dialog">{p.children}</div> : null, useWindowDimensions: () => ({ width: api.width, height: api.height }), PanResponder: { create: (config: any) => { api.pan = config; return { panHandlers: {} }; } }, Platform: { OS: 'android', Version: 35 }, StyleSheet: { create: (s: any) => s, flatten: (s: any) => s }, AppState: { addEventListener: (_: string, listener: (state: string) => void) => { api.appState = listener; return { remove() {} }; } } };
// HTML hosts for the generated native Google form; providers remain inert.
const formTags = Object.fromEntries(['Form','Div','H3','Label','Select','Option','Span','P'].map(tag => ['Native' + tag, (props: any) => React.createElement(tag.toLowerCase(), props, props.children)]));
Object.assign(formTags, { NativeButton: (props: any) => <button {...props} />, NativeInput: (props: any) => <input {...props} onInput={props.onChange} onChange={() => undefined} />, NativeTextarea: (props: any) => <textarea {...props} onInput={props.onChange} onChange={() => undefined} /> });
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-native': native,
  '@/components/layout/NativeWorkspaceElements.native': formTags,
  '@/lib/platform/nativeWorkflowEnvironment.native': { nativeCrypto: { randomUUID: () => 'native-request-id' } },
  'react-native-safe-area-context': { SafeAreaView: Box, useSafeAreaInsets: () => ({ top: 24, left: 0, right: 0, bottom: 16 }) },
  'expo-router': { useRouter: () => ({ push: api.push, canGoBack: () => false }), usePathname: () => api.pathname },
  'expo-crypto': { randomUUID: () => 'native-request-id' }, 'expo-file-system': { File: class {} }, 'expo-document-picker': { getDocumentAsync: vi.fn() },
  '@/components/inputs/CareDateInput': { CareDateInput: Input }, '@/components/inputs/CareTimeInput': { CareTimeInput: Input },
  '@/lib/googleWorkspace/googleWorkspaceService': { invokeGoogleWorkspaceAction: api.invoke },
  '@/liquid-command/screens/AccessScreens': { AccessShell: Box }, '@/liquid-command/components/LiquidPrimitives': { LiquidSurface: Box, LiquidField: Input, LiquidButton: Button, LiquidState: (p: any) => <div>{p.title} {p.message}</div> },
  'expo-linking': { useURL: () => api.url }, '@/lib/auth/passwordResetService.native': { requestBusinessPasswordReset: api.recovery, completeBusinessPasswordReset: api.reset }, '@/lib/supabase/authService': { signOut: api.signOut },
  '@/lib/support/publicSupportService': { submitPublicSupportTicket: api.ticket },
  '@/lib/auth/context': { useAuth: () => ({ authReady: true, isAuthenticated: true, user: { id: 'user' }, profile: { roleKey: 'business_admin', displayName: 'Alex' } }) },
  '@/hooks/usePermissions': { usePermissions: () => ({ can: () => api.can, hasModuleGate: () => api.can }) }, '@/hooks/useServiceTenantId': {},
  '@/hooks/useTenantId': { useServiceTenantId: () => 'tenant' }, '@/hooks/useDesktopWeather.native': { useDesktopWeather: () => ({ data: null, refresh: vi.fn() }) },
  '@/lib/office/clientListService': { fetchClientList: api.clients }, '@/components/brand/brandassets': { CARESUITE_ROBOT_LOGO: 1 }, '@/components/brand/appStartIntroSession': { useAppStartIntroReady: () => api.ready },
  'expo-audio': { createAudioPlayer: () => ({ play: vi.fn(), remove: vi.fn(), addListener: () => ({ remove() {} }) }) }, 'expo-speech': { speak: (...args: any[]) => api.speak(...args), stop: vi.fn() },
  'expo-speech-recognition': { ExpoSpeechRecognitionModule: { isRecognitionAvailable: api.available, supportsOnDeviceRecognition: () => api.speechAvailable, requestPermissionsAsync: api.permission, getSupportedLocales: api.locales, androidTriggerOfflineModelDownload: api.downloadModel, start: api.speechStart, abort: api.speechAbort, stop: vi.fn() }, useSpeechRecognitionEvent: (event: string, handler: (value: any) => void) => api.speechEvents.set(event, handler) },
};
function compile(file: string, name: string) {
  const code = buildSync({ entryPoints: [file], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.png': 'empty', '.mp3': 'empty' }, external: Object.keys(dependencies) }).outputFiles[0].text;
  const module = { exports: {} as any }; new Function('require', 'module', 'exports', code)((id: string) => { if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`); return dependencies[id]; }, module, module.exports); return module.exports[name];
}
let WorkspaceForm: any;
const Form = (props: any) => { WorkspaceForm ??= compile('src/components/googleWorkspace/WorkspaceActionForm.native.tsx', 'WorkspaceActionForm'); return <WorkspaceForm {...props}/>; };
const Support = compile('src/screens/support/PublicSupportScreen.native.tsx', 'default');
const Neo = compile('src/ai/robot/RobotNavigationAssistant.native.tsx', 'RobotNavigationAssistant');
const Recovery = compile('src/screens/auth/BusinessPasswordRecovery.native.tsx', 'NativeBusinessPasswordRecoveryScreen');
const Reset = compile('src/screens/auth/BusinessPasswordRecovery.native.tsx', 'NativeBusinessPasswordResetScreen');
let root: Root, host: HTMLDivElement;
const find = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === text || button.getAttribute('aria-label') === text)!;
const click = async (text: string) => { expect(find(text), text).toBeTruthy(); await act(async () => find(text).click()); };
const fill = async (label: string, text: string) => { const input = host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; expect(input, label).toBeTruthy(); await act(async () => { input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); }); };
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); api.speechEvents.clear(); api.can = true; api.pathname = '/business'; api.ready = true; api.speechAvailable = true; api.speechPermission = true; api.appState = null; api.width = 1280; api.height = 800; api.available.mockImplementation(() => api.speechAvailable); api.permission.mockImplementation(async () => ({ granted: api.speechPermission })); api.locales.mockResolvedValue({ locales: ['de-DE'], installedLocales: ['de-DE'] }); api.downloadModel.mockResolvedValue({ status: 'download_success' }); api.speak.mockImplementation((_text: string, options: any) => queueMicrotask(() => options.onDone?.())); api.url = null; api.reset.mockReset(); api.recovery.mockReset(); api.signOut.mockResolvedValue({ ok: true }); api.invoke.mockReset(); api.ticket.mockReset(); api.clients.mockReset(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
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
  const fillForm=async(name:string,text:string)=>{const input=host.querySelector<HTMLInputElement|HTMLTextAreaElement>(`[name="${name}"]`)!;expect(input,name).toBeTruthy();await act(async()=>{input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));});};
  it('requires valid mail fields and locks repeated submission while keeping failed drafts', async () => {
    await act(async () => root.render(<Form service="gmail" onSaved={vi.fn()} onCancel={vi.fn()} />)); await click('Senden'); expect(api.invoke).not.toHaveBeenCalled();
    await fillForm('to', 'name@example.invalid'); await fillForm('title', 'Native Nachricht'); await fillForm('body', 'Nachricht mit Umlauten: Grüße');
    let reject!: (error: Error) => void; api.invoke.mockImplementation(() => new Promise((_, fail) => { reject = fail; })); await act(async () => { find('Senden').click(); find('Senden').click(); });
    expect(api.invoke).toHaveBeenCalledTimes(1); expect(api.invoke).toHaveBeenCalledWith('gmail_send', expect.objectContaining({ raw: expect.any(String) }), true);
    await act(async () => reject(new Error('Verbindung unterbrochen'))); expect(host.textContent).toContain('Verbindung unterbrochen'); expect(host.querySelector<HTMLTextAreaElement>('[name="body"]')!.value).toContain('Grüße');
  });
  it('rejects reversed dates before contacting Google', async () => { await act(async () => root.render(<Form service="calendar" onSaved={vi.fn()} onCancel={vi.fn()} />)); await fillForm('title', 'Termin'); await fillForm('start', '2026-10-09T15:00'); await fillForm('end', '2026-10-09T14:00'); await click('Speichern'); expect(api.invoke).not.toHaveBeenCalled(); expect(host.textContent).toContain('Ende muss nach'); });
});
describe('Native public support', () => {
  it('validates consent, keeps input on errors and displays a confirmed receipt', async () => { await act(async () => root.render(<Support />)); await click('Support-Ticket einreichen'); expect(api.ticket).not.toHaveBeenCalled(); await fill('Ihr Name', 'Alex Beispiel'); await fill('Ihre E-Mail-Adresse', 'alex@example.invalid'); await fill('Betreff', 'Anmeldung'); await fill('Was können wir für Sie tun?', 'Die Anmeldung schlägt mit einer Meldung fehl.'); const checkbox = host.querySelector<HTMLButtonElement>('button[aria-label]') ?? [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Datenschutzhinweise zur Bearbeitung'))!; await act(async () => checkbox.click());
    api.ticket.mockResolvedValueOnce({ ok: false, error: 'Bitte erneut versuchen.' }); await click('Support-Ticket einreichen'); expect(host.textContent).toContain('Bitte erneut versuchen.'); expect(host.querySelector<HTMLInputElement>('[aria-label="Betreff"]')!.value).toBe('Anmeldung');
    api.ticket.mockResolvedValueOnce({ ok: true, data: { reference: 'PUB-123456' } }); await click('Support-Ticket einreichen'); expect(host.textContent).toContain('PUB-123456'); expect(api.ticket.mock.calls[0][0].nonce).toBe(api.ticket.mock.calls[1][0].nonce);
  });
});
const sayNative = async (transcript: string) => {
  await act(async () => {
    api.speechEvents.get('result')!({ isFinal: true, results: [{ transcript }] });
    for (let index = 0; index < 20; index++) await Promise.resolve();
  });
};
describe('Native Neo navigation', () => {
  it.each(['/', '/business', '/business/(tabs)', '/business/dashboard'])('starts centred at the top of desktop %s', async pathname => {
    api.pathname = pathname; await act(async () => root.render(<Neo />));
    const neo = host.querySelector<HTMLElement>('[data-testid="native-neo-assistant"]')!;
    expect(Number.parseFloat(neo.style.left) + 34).toBe(api.width / 2);
    expect(Number.parseFloat(neo.style.top)).toBe(54);
    await click('Neo-Assistent öffnen');
    expect(api.speak).toHaveBeenCalledWith(expect.stringContaining('ich bin Neo'), expect.anything());
    expect(api.speechStart).toHaveBeenCalledOnce();
  });
  it('continues after an inactive microphone permission prompt, only once the app is active', async () => {
    let grant!: (permission: { granted: boolean }) => void;
    api.permission.mockImplementationOnce(() => new Promise(resolve => { grant = resolve; }));
    await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen');
    await act(async () => api.appState?.('inactive'));
    await act(async () => grant({ granted: true }));
    expect(api.speechStart).not.toHaveBeenCalled();
    await act(async () => api.appState?.('active'));
    expect(api.speechStart).toHaveBeenCalledOnce();
  });
  it('does not start after leaving the app during a pending permission prompt', async () => {
    let grant!: (permission: { granted: boolean }) => void;
    api.permission.mockImplementationOnce(() => new Promise(resolve => { grant = resolve; }));
    await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen');
    await act(async () => api.appState?.('background'));
    await act(async () => grant({ granted: true })); await act(async () => api.appState?.('active'));
    expect(api.speechStart).not.toHaveBeenCalled(); expect(api.speak).not.toHaveBeenCalled();
  });
  it('offers the missing German model and starts locally only after a confirmed installation and another tap', async () => {
    api.locales.mockResolvedValue({ locales: ['de-DE'], installedLocales: ['en-US'] });
    await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen');
    expect(host.textContent).toContain('deutsche Sprachpaket fehlt'); expect(api.speechStart).not.toHaveBeenCalled();
    await click('Deutsches Sprachpaket laden');
    expect(api.downloadModel).toHaveBeenCalledWith({ locale: 'de-DE' }); expect(api.speechStart).not.toHaveBeenCalled();
    api.locales.mockResolvedValue({ locales: ['de-DE'], installedLocales: ['de-DE'] });
    await click('Neo-Assistent öffnen');
    expect(api.speechStart).toHaveBeenCalledWith(expect.objectContaining({ lang: 'de-DE', requiresOnDeviceRecognition: true }));
  });
  it('shows a service failure instead of rejecting activation silently', async () => {
    api.available.mockImplementationOnce(() => { throw new Error('recognizer service unavailable'); });
    await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen');
    expect(host.textContent).toContain('Prüfe den Sprachdienst'); expect(host.textContent).not.toContain('recognizer service unavailable'); expect(api.speechStart).not.toHaveBeenCalled();
  });
  it('cancels a spoken destination when Neo is dragged and keeps the robot inside the rotated viewport', async () => {
    await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen');
    api.speak.mockImplementationOnce(() => undefined);
    await sayNative('Kalender öffnen');
    await act(async () => { api.pan.onPanResponderGrant(); api.pan.onPanResponderMove({}, { dx: 3000, dy: 3000 }); api.pan.onPanResponderRelease(); });
    expect(api.push).not.toHaveBeenCalled();
    api.width = 360; api.height = 740; await act(async () => root.render(<Neo />));
    const neo = host.querySelector<HTMLElement>('[data-testid="native-neo-assistant"]')!;
    expect(Number.parseFloat(neo.style.left) + 68).toBeLessThanOrEqual(352);
    expect(Number.parseFloat(neo.style.top) + 74).toBeLessThanOrEqual(716);
  });
  it('starts local speech directly without the old text-command dialog and ignores late results after stopping', async () => {
    await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen');
    expect(api.speechStart).toHaveBeenCalledWith(expect.objectContaining({ lang: 'de-DE', requiresOnDeviceRecognition: true }));
    expect(host.querySelector('input')).toBeNull(); expect(host.querySelector('[role="dialog"]')).toBeNull();
    await click('Gespräch beenden'); await sayNative('Kalender öffnen');
    expect(api.push).not.toHaveBeenCalled(); expect(api.speechAbort).toHaveBeenCalled();
  });
  it('uses the shared conversation for duplicate names and opens only the spoken choice', async () => {
    api.clients.mockResolvedValue({ ok: true, data: [{ id: 'one', tenantId: 'tenant', firstName: 'Anna', lastName: 'Müller', city: 'Berlin' }, { id: 'two', tenantId: 'tenant', firstName: 'Anna', lastName: 'Müller', city: 'Herne' }] });
    await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen');
    await sayNative('Akte von Anna Müller öffnen');
    expect(api.push).not.toHaveBeenCalled(); expect(api.speak).toHaveBeenCalledWith(expect.stringContaining('2. Anna Müller, Herne'), expect.anything());
    await sayNative('Nummer zwei'); expect(api.push).toHaveBeenCalledWith('/office/clients/two');
  });
  it('keeps Neo on the central desktop and cancels pending speech when a work page opens', async () => {
    api.ready = false; await act(async () => root.render(<Neo />)); expect(find('Neo-Assistent öffnen')).toBeUndefined();
    api.ready = true; await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen');
    api.pathname = '/business/office/clients'; await act(async () => root.render(<Neo />));
    expect(find('Neo-Assistent öffnen')).toBeUndefined(); expect(api.speechAbort).toHaveBeenCalled();
    await sayNative('Rechnungen öffnen'); expect(api.push).not.toHaveBeenCalled();
  });
  it('uses the same multi-turn questions as Web without storing or displaying a chat', async () => {
    await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen');
    await sayNative('Ich möchte etwas anlegen');
    expect(api.speak).toHaveBeenCalledWith(expect.stringMatching(/Was|Welche|Worum/), expect.anything());
    await sayNative('Klient');
    expect(api.speak).toHaveBeenLastCalledWith(expect.stringContaining('Schritt 1'), expect.anything());
    expect(host.querySelector('input')).toBeNull(); expect(host.textContent).not.toContain('Schritt 1');
  });
  it('shows actionable microphone failures without restoring a text-command field', async () => {
    api.speechPermission = false; await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen');
    expect(host.textContent).toContain('Mikrofon ist nicht freigegeben'); expect(api.speechStart).not.toHaveBeenCalled(); expect(host.querySelector('input')).toBeNull();
  });
  it('does not navigate if spoken confirmation fails', async () => {
    await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen');
    api.speak.mockImplementationOnce((_text: string, options: any) => queueMicrotask(() => options.onError?.()));
    await sayNative('Kalender öffnen');
    expect(api.push).not.toHaveBeenCalled(); expect(host.textContent).toContain('Sprachausgabe');
  });
  it('stops recognition and audio when the app leaves the foreground', async () => {
    await act(async () => root.render(<Neo />)); await click('Neo-Assistent öffnen');
    await act(async () => api.appState?.('background')); await sayNative('Kalender öffnen');
    expect(api.push).not.toHaveBeenCalled(); expect(api.speechAbort).toHaveBeenCalled();
  });
});
