// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { APP_ROUTES } from '@/lib/navigation/routes';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('CareSuite access hub redesign', () => {
  const hub = [
    readSrc('src/liquid-command/screens/AccessHubBaseScreen.tsx'),
    readSrc('src/liquid-command/screens/AccessHubScreen.tsx'),
  ].join('\n');
  const accessScreens = readSrc('src/liquid-command/screens/AccessScreens.tsx');

  it('uses the current HealthOS wordmark and centered access copy', () => {
    expect(hub).toContain('IHR ZUGANG');
    expect(hub).toContain('Wo möchten Sie starten?');
    expect(hub).toContain('CareSuite<Text style={styles.logoAccent}> HealthOS</Text>');
    expect(hub).toContain('const compact = !stacked && layout.height <= 800');
    expect(hub).toContain("textAlign: 'center'");
  });

  it('keeps the exact access order and matching character assets', () => {
    const employee = hub.indexOf("id: 'employee'");
    const client = hub.indexOf("id: 'client'");
    const administration = hub.indexOf("id: 'administration'");

    expect(employee).toBeGreaterThan(-1);
    expect(client).toBeGreaterThan(employee);
    expect(administration).toBeGreaterThan(client);
    expect(hub).toContain("access-employee.png");
    expect(hub).toContain("access-client.png");
    expect(hub).toContain("access-administration.png");
  });

  it('stacks below 900px and keeps company registration below the access cards', () => {
    expect(hub).toContain('const stacked = layout.width < 900');
    expect(hub.indexOf('<RegistrationCard')).toBeGreaterThan(
      hub.indexOf('ACCESS_OPTIONS.map'),
    );
    expect(hub).toContain('Unternehmen kostenlos registrieren');
    expect(hub).toContain('Kostenlos starten');
  });

  it('gives every mobile access card its own intrinsic row instead of collapsing the stack', () => {
    expect(hub).toContain('!stacked && styles.accessCardFrameWide');
    expect(hub).toContain("flexBasis: 'auto'");
    expect(hub).toContain('flexShrink: 0');
    expect(hub).not.toContain('accessCardFrame: { flex: 1');
  });

  it('centers role labels and gives mobile characters their own space beside the actions', () => {
    expect(hub).toContain("accessTitleStacked: {");
    expect(hub).toContain("textAlign: 'center'");
    expect(hub).toContain("position: 'absolute'");
    expect(hub).toContain('width: 84');
    expect(hub).toContain("width: 'auto'");
    expect(hub).not.toContain('left: 22');
  });

  it('keeps the mobile access flow clear of device safe areas', () => {
    expect(hub).toContain('useSafeAreaInsets');
    expect(hub).toContain('paddingTop: Math.max(24, insets.top + 16)');
    expect(hub).toContain('paddingBottom: Math.max(32, insets.bottom + 24)');
  });

  it('keeps login forms usable with mobile safe areas and the open keyboard', () => {
    expect(accessScreens).toContain('KeyboardAvoidingView');
    expect(accessScreens).toContain("Platform.OS === 'ios' ? 'padding'");
    expect(accessScreens).toContain("Platform.OS === 'android' ? 'height'");
    expect(accessScreens).toContain('useSafeAreaInsets');
    expect(accessScreens).toContain('styles.accessScrollViewport');
    expect(accessScreens).toContain('keyboardShouldPersistTaps="handled"');
    expect(accessScreens).toContain('layout.isPhone && styles.accessScrollPhone');
    expect(accessScreens).toContain("width: '100%'");
  });

  it('adds restrained motion and respects reduced-motion accessibility', () => {
    expect(hub).toContain('AccessibilityInfo.isReduceMotionEnabled');
    expect(hub).toContain("AccessibilityInfo.addEventListener('reduceMotionChanged'");
    expect(hub).toContain('AnimatedBackdrop');
    expect(hub).toContain('buttonShimmer');
    expect(hub).toContain('onHoverIn');
  });

  it('removes the standalone relatives portal and its access management route', () => {
    expect(hub).not.toContain('Angehörigenportal');
    expect(existsSync(path.join(root, 'app/auth/family-login.tsx'))).toBe(false);
    expect(existsSync(path.join(root, 'app/portal/relative/index.tsx'))).toBe(false);
    expect(
      existsSync(path.join(root, 'app/business/office/access/relative-portal/index.tsx')),
    ).toBe(false);
    expect(
      existsSync(path.join(root, 'app/business/office/portals/relatives.tsx')),
    ).toBe(false);
    expect(APP_ROUTES.some((route) => route.path.startsWith('/portal/relative'))).toBe(false);
    expect(
      APP_ROUTES.some((route) => route.path === '/business/office/access/relative-portal'),
    ).toBe(false);
  });
});


// Render the actual native access surface. Layout is separately verified in the
// existing browser fixture; these checks exercise its public actions and state.
const accessState = { width: 390, height: 844, push: vi.fn(), openURL: vi.fn() };
const flat = (value: any): any => Array.isArray(value) ? Object.assign({}, ...value.map(flat)) : value ?? {};
const node = (tag: string, props: any) => React.createElement(tag, {
  'data-testid': props.testID,
  'data-style': JSON.stringify(flat(typeof props.style === 'function' ? props.style({ pressed: false }) : props.style)),
  role: props.accessibilityRole,
  'aria-label': props.accessibilityLabel,
  onClick: props.onPress,
}, props.children);
const Box = (props: any) => node('div', props);
const animation = () => ({ start() {}, stop() {} });
const nativeAccessDependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'),
  'react-native': {
    View: Box, ScrollView: Box, Text: (props: any) => node('span', props), Pressable: (props: any) => node('button', props),
    Platform: { OS: 'android' }, StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
    Linking: { openURL: (...args: any[]) => accessState.openURL(...args) },
    AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) },
    Animated: { View: Box, Value: class { setValue() {} interpolate(range: { outputRange: unknown[] }) { return range.outputRange[0]; } }, timing: animation, loop: animation, sequence: animation, delay: animation, add: () => 0 },
    Easing: { inOut: (value: unknown) => value, out: (value: unknown) => value, sin: 0, quad: 0, cubic: 0 },
  },
  '@/components/images/CareSuiteImage': { CareSuiteImage: (props: any) => React.createElement('img', { alt: props.accessibilityLabel, 'data-style': JSON.stringify(flat(props.style)) }) },
  'expo-linear-gradient': { LinearGradient: Box },
  'expo-router': { useRouter: () => ({ push: accessState.push }) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) },
  '@expo/vector-icons/Ionicons': { __esModule: true, default: () => null },
  '../foundation/tokens': { liquidColors: {}, liquidShadows: {} },
  '../foundation/useLiquidLayout': { useLiquidLayout: () => ({ width: accessState.width, height: accessState.height }) },
};
const nativeHubCode = buildSync({ entryPoints: ['src/liquid-command/screens/AccessHubBaseScreen.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(nativeAccessDependencies) }).outputFiles[0].text;
const nativeHubModule = { exports: {} as any };
new Function('require', 'module', 'exports', nativeHubCode)((id: string) => {
  if (!(id in nativeAccessDependencies)) throw new Error('Unexpected access dependency: ' + id);
  return nativeAccessDependencies[id];
}, nativeHubModule, nativeHubModule.exports);
const NativeAccessHub = nativeHubModule.exports.AccessHubBaseScreen;
const accessOptions = [
  { id: 'employee', title: 'Mitarbeiter', route: '/auth/employee-login', image: 1, imageAccessibilityLabel: 'Mitarbeiterbild' },
  { id: 'client', title: 'Klient', route: '/auth/client-login', image: 2, imageAccessibilityLabel: 'Klientenbild' },
  { id: 'administration', title: 'Verwaltung', route: '/auth/business-login', image: 3, imageAccessibilityLabel: 'Verwaltungsbild' },
];
let accessHost: HTMLDivElement, accessRoot: Root;
const pressAccess = async (label: string) => {
  const button = [...accessHost.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label || item.textContent === label);
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
};
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  accessState.width = 390; accessState.height = 844; vi.clearAllMocks(); accessState.openURL.mockResolvedValue(undefined);
  accessHost = document.createElement('div'); document.body.append(accessHost); accessRoot = createRoot(accessHost);
});
afterEach(async () => { await act(async () => accessRoot.unmount()); accessHost.remove(); });
const renderAccess = async () => { await act(async () => accessRoot.render(React.createElement(NativeAccessHub, { options: accessOptions, showRegistration: true }))); };

describe('native access hub actual interactions', () => {
  it('opens the three login paths, free registration and the existing TV route', async () => {
    await renderAccess();
    expect(accessHost.textContent).toContain('CareSuite HealthOS');
    expect(accessHost.textContent).toContain('Unternehmen kostenlos registrieren');
    for (const item of accessOptions) { await pressAccess(item.title + ' anmelden'); expect(accessState.push).toHaveBeenLastCalledWith(item.route); }
    await pressAccess('Unternehmen kostenlos registrieren'); expect(accessState.push).toHaveBeenLastCalledWith('/auth/register');
    await pressAccess('TV-Ansicht · mit dem Handy anmelden'); expect(accessState.push).toHaveBeenLastCalledWith('/device/tv');
  });
  it('uses the current compact tablet cards while keeping the phone artwork in its own column', async () => {
    await renderAccess();
    const card = accessHost.querySelector('[aria-label="Mitarbeiter anmelden"]')!;
    expect(JSON.parse(card.getAttribute('data-style')!)).toMatchObject({ flexDirection: 'row', minHeight: 156 });
    accessState.width = 1280; accessState.height = 800; await renderAccess();
    expect(JSON.parse(accessHost.querySelector('[aria-label="Mitarbeiter anmelden"]')!.getAttribute('data-style')!)).toMatchObject({ minHeight: 260, padding: 14 });
  });
  it('opens public information in the system browser and reports an unavailable browser', async () => {
    await renderAccess(); await pressAccess('Datenschutz');
    expect(accessState.openURL).toHaveBeenLastCalledWith('https://www.caresuiteplus.app/datenschutz');
    expect(accessState.push).not.toHaveBeenCalled();
    accessState.openURL.mockRejectedValueOnce(new Error('no browser')); await pressAccess('Kontakt & Impressum');
    expect(accessHost.querySelector('[role="alert"]')?.textContent).toContain('Bitte erneut versuchen');
  });
});
