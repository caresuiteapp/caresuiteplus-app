// Builds a local synthetic fixture from real Web screens. No server or deployment.
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'scripts/fixtures');
const data = path.join(fixture, 'company-preview-data.ts');
const quote = JSON.stringify;
const ui = name => quote(path.join(root, 'src/components', name));
const virtual = {
 avatar: `import React from 'react'; import {PremiumAvatar} from ${ui('ui/PremiumAvatar')}; export const TopbarProfileAvatar=props=>React.createElement(PremiumAvatar,props);`,
 serverStorage: `export class AsyncLocalStorage { constructor() { throw new Error('Server-only font context is unavailable in this browser fixture.'); } }`,
 router: `export * from ${quote(path.join(fixture, 'company-preview-router.tsx'))};`,
 storage: `export {storage as default} from ${quote(data)};`,
 safe: `import React from 'react'; export const useSafeAreaInsets=()=>({top:0,right:0,bottom:0,left:0}); export const SafeAreaProvider=({children})=>children; export const SafeAreaView=({children})=>React.createElement('div',null,children);`,
 hub: `export const AccessHubScreen=()=>null;`,
 feedback: `export const useWorkflowFeedback=()=>new Proxy({}, {get:()=>()=>{}});`,
 platformUi: `export {PlatformShellLayout,PLATFORM_COLORS} from ${ui('platformConsole/PlatformShellLayout.web')};` + ['PlatformAuditLink','PlatformConfirmModal','PlatformDataTable','PlatformFormField','PlatformTenantEnvironmentBadge'].map(n=>`export {${n}} from ${ui('platformConsole/'+n)};`).join('') + `export {PlatformFilterChip,PlatformFilterChipRow} from ${ui('platformConsole/PlatformFilterChip')}; export {PlatformStatusBadge,statusLabel} from ${ui('platformConsole/PlatformOperatorUi')};`,
 ui: `export {LoadingState,EmptyState,ErrorState,SuccessState} from ${ui('ui/StateViews')}; export {PremiumButton} from ${ui('ui/PremiumButton')};`,
 tabs: `import React from 'react'; import {Text,View} from 'react-native'; const Note=()=>React.createElement(View,{style:{padding:24}},React.createElement(Text,{style:{color:'#102f50'}},'Dieser weitere Verwaltungsbereich ist in der lokalen Vorschau nicht enthalten.'));` + ['Audit','BillingPreview','Credits','Diagnosis','Discounts','Entitlements','FeatureFlags','Invoices','Limits','Payments','Subscription','Support','Users'].map(n=>`export const Tenant${n}Tab=Note;`).join(''),
 animated: `import React from 'react'; import {Animated} from 'react-native'; export default Animated; export const useSharedValue=value=>React.useRef({value}).current; export const useAnimatedStyle=fn=>fn(); export const withSpring=value=>value; export const withTiming=value=>value; export const withRepeat=value=>value; export const withSequence=(...values)=>values[values.length-1]; export const cancelAnimation=()=>{}; export const Easing={linear:x=>x,ease:x=>x,inOut:fn=>fn}; export const interpolate=(value,input,output)=>output[0]; export const runOnJS=fn=>fn;`,
};
function resolveSource(base) {
 for (const suffix of ['', '.web.tsx','.web.ts','.tsx','.ts','.web.jsx','.web.js','.jsx','.js','.json','/index.web.tsx','/index.web.ts','/index.tsx','/index.ts','/index.js']) {
  const file = base + suffix;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
 }
}
(async () => {
 const target = path.join(process.env.TEMP || '/tmp', 'caresuite-company-preview'); fs.mkdirSync(target, { recursive: true });
 const result = await esbuild.build({ absWorkingDir: root, entryPoints: ['scripts/fixtures/company-preview.tsx'], outfile: path.join(target, 'company.js'), bundle: true, minify: true, metafile: true, platform: 'browser', assetNames: 'assets/[name]-[hash]', publicPath: './', jsx: 'automatic', mainFields: ['browser','module','main'], resolveExtensions: ['.web.tsx','.web.ts','.tsx','.ts','.web.jsx','.web.js','.jsx','.js','.json'], loader: { '.js':'jsx', '.png':'file','.jpg':'file','.mp4':'file','.ttf':'dataurl','.svg':'dataurl' }, define: { 'process.env':'{}', 'process.browser':'true', 'global':'globalThis', 'process.env.NODE_ENV':'"production"', __DEV__:'false' }, plugins: [{ name: 'synthetic-company-review', setup(build) {
  build.onResolve({ filter: /.*/ }, args => {
   const spec = args.path;
   let name;
   if (spec === 'node:async_hooks') name = 'serverStorage';
   else if (spec === '@/components/layout/TopbarProfileAvatar') name = 'avatar';
   else if (spec === 'expo-router') name = 'router';
   else if (spec === '@react-native-async-storage/async-storage') name = 'storage';
   else if (spec === 'react-native-safe-area-context') name = 'safe';
   else if (spec === '@/components/platformConsole') name = 'platformUi';
   else if (spec === '@/components/ui') name = 'ui';
   else if (/(^|\/)PlatformTenantOperatorTabs$/.test(spec)) name = 'tabs';
   else if (/(^|\/)AccessHubScreen$/.test(spec)) name = 'hub';
   else if (/(^|\/)GlobalWorkflowFeedback$/.test(spec)) name = 'feedback';
   else if (spec === 'react-native-reanimated') name = 'animated';
   if (name) return { path: name, namespace: 'company-qa' };
   if (spec === 'react-native') return { path: require.resolve('react-native-web') };
   if (spec === '@/lib/platformConsole' || spec === '@/lib/platformConsole/PlatformAuthProvider' || spec === '@/lib/platformConsole/platformCompanyDirectoryService' || (spec.startsWith('@/lib/auth') && spec !== '@/lib/auth/businessRegistrationPolicy' && spec !== '@/lib/auth/auth.types') || spec === '@/lib/supabase/authService') return { path: data };
   if (spec === '@/lib/support/supportService') return { path: path.join(fixture, 'company-preview-support.ts') };
   if (spec.startsWith('@supabase/') || /(^|\/)supabase\/client$/.test(spec)) throw new Error('Live API dependency is not allowed in this fixture: '+spec);
   const base = spec.startsWith('@/') ? path.join(root, 'src', spec.slice(2)) : spec.startsWith('.') ? path.resolve(args.resolveDir, spec) : path.isAbsolute(spec) ? spec : null;
   if (base) { const resolved = resolveSource(base); if (resolved) return { path: resolved }; }
  });
  build.onLoad({ filter: /.*/, namespace: 'company-qa' }, args => ({ contents: virtual[args.path], loader: 'tsx', resolveDir: root }));
 } }] });
 // Browser connections are disabled independently of the synthetic service aliases.
 const csp = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data: blob:; font-src data:; connect-src 'none'; media-src 'self' data: blob:;";
 fs.writeFileSync(path.join(target, 'index.html'), '<!doctype html><html lang="de"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><title>CareSuite – Web-Prüfung R4</title><div id="qa"><strong>Web-Prüfung R4 · ausschließlich fiktive Daten</strong><a href="#/desktop">Desktop</a><a href="#/auth/register">Registrierung</a><a href="#/platform/tenants">Unternehmen</a><a href="?platform=1#/platform/support">Support-Zentrale</a><br>Änderungen gelten nur in dieser Vorschau und werden beim Neuladen zurückgesetzt.</div><div id="preview"></div><script src="company.js"></script></html>');
 fs.writeFileSync(path.join(target, 'build-inputs.json'), JSON.stringify(Object.keys(result.metafile.inputs), null, 2));
 console.log(JSON.stringify({ ok: true, bytes: fs.statSync(path.join(target, 'company.js')).size, directory: target }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
