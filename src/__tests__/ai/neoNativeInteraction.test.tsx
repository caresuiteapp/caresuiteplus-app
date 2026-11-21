// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const events = new Map<string, (value?: any) => void>();
const api = {
  permission: vi.fn(), locales: vi.fn(), start: vi.fn(), abort: vi.fn(), stop: vi.fn(), speak: vi.fn(),
  options: null as any,
};
const Box = (props: any) => <div>{props.children}</div>;
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'),
  'react-native': {
    View: Box, Text: Box,
    Pressable: (props: any) => <button aria-label={props.accessibilityLabel} onClick={props.onPress}>{props.children}</button>,
    Platform: { OS: 'android', Version: 35 }, StyleSheet: { create: (styles: any) => styles },
    PanResponder: { create: () => ({ panHandlers: {} }) }, useWindowDimensions: () => ({ width: 390, height: 844 }),
    AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  },
  '@/components/images/CareSuiteImage': { CareSuiteImage: () => null },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) },
  'expo-router': { usePathname: () => '/Desktop' },
  '@/hooks/useFlowRouter': { useFlowRouter: () => ({ push: vi.fn(), back: vi.fn(), canGoBack: () => false }) },
  'expo-audio': { createAudioPlayer: vi.fn() },
  'expo-speech': { stop: () => api.stop(), speak: (text: string, options: any) => { api.options = options; api.speak(text, options); } },
  'expo-speech-recognition': {
    useSpeechRecognitionEvent: (event: string, callback: (value?: any) => void) => events.set(event, callback),
    ExpoSpeechRecognitionModule: { isRecognitionAvailable: () => true, supportsOnDeviceRecognition: () => true, requestPermissionsAsync: () => api.permission(), getSupportedLocales: () => api.locales(), start: (options: any) => api.start(options), abort: () => api.abort() },
  },
  '@/lib/auth/context': { useAuth: () => ({ authReady: true, isAuthenticated: true, profile: { roleKey: 'admin' }, user: { id: 'test-user' } }) },
  '@/hooks/usePermissions': { usePermissions: () => ({ can: () => true, hasModuleGate: () => true }) },
  '@/hooks/useTenantId': { useServiceTenantId: () => 'test-tenant' },
  '@/hooks/useDesktopWeather.native': { useDesktopWeather: () => ({ data: null, refresh: vi.fn() }) },
  '@/lib/office/clientListService': { fetchClientList: vi.fn() },
  '@/components/brand/brandassets': { CARESUITE_ROBOT_LOGO: 1 },
  '@/components/brand/appStartIntroSession': { useAppStartIntroReady: () => true },
  '@/liquid-command/navigation/nativeAdministrationModel': { nativeAdministrationRoute: (route: string) => route },
  '@/design/tokens/appFontFamily': { careSuiteAppFontFamily: 'system' },
  './neoAudio.native': { NATIVE_NEO_AUDIO: {} },
};
const compiled = buildSync({ entryPoints: ['src/ai/robot/RobotNavigationAssistant.native.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(dependencies) }).outputFiles[0].text;
const loaded = { exports: {} as any };
new Function('require', 'module', 'exports', compiled)((id: string) => { if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`); return dependencies[id]; }, loaded, loaded.exports);
const Neo = loaded.exports.RobotNavigationAssistant;
let root: Root, host: HTMLDivElement;
const click = async () => act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Neo-Assistent öffnen"]')!.click());
const finishSpeech = async () => act(async () => api.options.onDone());
const answer = async (text: string) => act(async () => events.get('result')!({ isFinal: true, results: [{ transcript: text }] }));

beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  events.clear(); vi.clearAllMocks(); api.options = null;
  api.stop.mockReset().mockResolvedValue(undefined); api.permission.mockResolvedValue({ granted: true }); api.locales.mockResolvedValue({ installedLocales: ['de-DE'] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<Neo />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Native Neo speech turns', () => {
  it('prepares microphone access once per session and reuses the installed locale for follow-up answers', async () => {
    await click(); expect(api.start).not.toHaveBeenCalled();
    await finishSpeech(); expect(api.start).toHaveBeenCalledOnce();
    await answer('Wie spät ist es?'); await finishSpeech();
    expect(api.start).toHaveBeenCalledTimes(2);
    expect(api.permission).toHaveBeenCalledOnce(); expect(api.locales).toHaveBeenCalledOnce();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Neo-Gespräch beenden"]')!.click());
    await click(); expect(api.permission).toHaveBeenCalledTimes(2);
  });
  it('waits for the old device speech to stop and drops the pending utterance if the user stops Neo', async () => {
    await click(); await finishSpeech(); api.speak.mockClear();
    let release!: () => void;
    api.stop.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    await answer('Wie spät ist es?'); expect(api.speak).not.toHaveBeenCalled();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Neo-Gespräch beenden"]')!.click());
    await act(async () => release());
    expect(api.speak).not.toHaveBeenCalled(); expect(api.start).toHaveBeenCalledOnce();
  });
});
