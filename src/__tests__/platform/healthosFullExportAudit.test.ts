import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const script = resolve(root, 'scripts/audit-healthos-full-export.mjs');
const bundle = '_expo/static/js/android/index-fixture.hbc';
const { stringToUUID } = createRequire(import.meta.url)(
  '@expo/metro-config/build/serializer/debugId.js',
) as { stringToUUID: (name: string) => string };
const fixtureDirectories: string[] = [];
type Source = { path: string; content: string };
type Asset = { path: string; ext: string };

// Model the artifact format emitted by Expo, including Metro's selected native
// modules and its asset manifest. The tests change the produced artifacts,
// rather than checking the exporter/auditor source text.
function fixture() {
  const output = mkdtempSync(join(tmpdir(), 'healthos-full-export-'));
  fixtureDirectories.push(output);
  mkdirSync(join(output, 'assets'), { recursive: true });
  mkdirSync(join(output, '_expo/static/js/android'), { recursive: true });
  writeFileSync(join(output, bundle), 'Android Hermes fixture');
  const sources: Source[] = [];
  const add = (path: string, content?: string) => {
    sources.push({ path: `/project/${path}`, content: content ?? readFileSync(resolve(root, path), 'utf8') });
  };
  for (const path of [
    'app/_layout.tsx', 'app/index.tsx', 'app/auth/_layout.tsx', 'app/auth/index.tsx',
    'app/auth/business-login.tsx', 'app/auth/register.tsx', 'app/auth/register-business.tsx',
    'app/auth/employee-login.tsx', 'app/auth/employee-first-login.tsx', 'app/auth/client-login.tsx',
    'app/business/_layout.tsx', 'app/business/(tabs)/index.tsx', 'app/business/(tabs)/index.native.tsx',
    'app/office/_layout.tsx', 'app/office/index.tsx',
    'app/office/(tabs)/employees.tsx', 'app/office/(tabs)/clients.tsx',
    'app/portal/employee/_layout.tsx', 'app/portal/employee/(tabs)/index.tsx',
    'app/portal/employee/assignments/[id]/execute.tsx',
    'app/portal/client/_layout.tsx', 'app/portal/client/(tabs)/index.tsx',
    'app/portal/client/(tabs)/documents.tsx',
    'app/settings/tenant/notifications.tsx',
    'app/support/index.native.tsx',
    'app/business/connect/google-workspace.tsx',
    'src/ai/GlobalAiProvider.tsx',
    'src/liquid-command/screens/LiquidCommandEntryScreen.tsx',
    'src/liquid-command/screens/AccessHubScreen.tsx',
    'src/liquid-command/screens/AccessHubBaseScreen.tsx',
    'src/liquid-command/screens/AccessScreens.tsx',
    'src/liquid-command/components/CompanyRegistrationSelect.tsx',
    'src/liquid-command/screens/CommandCenterScreen.native.tsx',
    'src/screens/support/PublicSupportScreen.native.tsx',
    'src/screens/connect/GoogleWorkspaceScreen.native.tsx',
    'src/ai/robot/RobotNavigationAssistant.native.tsx',
    'src/screens/auth/BusinessPasswordRecovery.native.tsx',
    'src/components/images/CareSuiteImage.native.tsx',
    'src/screens/settings/TenantNotificationSettingsScreen.tsx',
    'src/lib/tenant/tenantNotificationSettingsService.ts',
    'src/lib/auth/businessAuthService.ts',
    'src/screens/BusinessDashboardScreen.tsx',
    'src/liquid-command/screens/ModuleWorkspaceScreen.tsx',
    'src/liquid-command/shell/LiquidModuleRouteLayout.tsx',
    'src/liquid-command/shell/LiquidPortalRouteLayout.tsx',
    'src/lib/auth/RequireAuth.tsx', 'src/lib/auth/RequireRole.tsx',
    'src/lib/auth/RequireEmployeePasswordSetup.tsx',
    'src/lib/navigation/routes.ts', 'src/lib/navigation/redirects.ts',
    'src/lib/auth/sessionTarget.ts', 'src/lib/auth/AuthProvider.tsx',
    'src/lib/auth/index.ts', 'src/lib/navigation/index.ts', 'src/screens/index.ts',
    'src/components/auth/PortalBiometricGate.tsx',
    'src/components/portal/PortalPushRegistrationGate.tsx',
    'src/lib/portal/portalPushNotifications.ts',
    'src/lib/portal/portalPushNavigation.ts',
    'src/lib/portal/resolvePortalPushDestination.ts',
    'src/components/brand/AppStartup.tsx', 'src/components/brand/AppStartIntro.native.tsx',
    'src/components/brand/appStartIntroAssets.ts',
    'src/design/CareSuiteFontProvider.native.tsx',
    'src/design/tokens/appFontFamily.ts', 'src/design/tokens/fontFamily.ts',
  ]) add(path);
  const intro = JSON.parse(readFileSync(resolve(root, 'assets/brand/intro/manifest.json'), 'utf8')) as {
    formats: { id: string; file: string }[];
  };
  const assets: Asset[] = intro.formats.map((format) => {
    const path = `assets/${format.id}`;
    copyFileSync(resolve(root, 'assets/brand/intro', format.file), join(output, path));
    return { path, ext: 'mp4' };
  });
  copyFileSync(resolve(root, 'public/fonts/CenturyGothic.ttf'), join(output, 'assets/century-font'));
  assets.push({ path: 'assets/century-font', ext: 'ttf' });
  const save = () => {
    writeFileSync(join(output, 'metadata.json'), JSON.stringify({
      version: 0, bundler: 'metro', fileMetadata: { android: { bundle, assets } },
    }));
    writeFileSync(join(output, `${bundle}.map`), JSON.stringify({
      version: 3, file: bundle, debugId: stringToUUID('index-fixture'), sources: sources.map((source) => source.path),
      sourcesContent: sources.map((source) => source.content), names: [], mappings: '',
    }));
  };
  save();
  const audit = (options: string[] = []) => spawnSync(process.execPath, [script, output, ...options], { cwd: root, encoding: 'utf8' });
  return { output, sources, assets, save, audit };
}

afterEach(() => {
  for (const directory of fixtureDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('full HealthOS Android artifact audit', () => {
  it('rejects an embedded browser even when it is hidden behind a native route', () => {
    const artifact = fixture();
    const screen = artifact.sources.find(source => source.path.endsWith('/CommandCenterScreen.native.tsx'))!;
    screen.content += '\nexport function Embedded() { return <WebView />; }';
    artifact.save(); const result = artifact.audit();
    expect(result.status).toBe(1); expect(result.stderr).toContain('WebView/iframe reachable');
  });
  it.each([
    "function Pdf() { return TestPlatform.OS === 'web' && html ? <iframe /> : <View />; }",
    "function Pdf() { return html && TestPlatform.OS === 'web' ? <iframe /> : <View />; }",
    "const showPdf = html && TestPlatform.OS === 'web'; function Pdf() { return showPdf ? <iframe /> : <View />; }",
    "function Pdf() { if (TestPlatform.OS === 'web') return <iframe />; return <View />; }",
  ])('accepts PDF browser markup proven unreachable on Android: %s', (code) => {
    const artifact = fixture();
    artifact.sources.find(source => source.path.endsWith('/CommandCenterScreen.native.tsx'))!.content +=
      `\nimport { Platform as TestPlatform } from 'react-native';\n${code}`;
    artifact.save(); const result = artifact.audit();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).nativeUiWithoutWebViews).toBe(true);
  });
  it.each([
    "function Pdf() { return showPdf ? <iframe /> : <View />; }",
    "function Pdf() { return TestPlatform.OS !== 'web' ? <iframe /> : <View />; }",
    "function Pdf(TestPlatform: { OS: string }) { return TestPlatform.OS === 'web' ? <iframe /> : <View />; }",
    "const showPdf = TestPlatform.OS === 'web'; function Pdf(showPdf: boolean) { return showPdf ? <iframe /> : <View />; }",
    "const showPdf = (html && false) === false; function Pdf() { return showPdf ? <iframe /> : <View />; }",
    "import { WebView as EmbeddedBrowser } from 'react-native-webview'; function Pdf() { return <EmbeddedBrowser />; }",
  ])('rejects browser markup under native or unproven conditions: %s', (code) => {
    const artifact = fixture();
    artifact.sources.find(source => source.path.endsWith('/CommandCenterScreen.native.tsx'))!.content +=
      `\nimport { Platform as TestPlatform } from 'react-native';\n${code}`;
    artifact.save(); const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('WebView/iframe reachable');
  });
  it('accepts the full native graph with intact offline media and reports sizes', () => {
    const artifact = fixture();
    const result = artifact.audit();
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({ status: 'ok', platform: 'android', routerRoot: 'app', portalSecurityGates: true });
    expect(report.introAssets).toHaveLength(6);
    expect(report.runtimeBytes).toBeGreaterThan(6_000_000);
    expect(report.largestAssets.length).toBeGreaterThan(0);
  });

  it('rejects a portal-only bundle even when a loose full-app source map is present', () => {
    const artifact = fixture();
    copyFileSync(join(artifact.output, `${bundle}.map`), join(artifact.output, 'full-app-decoy.map'));
    artifact.sources.splice(0, artifact.sources.length, { path: '/project/app-portal/_layout.tsx', content: 'export default PortalRoot;' });
    artifact.save();
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('portal-only implementation');
  });

  it('rejects the desktop access implementation selected in the Android graph', () => {
    const artifact = fixture();
    const screen = artifact.sources.find((source) => source.path.endsWith('/AccessScreens.tsx'))!;
    screen.path = screen.path.replace('.tsx', '.web.tsx');
    artifact.save();
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('required native implementation missing');
  });

  it('accepts inactive browser route candidates while reporting their presence', () => {
    const artifact = fixture();
    artifact.sources.push(
      { path: '/project/app/index.web.tsx', content: "export { WebHome } from '../src/WebHome.web';" },
      { path: '/project/src/WebHome.web.tsx', content: 'export function WebHome() { return <div>Browser only</div>; }' },
    );
    artifact.save();
    const result = artifact.audit();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).inactiveWebCandidates).toContain('src/WebHome.web.tsx');
  });

  it('rejects a browser implementation imported by a selected native route', () => {
    const artifact = fixture();
    artifact.sources.find((source) => source.path.endsWith('/app/index.tsx'))!.content = "export { WebHome as default } from '../src/WebHome.web';";
    artifact.sources.push({ path: '/project/src/WebHome.web.tsx', content: 'export function WebHome() { return <div>Wrong platform</div>; }' });
    artifact.save();
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('web or iOS implementation reachable from Android routes');
  });

  it('distinguishes bundled literal browser imports inside proven web-only branches', () => {
    const artifact = fixture();
    const entry = artifact.sources.find((source) => source.path.endsWith('/app/index.tsx'))!;
    entry.content = `import { Platform } from 'react-native';\n${entry.content}`;
    entry.content += `
      if (Platform.OS === 'web') { require('../src/WebHome.web'); }
      const guarded = Platform.OS === 'web' ? () => import('../src/WebHome.web') : null;
      async function webOnly() {
        if (Platform.OS !== 'web') return;
        await import('../src/WebHome.web');
      }
    `;
    artifact.sources.push({ path: '/project/src/WebHome.web.tsx', content: 'export function WebHome() { return <div>Browser only</div>; }' });
    artifact.save();
    const result = artifact.audit();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).inactiveWebCandidates).toContain('src/WebHome.web.tsx');
  });

  it('does not mistake a shadowed Platform variable for the Android platform guard', () => {
    const artifact = fixture();
    const entry = artifact.sources.find((source) => source.path.endsWith('/app/index.tsx'))!;
    entry.content = `import { Platform } from 'react-native';\n${entry.content}
      function customPlatform(Platform: { OS: string }) {
        if (Platform.OS === 'web') require('../src/WebHome.web');
      }
    `;
    artifact.sources.push({ path: '/project/src/WebHome.web.tsx', content: 'export function WebHome() { return <div>Browser</div>; }' });
    artifact.save();
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('implementation reachable from Android routes');
  });

  it.each([
    "if ((Platform.OS === 'android' && 'web') === 'web') require('../src/WebHome.web');",
    "if ('0' == false) require('../src/WebHome.web');",
    "throw new Error(); import '../src/WebHome.web';",
  ])('does not omit native imports through JavaScript expression semantics: %s', (code) => {
    const artifact = fixture();
    const entry = artifact.sources.find((source) => source.path.endsWith('/app/index.tsx'))!;
    entry.content = `import { Platform } from 'react-native';\n${entry.content}\n${code}`;
    artifact.sources.push({ path: '/project/src/WebHome.web.tsx', content: 'export function WebHome() { return <div>Wrong platform</div>; }' });
    artifact.save();
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('implementation reachable from Android routes');
  });

  it.each([
    "const x = <Foo>require('./WebHome.web');",
    "const load = <T>() => require('./WebHome.web');",
  ])('parses TypeScript module syntax without treating it as JSX: %s', (code) => {
    const artifact = fixture();
    artifact.sources.find((source) => source.path.endsWith('/app/index.tsx'))!.content += "\nimport '../src/parserProbe';";
    artifact.sources.push(
      { path: '/project/src/parserProbe.ts', content: code },
      { path: '/project/src/WebHome.web.tsx', content: 'export function WebHome() { return <div>Wrong platform</div>; }' },
    );
    artifact.save();
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('implementation reachable from Android routes');
  });

  it('uses the configured Expo TypeScript-first resolution order', () => {
    const artifact = fixture();
    artifact.sources.find((source) => source.path.endsWith('/app/index.tsx'))!.content += "\nimport '../src/helper';";
    artifact.sources.push(
      { path: '/project/src/helper.js', content: 'export const helper = true;' },
      { path: '/project/src/helper.ts', content: "import './WebHome.web';" },
      { path: '/project/src/WebHome.web.tsx', content: 'export function WebHome() { return <div>Wrong platform</div>; }' },
    );
    artifact.save();
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('implementation reachable from Android routes');
  });

  it('rejects local HealthOS artwork excluded from the reviewed EAS archive', () => {
    const artifact = fixture();
    artifact.sources.push({ path: '/project/src/liquid-command/screens/CommandCenterScreen.tsx', content: readFileSync(resolve(root, 'src/liquid-command/screens/CommandCenterScreen.tsx'), 'utf8') });
    artifact.save();
    const ignoreFile = join(artifact.output, 'excluded-healthos.easignore');
    writeFileSync(ignoreFile, `${readFileSync(resolve(root, '.easignore'), 'utf8')}\nassets/healthos/\n`);
    const result = artifact.audit(['--easignore', ignoreFile]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('required source or asset excluded from EAS archive: assets/healthos/');
  });

  it('uses configured Metro asset extensions to reject an excluded native loading GIF', () => {
    const artifact = fixture();
    artifact.sources.push({ path: '/project/src/components/brand/brandassets.ts', content: readFileSync(resolve(root, 'src/components/brand/brandassets.ts'), 'utf8') });
    artifact.save();
    const ignoreFile = join(artifact.output, 'excluded-loading.easignore');
    writeFileSync(ignoreFile, `${readFileSync(resolve(root, '.easignore'), 'utf8')}\nassets/images/caresuite-loading.gif\n`);
    const result = artifact.audit(['--easignore', ignoreFile]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('required source or asset excluded from EAS archive: assets/images/caresuite-loading.gif');
  });

  it('verifies fresh source-map text against the current checkout when requested', () => {
    const artifact = fixture();
    const result = artifact.audit(['--verify-current-sources']);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ currentSourceIdentity: true });
  });

  it('rejects stale bundled source text despite a complete full route graph', () => {
    const artifact = fixture();
    artifact.sources.find((source) => source.path.endsWith('/app/index.tsx'))!.content += '\n// older local source';
    artifact.save();
    const result = artifact.audit(['--verify-current-sources']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('bundled source differs from current project: app/index.tsx');
  });

  it('rejects metadata for the wrong platform', () => {
    const artifact = fixture();
    writeFileSync(join(artifact.output, 'metadata.json'), JSON.stringify({
      version: 0, bundler: 'metro', fileMetadata: { web: { bundle, assets: artifact.assets } },
    }));
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Android export metadata is missing');
  });

  it('rejects Android metadata pointing at a browser bundle path', () => {
    const artifact = fixture();
    writeFileSync(join(artifact.output, 'metadata.json'), JSON.stringify({
      version: 0, bundler: 'metro', fileMetadata: { android: { bundle: bundle.replace('/android/', '/web/'), assets: artifact.assets } },
    }));
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('metadata does not point to an Android runtime bundle');
  });

  it('rejects a full-app map renamed next to a different bundle', () => {
    const artifact = fixture();
    const metadata = JSON.parse(readFileSync(join(artifact.output, 'metadata.json'), 'utf8'));
    const otherBundle = bundle.replace('index-fixture', 'portal-fixture');
    copyFileSync(join(artifact.output, bundle), join(artifact.output, otherBundle));
    copyFileSync(join(artifact.output, `${bundle}.map`), join(artifact.output, `${otherBundle}.map`));
    metadata.fileMetadata.android.bundle = otherBundle;
    writeFileSync(join(artifact.output, 'metadata.json'), JSON.stringify(metadata));
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('source map identity does not match');
  });

  it.each(['app/auth/register.tsx', 'app/business/(tabs)/index.tsx', 'app/office/index.tsx', 'app/portal/client/(tabs)/index.tsx'])(
    'rejects the missing route branch %s', (route) => {
      const artifact = fixture();
      const base = route.replace(/\.tsx$/, '');
      for (let index = artifact.sources.length - 1; index >= 0; index--) {
        if ([`${base}.tsx`, `${base}.native.tsx`, `${base}.android.tsx`].some(path => artifact.sources[index].path.endsWith(`/${path}`))) artifact.sources.splice(index, 1);
      }
      artifact.save();
      const result = artifact.audit();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`required native implementation missing: ${base}`);
    },
  );

  it('rejects biometric and push sources that are bundled but not rendered by the root', () => {
    const artifact = fixture();
    const rootSource = artifact.sources.find((source) => source.path.endsWith('/app/_layout.tsx'))!;
    rootSource.content = rootSource.content.replace('<PortalBiometricGate>', '<>').replace('</PortalBiometricGate>', '</>');
    artifact.save();
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('does not render PortalBiometricGate');
  });

  it('rejects removal of the role boundary while its module is still bundled', () => {
    const artifact = fixture();
    artifact.sources.find((source) => source.path.endsWith('/LiquidModuleRouteLayout.tsx'))!.content = '<RequireAuth><LiquidProductAccessGuard><Stack /></LiquidProductAccessGuard></RequireAuth>';
    artifact.save();
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('boundary misses RequireRole');
  });

  it('rejects a modified packaged intro even if the approved source file is intact', () => {
    const artifact = fixture();
    const path = join(artifact.output, artifact.assets[0].path);
    const video = readFileSync(path);
    video[video.length - 1] ^= 1;
    writeFileSync(path, video);
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('approved offline intro is missing or changed');
  });

  it('rejects an intro asset excluded from the Android manifest despite a loose copy', () => {
    const artifact = fixture();
    artifact.assets.shift();
    artifact.save();
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('approved offline intro is missing or changed');
  });

  it('rejects a substituted native font', () => {
    const artifact = fixture();
    const path = join(artifact.output, 'assets/century-font');
    const font = readFileSync(path);
    font[font.length - 1] ^= 1;
    writeFileSync(path, font);
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('offline Century Gothic font is missing or changed');
  });

  it('rejects assets escaping the export directory', () => {
    const artifact = fixture();
    artifact.assets[0].path = '../outside.mp4';
    artifact.save();
    const result = artifact.audit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('artifact escapes export');
  });

  it('reports a larger full export without imposing the portal-only size limit', () => {
    const artifact = fixture();
    const additionalFile = join(artifact.output, 'additional-runtime-asset');
    writeFileSync(additionalFile, '');
    truncateSync(additionalFile, 55 * 1024 * 1024);
    const result = artifact.audit();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).runtimeSizeMb).toBeGreaterThan(50);
  });
});
