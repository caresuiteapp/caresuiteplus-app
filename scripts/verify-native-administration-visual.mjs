import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import {nativePortalAuditDeviceBindings} from './native-portal-audit-device-bindings.mjs';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join } from 'node:path';
const require=createRequire(import.meta.url);
const root=process.cwd(),output=resolve(process.env.CARESUITE_NATIVE_QA_DIR??'/tmp/caresuite-native-qa');mkdirSync(output,{recursive:true});
const fixture=resolve('scripts/fixtures/native-administration-preview.jsx');
const nativeWeb=require.resolve('react-native-web');
const portalFixture=resolve('scripts/fixtures/native-portals-data.jsx');
const employeePortalFixture=resolve('scripts/fixtures/native-employee-portals-preview.jsx');
const mockFixture=resolve('scripts/fixtures/administration-preview-mocks.jsx');
const platformFixture=resolve('scripts/fixtures/platform-console-preview-data.jsx');
const mocks=new Set(['expo-router','react-native-safe-area-context','expo-linear-gradient','@/components/images/CareSuiteImage','@/lib/auth','@/hooks/usePermissions','@/hooks/useModuleAccess','@/hooks/useDesktopWeather.native','@/hooks/useDesktopWeather.web','@/design/web/WebFontScaleProvider','./DesktopWeatherLocationDialog.native','./DesktopWeatherLocationDialog.web','@/components/googleWorkspace/GoogleWorkspaceWidget.native','@/components/googleWorkspace/GoogleWorkspaceWidget.web','@/hooks/useClientList','@/hooks/useEmployeeList','@/lib/inventory/companyInventoryService','@/hooks/core/useAsyncQuery','expo-crypto','@/lib/office/notes/service.shared','@/components/layout/ScreenShell','@/lib/auth/context','@/hooks/useClientPortalSettings']);
for(const renderer of ['native','web']){
await build({entryPoints:[renderer==='native'?fixture:resolve('scripts/fixtures/web-desktop-preview.jsx')],outfile:join(output,renderer+'-preview.js'),bundle:true,assetNames:'assets/[name]-[hash]',platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.EXPO_OS':'"web"','process.env':'{}','__DEV__':'false'},loader:{'.png':'file','.jpg':'file','.jpeg':'file','.ttf':'dataurl','.gif':'file','.mp4':'dataurl','.svg':'dataurl','.js':'jsx'},plugins:[{name:'isolated-native-preview',setup(b){
 b.onResolve({filter:/^@\/lib\/(auth\/accountSecurityService|platform\/devicePermissions|security\/protectedDataStorage)$/},args=>({path:args.path,namespace:'account-security-fixture'}));
 b.onLoad({filter:/.*/,namespace:'account-security-fixture'},args=>({loader:'js',resolveDir:root,contents:nativePortalAuditDeviceBindings[args.path]}));
 const platformTargets=new Set(['src/lib/platformConsole','src/lib/platformConsole/index','src/lib/platformConsole/PlatformAuthProvider','src/lib/platformConsole/platformAuthService','src/lib/platformConsole/platformTenantService','src/lib/platformConsole/platformSupabaseClient','src/lib/platformConsole/consoleWorkspaceService','src/lib/platformConsole/tenantDossierService.native','src/lib/platformConsole/tenantDossierService.shared','src/lib/platformConsole/tenantDossierService.web','src/lib/platformConsole/platformOperationsService.native','src/lib/platformConsole/platformOperationsService.web','src/lib/platformConsole/platformRuntime.native','src/lib/platformConsole/platformRuntime.web','src/lib/platformConsole/platformCompanyDirectoryService','src/lib/platformConsole/platformSession']);
 b.onResolve({filter:/.*/},args=>{if(!args.path.startsWith('@/')&&!args.path.startsWith('.'))return;const target=args.path.startsWith('@/')?resolve('src',args.path.slice(2)):resolve(args.resolveDir,args.path),normalized=target.replace(root+'/','').replace(/\.tsx?$/,'');if(args.importer===platformFixture&&['src/lib/platformConsole/consoleWorkspaceService','src/lib/platformConsole/platformOperationsService.web'].includes(normalized))return;return platformTargets.has(normalized)?{path:platformFixture}:undefined;});
 const aliasTargets=new Set(['src/lib/platform/nativeWorkflowEnvironment.native','src/lib/platform/nativeFileDelivery.native','src/lib/platform/nativePdfInspection.native','src/lib/inventory/companyInventoryService','src/lib/inventory/companyInventoryService.native','src/lib/inventory/companyInventoryService.web','src/lib/office/notes/service.shared','src/lib/office/notes/service.native','src/lib/office/notes/service.web','src/hooks/useTenantId','src/hooks/useGoogleWorkspace.native','src/hooks/useGoogleWorkspace.web','src/lib/googleWorkspace/googleWorkspaceService','src/lib/supabase/edgeFunctions']);
 b.onResolve({filter:/.*/},args=>{if(['expo-router/react-navigation','expo-file-system','expo-print','expo-sharing','expo-video'].includes(args.path))return {path:mockFixture};if(args.path.startsWith('@/')||args.path.startsWith('.')){const path=args.path.startsWith('@/')?resolve('src',args.path.slice(2)):resolve(args.resolveDir,args.path);const normalized=path.replace(root+'/','').replace(/\.tsx?$/,'');if(aliasTargets.has(normalized))return {path:mockFixture};}});
 b.onResolve({filter:/.*/},args=>mocks.has(args.path)?{path:mockFixture}:undefined);
 b.onLoad({filter:/\.(png|jpe?g|gif)$/},args=>{
  const bytes=readFileSync(args.path);const name=createHash('sha256').update(bytes).digest('hex').slice(0,16)+args.path.slice(args.path.lastIndexOf('.'));mkdirSync(join(output,'assets'),{recursive:true});copyFileSync(args.path,join(output,'assets',name));return{loader:'js',contents:`module.exports={uri:${JSON.stringify('/assets/'+name)}};`};
 });
 b.onResolve({filter:/^(@\/|\.\.?\/)/},args=>{
  if(args.importer.includes('/node_modules/')||/\.[a-z]+$/i.test(args.path))return;
  const base=args.path.startsWith('@/product-workflows/')?resolve('src',args.path.slice('@/product-workflows/'.length)):args.path.startsWith('@/')?resolve('src',args.path.slice(2)):resolve(args.resolveDir,args.path);
  for(const ext of (renderer==='native'?['.android.tsx','.native.tsx','.android.ts','.native.ts']:['.web.tsx','.web.ts']))if(existsSync(base+ext))return{path:base+ext};
 });
 b.onResolve({filter:/^@\/components\/(ui|healthos)$/},()=>({path:resolve('scripts/fixtures/native-portal-ui-exports.jsx')}));
 b.onResolve({filter:/^(@\/lib\/portal$|@\/hooks\/usePortalActor$|@\/hooks\/useportalofficemessages$|@\/components\/portal\/ClientSignatureAttentionProvider$|@\/design\/ThemeModeProvider$|expo-linking$|@\/lib\/auth\/passwordResetService.native$|@\/lib\/supabase\/authService$|@\/lib\/auth\/businessAuthService$|@\/lib\/auth\/employeePortalAuthService$|@\/lib\/auth\/clientPortalAuthService$|@\/lib\/auth\/portalLoginFlow$)/},()=>({path:portalFixture}));
 b.onResolve({filter:/^@\/hooks\/useEmployeePortalCalendarEvents$/},()=>({path:portalFixture}));
 b.onResolve({filter:/^@\/hooks\/useEmployeePortal(?:Dashboard|ClientRecords)$/},()=>({path:employeePortalFixture}));
 b.onResolve({filter:/^react-native-keyboard-controller$/},()=>({path:'keyboard',namespace:'preview-keyboard'}));
 b.onLoad({filter:/.*/,namespace:'preview-keyboard'},()=>({loader:'jsx',resolveDir:root,contents:`import React from 'react';import {View,ScrollView,KeyboardAvoidingView as Avoid} from ${JSON.stringify(nativeWeb)};export const KeyboardProvider=({children})=><View style={{flex:1}}>{children}</View>;export const KeyboardAwareScrollView=ScrollView,KeyboardAvoidingView=Avoid;`}));
 b.onResolve({filter:/^react-native-reanimated$/},()=>({path:'animated',namespace:'qa'}));
 b.onResolve({filter:/^expo-blur$/},()=>({path:'blur',namespace:'qa'}));
 b.onResolve({filter:/^\.\/elements$/},args=>args.importer.includes('/react-native-svg/lib/module/')?{path:resolve('node_modules/react-native-svg/lib/module/elements.web.js')}:undefined);
 b.onResolve({filter:/^react-native-svg$/},()=>({path:resolve('node_modules/react-native-svg/lib/module/ReactNativeSVG.web.js')}));
 b.onResolve({filter:/^react-native$/},()=>({path:'native-shim',namespace:'qa'}));
 b.onResolve({filter:/^@expo\/vector-icons$/},()=>({path:'icons',namespace:'preview-icon-root'}));
 b.onLoad({filter:/.*/,namespace:'preview-icon-root'},()=>({loader:'js',resolveDir:root,contents:"export {default as Feather} from '@expo/vector-icons/Feather';export {default as Ionicons} from '@expo/vector-icons/Ionicons';"}));
 // Layout fixtures do not play intro videos; the signed AAB verifies the original video bytes separately.
 b.onResolve({filter:/\.mp4$/},args=>({path:args.path,namespace:'preview-video'}));
 b.onLoad({filter:/.*/,namespace:'preview-video'},()=>({loader:'js',contents:"export default '/layout-preview-video.mp4';"}));
 b.onResolve({filter:/^expo-document-picker$/},()=>({path:'document-picker',namespace:'preview-picker'}));
 b.onResolve({filter:/^expo-image-picker$/},()=>({path:'image-picker',namespace:'preview-picker'}));
 b.onLoad({filter:/.*/,namespace:'preview-picker'},()=>({loader:'js',contents:"export const getDocumentAsync=async()=>({canceled:true,assets:null}),launchImageLibraryAsync=async()=>({canceled:true,assets:null}),requestMediaLibraryPermissionsAsync=async()=>({granted:false,status:'denied'});export const MediaTypeOptions={Images:'Images'};"}));
 b.onResolve({filter:/^expo-task-manager$/},()=>({path:'tasks',namespace:'preview-device-services'}));
 b.onResolve({filter:/^expo-location$/},()=>({path:'location',namespace:'preview-device-services'}));
 b.onLoad({filter:/.*/,namespace:'preview-device-services'},args=>({loader:'js',contents:args.path==='tasks'?"export const isTaskDefined=()=>false,defineTask=()=>{},isTaskRegisteredAsync=async()=>false;":"export const Accuracy={High:4},ActivityType={AutomotiveNavigation:1},getForegroundPermissionsAsync=async()=>({status:'denied'}),requestForegroundPermissionsAsync=getForegroundPermissionsAsync,getBackgroundPermissionsAsync=getForegroundPermissionsAsync,requestBackgroundPermissionsAsync=getForegroundPermissionsAsync,hasStartedLocationUpdatesAsync=async()=>false,startLocationUpdatesAsync=async()=>{},stopLocationUpdatesAsync=async()=>{},getCurrentPositionAsync=async()=>{throw Error('Layout fixtures have no device location.');};"}));
 b.onResolve({filter:/^@expo\/vector-icons\/(Feather|Ionicons)$/},args=>({path:args.path.endsWith('Ionicons')?'ionicons':'icon',namespace:'qa'}));
 b.onResolve({filter:/^@react-native-async-storage\/async-storage$/},()=>({path:'storage',namespace:'qa'}));
 // Android focus and accessibility calls stay in product code; the isolated
 // browser fixture has DOM refs and no native node handles or screen reader.
 b.onLoad({filter:/.*/,namespace:'qa'},args=>({loader:'jsx',resolveDir:root,contents:args.path==='storage'?`const data=new Map([['caresuite.liquid.registration.v1',JSON.stringify({companyName:'Pflege & Alltag Nord GmbH',legalForm:'GmbH',industry:'Alltagsbegleitung',street:'Gartenstraße 24',zip:'30159',city:'Hannover',phone:'0511 000000',email:'kontakt@example.invalid',adminFirstName:'Marlene',adminLastName:'Mustermann-Beispiel',adminEmail:'verwaltung@example.invalid',contactRole:'Geschäftsführung'})]]); export default {getItem:async k=>data.get(k)??null,removeItem:async k=>{data.delete(k)},setItem:async(k,v)=>{data.set(k,v)},multiGet:async keys=>keys.map(k=>[k,data.get(k)??null]),multiSet:async rows=>rows.forEach(([k,v])=>data.set(k,v))};`:args.path==='animated'?`import {useRef} from 'react';import * as RN from ${JSON.stringify(nativeWeb)};export default {View:RN.View,Text:RN.Text,createAnimatedComponent:c=>c};export const useSharedValue=v=>useRef({value:v}).current,useAnimatedStyle=f=>f(),withSpring=v=>v,withTiming=v=>v,withRepeat=v=>v,withSequence=(v)=>v,withDelay=(_delay,v)=>v,runOnJS=f=>f,cancelAnimation=()=>{},Easing=RN.Easing;`:args.path==='blur'?`import {View} from ${JSON.stringify(nativeWeb)};export const BlurView=View;`:['icon','ionicons'].includes(args.path)?`import {Text} from ${JSON.stringify(nativeWeb)};import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/${args.path==='ionicons'?'Ionicons':'Feather'}.json';export default function Icon({name,size,color}){return <Text aria-hidden style={{fontFamily:'${args.path==='ionicons'?'Ionicons':'Feather'}',fontSize:size,color}}>{String.fromCodePoint(glyphs[name]??63)}</Text>}`:`import React from 'react';import * as RN from ${JSON.stringify(nativeWeb)};export * from ${JSON.stringify(nativeWeb)};export const findNodeHandle=()=>null;export const AccessibilityInfo={...RN.AccessibilityInfo,setAccessibilityFocus:()=>{}};function nativeStyle(style){const flat=RN.StyleSheet.flatten(style)??{};const {experimental_backgroundImage,...rest}=flat;return [rest,experimental_backgroundImage?{backgroundImage:experimental_backgroundImage}:null];}export const Pressable=React.forwardRef(({style,...props},ref)=><RN.Pressable {...props} ref={ref} style={typeof style==='function'?state=>nativeStyle(style(state)):nativeStyle(style)}/>);const NativeView=RN.View;export const View=React.forwardRef(({style,...props},ref)=>{const s=RN.StyleSheet.flatten(style)??{};const {experimental_backgroundImage,...rest}=s;return <NativeView {...props} ref={ref} style={[rest,experimental_backgroundImage?{backgroundImage:experimental_backgroundImage}:null]}/>;});export const Platform={...RN.Platform,OS:new URLSearchParams(location.search).get('screen')?.startsWith('web-')?'web':'android'};const scale=Number(new URLSearchParams(location.search).get('scale')??1);export const useWindowDimensions=()=>({...RN.useWindowDimensions(),fontScale:scale});export const Text=({style,allowFontScaling,...props})=>{const s=RN.StyleSheet.flatten(style)??{};return <RN.Text {...props} style={[s,allowFontScaling===false?{}:{fontSize:(s.fontSize??14)*scale,lineHeight:(s.lineHeight??(s.fontSize??14)*1.4)*scale}]}/>};` }));
}}]});
}
copyFileSync('public/fonts/CenturyGothic.ttf',join(output,'CenturyGothic.ttf'));
const fontCss=readFileSync('src/design/web/centuryGothicCss.ts','utf8').match(/export const CENTURY_GOTHIC_CSS = `([\s\S]*?)`;/)[1].replace('${CARESUITE_WEB_FONT_FAMILY}','CareSuite Century Gothic').replace('${CARESUITE_FONT_URL}','/CenturyGothic.ttf').replace('${CARESUITE_FONT_STACK}',"'CareSuite Century Gothic',sans-serif");
copyFileSync(require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),join(output,'Feather.ttf'));
copyFileSync(require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),join(output,'Ionicons.ttf'));
writeFileSync(join(output,'index.html'),`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fontCss}@font-face{font-family:CenturyGothic;src:url(/CenturyGothic.ttf)}@font-face{font-family:Feather;src:url(/Feather.ttf)}@font-face{font-family:Ionicons;src:url(/Ionicons.ttf)}html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:CenturyGothic,sans-serif}#root{display:flex;flex-direction:column}</style><div id="root"></div><script>const entry=document.createElement("script");entry.src=new URLSearchParams(location.search).get("screen")?.startsWith("web-")?"/web-preview.js":"/native-preview.js";document.body.appendChild(entry);</script></html>`);
if(process.argv.includes('--prepare-only')){console.log(`Native preview compiled: ${output}`);process.exit(0);}
const server=createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;const path=join(output,name==='/'?'index.html':name.slice(1));if(!path.startsWith(output)||!existsSync(path)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.ttf')?'font/ttf':/\.png$/.test(path)?'image/png':/\.jpe?g$/.test(path)?'image/jpeg':/\.gif$/.test(path)?'image/gif':'text/html');res.end(readFileSync(path));});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const executable=process.env.LIQUID_COMMAND_BROWSER_EXECUTABLE??['/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()].find(existsSync);
if(!executable)throw new Error('No existing browser available for visual verification.');
const browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox']});const report=[],failures=[];
async function assertUnbrokenWord(locator,word){
 const fragments=await locator.evaluate((element,word)=>{const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){const start=node.textContent.indexOf(word);if(start>=0){const range=document.createRange();range.setStart(node,start);range.setEnd(node,start+word.length);return [...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0).length;}}return 0;},word);
 if(fragments!==1)throw Error(JSON.stringify({message:'Text splits an ordinary label inside a word.',word,fragments}));
}
async function portalControlBounds(locator,viewport,message){
 await locator.scrollIntoViewIfNeeded();const bounds=await locator.boundingBox();
 if(!bounds||bounds.width<24||bounds.height<24||bounds.x<-.5||bounds.x+bounds.width>viewport.width+.5)throw Error(JSON.stringify({message,viewport,bounds}));
 return bounds;
}
async function verifyPortalCalendar(page,viewport,fontScale=1){
 const previous=page.getByRole('button',{name:'Vorheriger Zeitraum',exact:true}),next=page.getByRole('button',{name:'Nächster Zeitraum',exact:true});
 const prevBounds=await portalControlBounds(previous,viewport,'Calendar previous control is clipped.'),nextBounds=await next.boundingBox();
 if(!nextBounds||Math.abs(nextBounds.y-prevBounds.y)>1||nextBounds.x<prevBounds.x+prevBounds.width-1)throw Error(JSON.stringify({message:'Calendar navigation has lost its shared horizontal layout.',viewport,fontScale,prevBounds,nextBounds}));
 const views=page.getByLabel('Kalenderansicht',{exact:true});const viewBounds=await views.boundingBox();
 const labels=['Tag','Woche','Monat','Agenda','Liste'];
 for(const label of labels){const control=views.getByRole('button',{name:label,exact:true});await portalControlBounds(control,viewport,'Calendar view control is clipped.');await assertUnbrokenWord(control,label);}
 await page.screenshot({path:join(output,`employee-calendar-controls-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 await views.getByRole('button',{name:'Monat',exact:true}).click();
 const selected=await views.getByRole('button',{name:'Monat',exact:true}).evaluate(element=>getComputedStyle(element).backgroundColor);
 if(selected!=='rgb(255, 255, 255)')throw Error(JSON.stringify({message:'Calendar view selection does not retain its visible selected state.',viewport,fontScale,selected}));
 await page.screenshot({path:join(output,`employee-calendar-month-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 await views.getByRole('button',{name:'Agenda',exact:true}).click();
 await next.scrollIntoViewIfNeeded();await next.click();await page.getByText('Keine Ereignisse in diesem Zeitraum',{exact:true}).waitFor();
 const today=page.getByRole('button',{name:'Heute',exact:true});await today.scrollIntoViewIfNeeded();await today.click();
 const own=page.getByRole('button',{name:/Helene Musterfrau/});await own.waitFor();const eventBounds=await portalControlBounds(own,viewport,'Calendar event is clipped.');
 const primary=own.getByText('Helene Musterfrau',{exact:true}),person=own.getByText('Marlene Beispiel',{exact:true}),service=own.getByText('Unterstützung im Alltag',{exact:true});
 const primaryBounds=await primary.boundingBox(),personBounds=await person.boundingBox(),serviceBounds=await service.boundingBox();
 if(!primaryBounds||!personBounds||!serviceBounds||personBounds.y<primaryBounds.y+primaryBounds.height-.5||serviceBounds.y<personBounds.y+personBounds.height-.5)throw Error(JSON.stringify({message:'Calendar event names and service have collapsed into one concatenated text row.',viewport,fontScale,primaryBounds,personBounds,serviceBounds}));
 await page.screenshot({path:join(output,`employee-calendar-agenda-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 await own.click();const route=await page.evaluate(()=>window.__previewRoute);if(route!=='/portal/employee/assignments/visual-visit')throw Error(JSON.stringify({message:'Own calendar assignment lost its operational target.',route}));
 const team=page.getByRole('button',{name:/Friedrich Mustermann/});await team.scrollIntoViewIfNeeded();await team.click();
 const teamMessage=page.getByText('Dieser Eintrag ist im Teamkalender sichtbar. Die Durchführung öffnen Sie bei Ihren eigenen Einsätzen.',{exact:true});await teamMessage.waitFor();await waitForNativeModal(page,teamMessage);
 await page.screenshot({path:join(output,`employee-calendar-team-details-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 const close=page.getByRole('button',{name:'Schließen',exact:true}).filter({hasText:'Schließen'}).last();await close.scrollIntoViewIfNeeded();await close.click();await teamMessage.waitFor({state:'hidden'});
 const refresh=page.getByRole('button',{name:'Kalender aktualisieren',exact:true});await refresh.scrollIntoViewIfNeeded();await refresh.click();
 if(!await page.evaluate(()=>window.__portalCalendarRefreshes>0))throw Error('Actual portal calendar refresh did not reach its scoped data hook.');
 report.push({screen:'employee-calendar-interactions',viewport,fontScale,prevBounds,nextBounds,viewBounds,eventBounds,ownAssignmentRoute:route,teamDetails:true,periodRestored:true});
}
async function verifyEmployeePortalHome(page,viewport,fontScale=1){
 if(await page.getByText('Meine Pflegetouren',{exact:true}).count())throw Error('Employee home still contains the unrelated care-tour panel.');
 const hero=page.getByTestId('employee-portal-premium-home-hero'),quick=page.getByTestId('employee-portal-premium-quick-actions');
 await hero.scrollIntoViewIfNeeded();const heroBounds=await hero.boundingBox();await quick.scrollIntoViewIfNeeded();const quickBounds=await quick.boundingBox();
 if(!heroBounds||heroBounds.height<150||!quickBounds||quickBounds.height<100)throw Error(JSON.stringify({message:'Actual employee home cards are compressed by the page/frame chain.',viewport,fontScale,heroBounds,quickBounds}));
 await page.screenshot({path:join(output,`employee-home-actual-actions-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 const actions=quick.getByRole('button');for(const action of await actions.all())await portalControlBounds(action,viewport,'Employee quick action is clipped.');
 const assignmentTitle=page.getByText('Hauswirtschaftliche Unterstützung',{exact:true});await assignmentTitle.scrollIntoViewIfNeeded();
 const assignmentBounds=await assignmentTitle.boundingBox(),assignmentRowBounds=await page.getByTestId('employee-home-assignment-visual-visit').boundingBox();
 if(!assignmentBounds||!assignmentRowBounds||assignmentBounds.x-assignmentRowBounds.x<6||assignmentBounds.width<Math.min(220,viewport.width*.6))throw Error(JSON.stringify({message:'Employee assignment status consumes the title column or its text overlaps the edge glow.',viewport,fontScale,assignmentBounds,assignmentRowBounds}));
 await assertUnbrokenWord(assignmentTitle,'Hauswirtschaftliche');await assertUnbrokenWord(assignmentTitle,'Unterstützung');
 await page.screenshot({path:join(output,`employee-home-actual-assignment-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 await page.getByTestId('employee-home-assignment-visual-visit').click();
 const assignmentRoute=await page.evaluate(()=>window.__previewRoute);if(assignmentRoute!=='/portal/employee/assignments/visual-visit')throw Error(JSON.stringify({message:'The actual employee home assignment lost its exact destination.',assignmentRoute}));
 const bottom=page.getByText('Dokumente zur Unterschrift',{exact:true});await bottom.scrollIntoViewIfNeeded();const bottomBounds=await bottom.boundingBox();
 if(!bottomBounds||bottomBounds.y<-.5||bottomBounds.y+bottomBounds.height>viewport.height+.5)throw Error(JSON.stringify({message:'The end of the actual employee dashboard is unreachable.',viewport,fontScale,bottomBounds}));
 await page.screenshot({path:join(output,`employee-home-actual-bottom-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 const refresh=page.getByRole('button',{name:'Übersicht aktualisieren',exact:true});await refresh.scrollIntoViewIfNeeded();await refresh.click();
 await page.waitForFunction(()=>window.__employeePreviewRefreshes>0);
 report.push({screen:'employee-home-actual-frame',viewport,fontScale,heroBounds,quickBounds,assignmentBounds,assignmentRowBounds,assignmentRoute,bottomBounds,refreshReached:true,careToursAbsent:true});
}
async function verifyEmployeeClientRecords(page,viewport,fontScale=1){
 const firstHeader=page.getByRole('button',{name:'Klientenakte Helene Musterfrau öffnen',exact:true});await firstHeader.waitFor();await firstHeader.scrollIntoViewIfNeeded();
 const card=firstHeader.locator('..'),cardBounds=await card.boundingBox(),action=card.getByRole('button',{name:'Akte öffnen',exact:true}),actionBounds=await action.boundingBox();
 if(!cardBounds||cardBounds.height<160||cardBounds.height>450*fontScale||!actionBounds||actionBounds.y+actionBounds.height>cardBounds.y+cardBounds.height+.5||cardBounds.y+cardBounds.height-actionBounds.y-actionBounds.height>80)throw Error(JSON.stringify({message:'Employee client card uses the full viewport height or loses its actions.',viewport,fontScale,cardBounds,actionBounds}));
 await page.screenshot({path:join(output,`employee-clients-intrinsic-card-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 const last=page.getByRole('button',{name:'Klientenakte Musterperson 14 öffnen',exact:true});await last.scrollIntoViewIfNeeded();await portalControlBounds(last,viewport,'Last employee client record cannot be reached.');
 await page.screenshot({path:join(output,`employee-clients-last-record-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 const search=page.getByRole('textbox',{name:'Klientenakten durchsuchen',exact:true});await search.scrollIntoViewIfNeeded();await search.fill('Kein passender Prüfname');await page.getByText('Keine Treffer',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Suche löschen',exact:true}).click();await firstHeader.waitFor();await search.fill('Helene');
 const filtered=page.getByRole('button',{name:'Akte öffnen',exact:true});if(await filtered.count()!==1)throw Error('Employee client record search did not filter the actual list.');await filtered.scrollIntoViewIfNeeded();await filtered.click();
 const route=await page.evaluate(()=>window.__previewRoute);if(route!=='/portal/employee/clients/employee-client-1')throw Error(JSON.stringify({message:'Employee client card loses its exact client record target.',route}));
 report.push({screen:'employee-clients-actual-frame',viewport,fontScale,cardBounds,actionBounds,lastRecordReached:true,searchAndClear:true,route});
}
async function verifyClientPortalHome(page,viewport,fontScale=1){
 const hero=page.getByTestId('client-portal-premium-home-hero');await hero.scrollIntoViewIfNeeded();const heroBounds=await hero.boundingBox();
 const frame=await page.getByTestId('client-portal-page-frame').boundingBox();
 if(!heroBounds||heroBounds.height<130||!frame||frame.height<heroBounds.height+100)throw Error(JSON.stringify({message:'The actual client home frame compresses its content.',viewport,fontScale,heroBounds,frame}));
 const copyChecks=[];
 for(const id of ['client-portal-budget-heading','client-portal-budget-explanation','client-portal-sections-heading','client-portal-sections-explanation']){
  const copy=page.getByTestId(id);await copy.scrollIntoViewIfNeeded();
  const result=await copy.evaluate(element=>{
   const rgba=value=>{const values=value.match(/[\d.]+/g)?.map(Number);return values?.length>=3?[values[0],values[1],values[2],values[3]??1]:[0,0,0,0];};
   const over=(front,back)=>{const alpha=front[3]+back[3]*(1-front[3]);return alpha?[0,1,2].map(i=>(front[i]*front[3]+back[i]*back[3]*(1-front[3]))/alpha).concat(alpha):[0,0,0,0];};
   const luminance=color=>color.slice(0,3).map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
   let background=[0,0,0,0];for(let parent=element;parent&&background[3]<.999;parent=parent.parentElement)background=over(background,rgba(getComputedStyle(parent).backgroundColor));
   background=over(background,[255,255,255,1]);const foreground=over(rgba(getComputedStyle(element).color),background),ink=luminance(foreground),paper=luminance(background),range=document.createRange();range.selectNodeContents(element);
   const frame=element.closest('[data-testid="client-portal-page-frame"]').getBoundingClientRect();
   return {ratio:(Math.max(ink,paper)+.05)/(Math.min(ink,paper)+.05),foreground,background,frame:{x:frame.x,width:frame.width},lines:[...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0).map(rect=>({x:rect.x,width:rect.width,height:rect.height}))};
  });
  if(result.ratio<4.5||!result.lines.length||result.lines.some(line=>line.x<Math.max(0,result.frame.x)-.5||line.x+line.width>Math.min(viewport.width,result.frame.x+result.frame.width)+.5))throw Error(JSON.stringify({message:'Client portal section copy is low contrast or extends beyond its frame.',id,viewport,fontScale,result}));
  copyChecks.push({id,...result});
 }
 await page.screenshot({path:join(output,`client-home-actual-section-copy-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 const signatures=page.getByRole('button',{name:/^Unterschriften:/});await portalControlBounds(signatures,viewport,'Client home signature action is clipped.');
 await page.screenshot({path:join(output,`client-home-actual-bottom-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 await signatures.click();const route=await page.evaluate(()=>window.__previewRoute);if(route!=='/portal/client/documents/signatures')throw Error(JSON.stringify({message:'Client home signature action loses its destination.',route}));
 report.push({screen:'client-home-actual-frame',viewport,fontScale,heroBounds,frame,copyChecks,signatureRoute:route});
}
async function verifyActualPortal(page,screen,viewport,fontScale=1){
 if(screen==='employee-calendar')await verifyPortalCalendar(page,viewport,fontScale);
 if(screen==='employee-home')await verifyEmployeePortalHome(page,viewport,fontScale);
 if(screen==='employee-clients')await verifyEmployeeClientRecords(page,viewport,fontScale);
 if(screen==='client-home')await verifyClientPortalHome(page,viewport,fontScale);
}
async function verifyHelpSteps(page,viewport,fontScale=1){
 const title=page.getByRole('heading',{name:'Briefkopf und Layout öffnen',exact:true});await title.waitFor();await title.scrollIntoViewIfNeeded();
 const bounds=await title.boundingBox();
 if(!bounds||bounds.width<Math.min(240,viewport.width*.3)||bounds.x<-.5||bounds.x+bounds.width>viewport.width+.5)throw Error(JSON.stringify({message:'Help step copy is squeezed into the number column.',viewport,fontScale,bounds}));
 await assertUnbrokenWord(title,'Briefkopf');
 await page.screenshot({path:join(output,`help-steps-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 report.push({screen:'help-step-copy',viewport,fontScale,bounds});
}
async function verifyNotesList(page,viewport,fontScale=1){
 const list=page.getByTestId('office-notes-list');await list.waitFor();await list.scrollIntoViewIfNeeded();
 const bounds=await list.boundingBox();
 if(!bounds||bounds.height<199||bounds.width<160||bounds.x<-.5||bounds.x+bounds.width>viewport.width+.5)throw Error(JSON.stringify({message:'Note list loses its usable viewport below the filters.',viewport,fontScale,bounds}));
 const note=page.getByRole('button',{name:/Teamrunde vorbereiten/});await note.scrollIntoViewIfNeeded();
 await page.screenshot({path:join(output,`notes-list-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 report.push({screen:'notes-list',viewport,fontScale,bounds});
}
async function verifyGoogleDescription(page,viewport,fontScale=1){
 const description=page.getByText('Termine im gewählten Zeitraum und neue Veranstaltungen.',{exact:true});await description.waitFor();
 const bounds=await description.boundingBox();
 if(!bounds||bounds.x<-.5||bounds.x+bounds.width>viewport.width+.5)throw Error(JSON.stringify({message:'Google service description extends beyond the viewport.',viewport,fontScale,bounds}));
}
async function verifyDesktopCenter(page,viewport,fontScale=1){
 const errors=[];const capture=error=>errors.push(error.message);page.on('pageerror',capture);
 await page.getByRole('button',{name:'Apps und Widgets öffnen',exact:true}).click();
 const center=page.getByTestId('desktop-apps-widgets-center');await center.waitFor();
 await page.waitForTimeout(200);
 const shell=await center.boundingBox();
 if(!shell||shell.x<-.5||shell.x+shell.width>viewport.width+.5)throw Error(JSON.stringify({message:'Native Apps & Widgets center exceeds the viewport.',viewport,fontScale,shell}));
 await page.screenshot({path:join(output,`desktop-center-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 const areas=await center.getByRole('button',{name:/-Desktop auswählen$/}).evaluateAll(elements=>elements.map(element=>{const r=element.getBoundingClientRect();return{label:element.getAttribute('aria-label'),x:r.x,y:r.y,width:r.width,height:r.height};}));
 if(!areas.length||areas.some(area=>area.width<=0||area.x<shell.x-.5||area.x+area.width>shell.x+shell.width+.5))throw Error(JSON.stringify({message:'Desktop area controls extend outside the center.',viewport,fontScale,shell,areas}));
 for(let i=0;i<areas.length;i++)for(let j=i+1;j<areas.length;j++){
  const a=areas[i],b=areas[j],horizontal=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),vertical=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
  if(horizontal>1&&vertical>1)throw Error(JSON.stringify({message:'Desktop area controls overlap.',viewport,fontScale,first:a,second:b}));
 }
 const app=page.getByTestId('center-app-catalog').getByRole('button',{name:/^App .+ öffnen$/}).first();
 await app.scrollIntoViewIfNeeded();
 const card=await app.boundingBox(),artwork=await app.getByTestId('desktop-catalog-artwork').boundingBox();
 if(!card||!artwork||artwork.width<40||artwork.height<40||card.x<-.5||card.x+card.width>viewport.width+.5)throw Error(JSON.stringify({message:'Native catalogue artwork or app card is clipped.',viewport,fontScale,card,artwork}));
 await page.screenshot({path:join(output,`desktop-center-apps-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 await center.getByText('Widgets',{exact:true}).first().click();
 await center.getByText('Auf diesem Desktop',{exact:true}).click();
 const remove=page.getByTestId('center-widget-catalog').getByRole('button',{name:/ vom Desktop entfernen$/}).first();
 await remove.scrollIntoViewIfNeeded();await remove.click();
 await page.getByText('Auswahl auf diesem Gerät gespeichert.',{exact:true}).waitFor();
 await page.screenshot({path:join(output,`desktop-center-widgets-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 await center.getByText('Hintergründe',{exact:true}).first().click();
 const background=page.getByTestId('center-background-catalog').getByRole('button',{name:/ als Desktop-Hintergrund verwenden$/}).first();
 await background.scrollIntoViewIfNeeded();
 const preview=await background.boundingBox();if(!preview||preview.width<120||preview.x<-.5||preview.x+preview.width>viewport.width+.5)throw Error(JSON.stringify({message:'Native background catalogue is clipped.',viewport,fontScale,preview}));
 await background.click();await page.getByText('Aktiver Hintergrund',{exact:true}).first().waitFor();
 await page.screenshot({path:join(output,`desktop-center-backgrounds-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 const done=page.getByRole('button',{name:'Center schließen',exact:true});await done.scrollIntoViewIfNeeded();await done.click();
 await center.waitFor({state:'hidden'});
 page.removeListener('pageerror',capture);
 if(errors.length)throw Error(JSON.stringify({screen:'desktop-center',viewport,fontScale,errors}));
 report.push({screen:'desktop-center',viewport,fontScale,shell,areas,card,artwork,background:preview,selectionSaved:true,errors});
}
async function verifyWeatherDialog(page,viewport,fontScale=1){
 const heading=page.getByRole('heading',{name:'Wetterort ändern',exact:true});await heading.waitFor();
 await waitForNativeModal(page,heading);
 const input=page.getByRole('textbox',{name:'Stadt oder Postleitzahl in Deutschland',exact:true});await input.fill('10115');
 const result=page.getByRole('button',{name:'10115 Berlin, Berlin auswählen',exact:true});await result.waitFor();await result.scrollIntoViewIfNeeded();
 const field=await input.boundingBox(),choice=await result.boundingBox();
 if(!field||!choice||field.x<-.5||field.x+field.width>viewport.width+.5||choice.x<-.5||choice.x+choice.width>viewport.width+.5)throw Error(JSON.stringify({message:'Native weather search or result extends beyond the viewport.',viewport,fontScale,field,choice}));
 await page.screenshot({path:join(output,`weather-results-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 await result.click();await heading.waitFor({state:'hidden'});await page.getByText('10115 Berlin als Wetterort ausgewählt.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Wetterort ändern',exact:true}).click();await heading.waitFor();await waitForNativeModal(page,heading);
 const summary=page.getByText('Wetterinformationen',{exact:true});await summary.click();
 const information=page.getByText('Das Wetter stammt von einer verfügbaren Messstation in der Umgebung des gewählten Orts.',{exact:false});await information.waitFor();
 const sources=[];
 for(const name of ['Deutscher Wetterdienst','GeoNames','CC BY 4.0']){
  const link=page.getByRole('link',{name,exact:true});await link.scrollIntoViewIfNeeded();await waitForNativeModal(page,link);
  const bounds=await link.boundingBox();
  const visible=await link.evaluate(element=>{let top=0,bottom=innerHeight;for(let parent=element.parentElement;parent;parent=parent.parentElement){if(/auto|scroll|hidden/.test(getComputedStyle(parent).overflowY)){const rect=parent.getBoundingClientRect();top=Math.max(top,rect.top);bottom=Math.min(bottom,rect.bottom);}}const rect=element.getBoundingClientRect();return rect.top>=top-.5&&rect.bottom<=bottom+.5;});
  if(!bounds||!visible||bounds.x<-.5||bounds.x+bounds.width>viewport.width+.5)throw Error(JSON.stringify({message:'Native weather source link is not reachable inside its scroll viewport.',viewport,fontScale,name,bounds,visible}));
  sources.push({name,bounds,visible});
 }
 await summary.scrollIntoViewIfNeeded();await waitForNativeModal(page,summary);
 const info=await information.boundingBox(),summaryBounds=await summary.boundingBox();
 if(!info||!summaryBounds||summaryBounds.y<-.5||summaryBounds.y+summaryBounds.height>viewport.height+.5||info.x<-.5||info.x+info.width>viewport.width+.5)throw Error(JSON.stringify({message:'Native weather information or its summary is clipped.',viewport,fontScale,info,summaryBounds}));
 await page.screenshot({path:join(output,`weather-information-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 report.push({screen:'weather-dialog',viewport,fontScale,field,choice,information:info,summary:summaryBounds,sources,localDirectory:true,inertAsyncSave:true,deviceLocationRequested:false});
}
async function waitForNativeModal(page,locator){
 const element=await locator.elementHandle();
 await page.waitForFunction(element=>{
  if(!element?.isConnected)return false;
  for(let parent=element;parent;parent=parent.parentElement){
   if(Number(getComputedStyle(parent).opacity)<.999||parent.getAnimations().some(animation=>animation.playState==='running'||animation.pending))return false;
  }
  return true;
 },element);
 await locator.evaluate(async element=>{
  let previous='',stable=0;
  for(let frame=0;frame<60;frame++){
   await new Promise(requestAnimationFrame);
   const rect=element.getBoundingClientRect(),position=[rect.x,rect.y,rect.width,rect.height].map(value=>value.toFixed(2)).join(',');
   stable=position===previous?stable+1:0;previous=position;
   if(stable>=3)return;
  }
  throw Error('Native modal layout did not settle before capture.');
 });
 await element.dispose();
}
async function verifyOwnerConsole(page,screen,viewport,fontScale=1){
 const tenant=screen.startsWith('owner-tenant'),failed=screen.endsWith('-error');
 if(failed)await page.getByText(tenant?'Lokaler Prüffehler: Mandantendaten konnten nicht geladen werden.':'Lokaler Prüffehler: Betriebsdaten konnten nicht geladen werden.',{exact:false}).first().waitFor();
 else if(tenant)await page.getByText('Vollständige Mandantenakte',{exact:true}).waitFor();
 else await page.getByText('Die gesamte Plattform',{exact:true}).waitFor();
 const header=await page.getByRole('heading',{name:tenant?(failed?'Mandant':'Pflege & Alltag Nord'):'Übersicht',exact:true,includeHidden:true}).first().boundingBox();
 const search=await page.getByRole('button',{name:'Plattform durchsuchen, Strg oder Command K',exact:true,includeHidden:true}).boundingBox();
 if(!header||!search||header.x<-.5||header.x+header.width>viewport.width+.5||search.x<-.5||search.x+search.width>viewport.width+.5)throw Error(JSON.stringify({message:'Owner console header or controls exceed the viewport.',screen,viewport,fontScale,header,search}));
 let navigation=null;
 if(failed){
  const copy=page.getByText(tenant?'Lokaler Prüffehler: Mandantendaten konnten nicht geladen werden.':'Lokaler Prüffehler: Betriebsdaten konnten nicht geladen werden.',{exact:false}).first();await waitForNativeModal(page,copy);
  const copyBounds=await copy.boundingBox();
  if(!copyBounds||copyBounds.width<Math.min(180,viewport.width*.55))throw Error(JSON.stringify({message:'Error description is squeezed between header controls.',screen,viewport,fontScale,copyBounds}));
  if(tenant)await assertUnbrokenWord(copy,'Mandantendaten');
  const retry=page.getByRole('button',{name:'Erneut versuchen',exact:true}).first();await retry.scrollIntoViewIfNeeded();
  const recovery=await retry.boundingBox();if(!recovery||recovery.x<-.5||recovery.x+recovery.width>viewport.width+.5)throw Error(JSON.stringify({message:'Owner error recovery is clipped.',screen,viewport,fontScale,recovery}));
  await page.screenshot({path:join(output,`${screen}-recovery-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
  report.push({screen,viewport,fontScale,header,search,recovery,fixtureServices:'inert-local-data',errorState:true});return;
 }
 if(viewport.width>=960){
  navigation=await page.locator('#desktop-module-navigation').boundingBox();
  if(!navigation||navigation.x<-.5||Math.abs(navigation.x)>1||header.x<navigation.x+navigation.width-1)throw Error(JSON.stringify({message:'Wide owner console must keep navigation at the left edge and the header beside it.',screen,viewport,fontScale,header,navigation}));
 }else{
  await page.getByRole('button',{name:'Navigation öffnen',exact:true}).click();
  await page.getByRole('button',{name:'Navigation schließen',exact:true}).waitFor();
  navigation=await page.locator('#desktop-module-navigation').boundingBox();
  if(!navigation||navigation.x<-.5||navigation.x+navigation.width>viewport.width+.5)throw Error(JSON.stringify({message:'Owner navigation is clipped in its native dialog.',screen,viewport,fontScale,navigation}));
  await page.screenshot({path:join(output,`${screen}-navigation-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
  await page.getByRole('button',{name:'Navigation schließen',exact:true}).click();
 }
 await page.screenshot({path:join(output,`${screen}-ready-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
 if(tenant&&!failed){
  await page.getByRole('tab',{name:'Personen & Akten',exact:true}).click();
  await page.getByRole('tab',{name:'Alle Klient:innen',exact:true}).click();
  const person=page.getByRole('button',{name:'Alle Angaben zu Helene Musterfrau öffnen',exact:true});await person.waitFor();await person.scrollIntoViewIfNeeded();
  const personBounds=await person.boundingBox();if(!personBounds||personBounds.x<-.5||personBounds.x+personBounds.width>viewport.width+.5)throw Error(JSON.stringify({message:'Native owner dossier row action is clipped.',viewport,fontScale,personBounds}));
  await page.screenshot({path:join(output,`owner-clients-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
  await person.click();const personHeading=page.getByRole('heading',{name:'Helene Musterfrau',exact:true});await personHeading.waitFor();await waitForNativeModal(page,personHeading);
  await page.screenshot({path:join(output,`owner-client-fields-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
  await page.getByRole('button',{name:'Dialog schließen',exact:true}).last().click();
  await page.getByRole('tab',{name:'Mandantenakte',exact:true}).click();
  await page.getByRole('tab',{name:'Einrichtung & Prozentstand',exact:true}).click();
  const setupHeading=page.getByText('Einrichtung Schritt für Schritt',{exact:true});await setupHeading.waitFor();await setupHeading.scrollIntoViewIfNeeded();await waitForNativeModal(page,setupHeading);
  const profile=page.getByRole('heading',{name:'Firmenprofil',exact:true});await profile.scrollIntoViewIfNeeded();
  const profileBounds=await profile.boundingBox();
  if(!profileBounds||profileBounds.width<Math.min(180,viewport.width*.35))throw Error(JSON.stringify({message:'Setup profile copy loses its flexible grid column.',viewport,fontScale,profileBounds}));
  await assertUnbrokenWord(profile,'Firmenprofil');
  await page.screenshot({path:join(output,`owner-setup-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
  const setupActions=page.getByRole('button',{name:'Daten prüfen',exact:true}),setupBounds=[];
  for(let index=0;index<await setupActions.count();index++){
   const action=setupActions.nth(index);await action.scrollIntoViewIfNeeded();const bounds=await action.boundingBox();
   if(!bounds||bounds.width<80||bounds.x<-.5||bounds.x+bounds.width>viewport.width+.5)throw Error(JSON.stringify({message:'Setup action falls into its narrow icon track.',viewport,fontScale,index,bounds}));
   await assertUnbrokenWord(action,'Daten');await assertUnbrokenWord(action,'prüfen');setupBounds.push(bounds);
  }
  if(!setupBounds.length)throw Error('Setup fixture must provide its actual data inspection actions.');
  const firstAction=setupActions.first();await firstAction.scrollIntoViewIfNeeded();
  await page.screenshot({path:join(output,`owner-setup-action-${viewport.width}x${viewport.height}-scale-${fontScale}.png`)});
  await firstAction.click();await page.getByRole('heading',{name:'Unternehmensstammdaten',exact:true}).waitFor();
  report.push({screen:'owner-setup-inspection',viewport,fontScale,profileBounds,actions:setupBounds,firstActionOpened:true});
 }
 report.push({screen,viewport,fontScale,header,search,navigation,fixtureServices:'inert-local-data',errorState:failed});
}
async function recordCaseFailure(page,scope,error){
 const failure={...scope,error:error instanceof Error?error.message:String(error)};
 failures.push(failure);
 const name=`failure-${scope.screen}-${scope.viewport.width}x${scope.viewport.height}-scale-${scope.fontScale??1}`;
 try{await page.screenshot({path:join(output,name+'.png')});}catch{}
 console.error(JSON.stringify(failure));
 writeFileSync(join(output,'verification.json'),JSON.stringify({status:'running-with-failures',checks:report,failures},null,2));
}
try{
// Keep enlarged device text usable when the viewport is also short.
{
 const page=await browser.newPage({viewport:{width:844,height:390}});
 await page.goto(`http://127.0.0.1:${server.address().port}/?screen=desktop&scale=1.6`);
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
 const grid=page.getByTestId('native-desktop-widget-viewport');await grid.scrollIntoViewIfNeeded();
 const bounds=await grid.boundingBox();
 if(!bounds||bounds.height<160||bounds.y<0||bounds.y+bounds.height>391){
  const ancestors=await grid.evaluate(element=>{const rows=[];for(let item=element;item&&rows.length<8;item=item.parentElement){const r=item.getBoundingClientRect();rows.push({testId:item.getAttribute('data-testid'),y:r.y,height:r.height,clientHeight:item.clientHeight,scrollHeight:item.scrollHeight,overflowY:getComputedStyle(item).overflowY});}return rows;});
  writeFileSync(join(output,'verification.json'),JSON.stringify({screen:'desktop-landscape-large-text',bounds,ancestors},null,2));
  await page.screenshot({path:join(output,'failure-desktop-landscape-large-text.png')});
  throw Error(JSON.stringify({message:'Desktop widgets are not reachable with enlarged text in landscape.',bounds}));
 }
 report.push({screen:'desktop',viewport:{width:844,height:390},fontScale:1.6,widgetViewport:bounds});
 await page.screenshot({path:join(output,'desktop-844x390-large-text.png')});await verifyDesktopCenter(page,{width:844,height:390},1.6);await page.close();
}
for(const viewport of [{width:844,height:390},{width:1280,height:800}]){
 const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
 await page.goto(`http://127.0.0.1:${server.address().port}/?screen=weather-dialog&scale=1.6`);await page.evaluate(()=>document.fonts.ready);await verifyWeatherDialog(page,viewport,1.6);
 if(errors.length)throw Error(JSON.stringify({screen:'weather-dialog',viewport,fontScale:1.6,errors}));
 }catch(error){await recordCaseFailure(page,{screen:'weather-dialog',viewport,fontScale:1.6},error);}finally{await page.close();}
}
for(const viewport of [{width:844,height:390},{width:1280,height:800}])for(const screen of ['employee-notices','employee-shell','employee-home','employee-clients','employee-calendar','client-home']){
 const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(`http://127.0.0.1:${server.address().port}/?screen=${screen}&scale=1.6`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
  if(screen==='employee-notices'){
   const title=page.getByText('Neuer Einsatz',{exact:true}).last();await title.waitFor();
   const visible=await title.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
   if(!visible)throw Error('The first assignment is hidden behind explanatory copy at enlarged landscape text.');
  }
  await page.screenshot({path:join(output,`${screen}-${viewport.width}x${viewport.height}-scale-1.6.png`)});await verifyActualPortal(page,screen,viewport,1.6);
  if(errors.length)throw Error(JSON.stringify({screen,viewport,fontScale:1.6,errors}));
 }catch(error){await recordCaseFailure(page,{screen,viewport,fontScale:1.6},error);}finally{await page.close();}
}
// Exercise the actual native article anchors and Google modal at enlarged text,
// in addition to their ordinary-size matrix below. No provider writes occur.
for(const [screen,viewport] of [['help-article',{width:1280,height:800}],['google-service',{width:360,height:800}]]){
 const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(`http://127.0.0.1:${server.address().port}/?screen=${screen}&scale=1.6`);await page.evaluate(()=>document.fonts.ready);
  if(screen==='help-article'){
   const link=page.getByRole('link',{name:'Schritt für Schritt',exact:true});await link.scrollIntoViewIfNeeded();
   await page.screenshot({path:join(output,'help-toc-1280x800-scale-1.6.png')});await link.click();
   const target=page.getByRole('heading',{name:'Schritt für Schritt',exact:true});
   await target.evaluate(async element=>{for(let frame=0;frame<180;frame++){const rect=element.getBoundingClientRect();if(rect.top>=-.5&&rect.bottom<=innerHeight+.5)return;await new Promise(requestAnimationFrame);}throw Error('Native article section is not reachable after its table-of-contents action.');});
   await page.screenshot({path:join(output,'help-toc-target-1280x800-scale-1.6.png')});await verifyHelpSteps(page,viewport,1.6);
  }else{
   await verifyGoogleDescription(page,viewport,1.6);
   await page.getByRole('button',{name:'Neu erstellen',exact:false}).click();
   const heading=page.getByRole('heading',{name:'Termin anlegen',exact:true});await heading.waitFor();await waitForNativeModal(page,heading);
   await page.screenshot({path:join(output,'google-event-form-360x800-scale-1.6.png')});
   const cancel=page.getByRole('button',{name:'Abbrechen',exact:true});await cancel.scrollIntoViewIfNeeded();await cancel.click();await heading.waitFor({state:'hidden'});
  }
  if(errors.length)throw Error(JSON.stringify({screen,viewport,fontScale:1.6,errors}));
  report.push({screen,viewport,fontScale:1.6,enlargedInteraction:true,errors});
 }catch(error){await recordCaseFailure(page,{screen,viewport,fontScale:1.6},error);}finally{await page.close();}
}
for(const screen of ['desktop','clients','employees','company','notes','catalog','academy','consultation','employee-notices','employee-shell','employee-home','employee-clients','employee-calendar','client-home','business-access','employee-access','client-access','registration','access-hub','family-home','help','help-article','google-workspace','google-service','owner-console','owner-tenant','owner-console-error','owner-tenant-error','weather-dialog']){
 const page=await browser.newPage({viewport:{width:360,height:800}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
 await page.goto(`http://127.0.0.1:${server.address().port}/?screen=${screen}&scale=1.6`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
 if(screen==='access-hub')await page.waitForTimeout(1100);
 await page.screenshot({path:join(output,`${screen}-360-large-text.png`)});
 if(screen==='desktop')await verifyDesktopCenter(page,{width:360,height:800},1.6);
 if(screen==='weather-dialog')await verifyWeatherDialog(page,{width:360,height:800},1.6);
 if(screen.startsWith('owner-'))await verifyOwnerConsole(page,screen,{width:360,height:800},1.6);
 if(errors.length)throw Error(JSON.stringify({screen,fontScale:1.6,errors}));
 if(screen==='academy'){await assertUnbrokenWord(page.getByRole('heading',{name:'Wissen weitergeben. Lernen begleiten.',exact:true}),'weitergeben.');await assertUnbrokenWord(page.getByRole('button',{name:'Schulungsplan',exact:true}),'Schulungsplan');}
 if(screen==='consultation'){
  await assertUnbrokenWord(page.getByRole('button',{name:'Vorlagenbibliothek',exact:true}),'Vorlagenbibliothek');
  for(const name of ['Vorlagenbibliothek','Teamvorlagen','+ Neuen Fall anlegen']){
   const bounds=await page.getByRole('button',{name,exact:true}).boundingBox();
   if(!bounds||bounds.x<0||bounds.x+bounds.width>361)throw Error(JSON.stringify({message:'Enlarged consultation header action extends beyond the viewport.',name,bounds}));
  }
 }
 if(screen==='notes'){const create=await page.getByRole('button',{name:'Neue Notiz',exact:true}).boundingBox();if(!create||create.x<0||create.x+create.width>361)throw Error(JSON.stringify({message:'Enlarged note creation control is clipped.',create}));await verifyNotesList(page,{width:360,height:800},1.6);}
 await verifyActualPortal(page,screen,{width:360,height:800},1.6);
 if(screen==='employee-home'){
  await assertUnbrokenWord(page.getByText(/^Hauswirtschaftliche Unterstützung/).first(),'Hauswirtschaftliche');
  const card=await page.getByText('Ihr aktueller Einsatz ist bereit',{exact:true}).locator('..').boundingBox(),action=await page.getByRole('button',{name:'Einsatz öffnen',exact:true}).first().boundingBox();
  if(!card||!action||action.y+action.height>card.y+card.height+1)throw Error(JSON.stringify({message:'Enlarged employee guide content extends beyond its card.',card,action}));
 }
 }catch(error){await recordCaseFailure(page,{screen,viewport:{width:360,height:800},fontScale:1.6},error);}finally{await page.close();}
}
for(const viewport of [{width:768,height:1024},{width:320,height:740},{width:360,height:800},{width:390,height:844},{width:412,height:915},{width:600,height:960},{width:844,height:390},{width:1280,height:800}]){
 for(const screen of ['desktop','web-desktop','clients','web-clients','employees','web-employees','company','web-company','company-editor','inventory','web-inventory','notes','web-notes','catalog','web-catalog','academy','web-academy','consultation','web-consultation','web-employee-notices','employee-notices','employee-shell','employee-home','employee-clients','employee-calendar','client-home','family-home','client-appointment','employee-execution-card','access-hub','business-access','employee-access','client-access','registration','first-password','password-recovery','password-reset','help','help-article','google-workspace','google-service','owner-console','owner-tenant','owner-console-error','owner-tenant-error','weather-dialog']){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
  await page.goto(`http://127.0.0.1:${server.address().port}/?screen=${screen}`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
  if(errors.length){await page.screenshot({path:join(output,`failure-${screen}-${viewport.width}x${viewport.height}.png`)});writeFileSync(join(output,'verification.json'),JSON.stringify({screen,viewport,errors},null,2));throw new Error(JSON.stringify({screen,viewport,errors}));}
  if(screen==='access-hub'){await page.waitForTimeout(1100);const title=await page.getByText('Mitarbeiter',{exact:true}).boundingBox();const character=await page.getByLabel('CareSuite-Assistent mit Stethoskop',{exact:true}).boundingBox();if(viewport.width<900&&title&&character&&title.x<character.x+character.width&&title.x+title.width>character.x&&title.y<character.y+character.height&&title.y+title.height>character.y)throw Error('Access character overlaps its role label.');}
  if(screen.endsWith('employee-notices')){
   for(const title of ['Neuer Einsatz','Einsatz geändert','Einsatz abgesagt','Einsatz nicht mehr zugeordnet']){
    const item=page.getByText(title,{exact:true}).last();await item.scrollIntoViewIfNeeded();
    const box=await item.boundingBox();if(!box||box.height<14||box.y<0||box.y+box.height>viewport.height+1)throw Error('Assignment notice body is collapsed or clipped: '+title);
   }
   await page.getByText(/Hauswirtschaftliche Unterstützung · Helene Musterfrau/).first().scrollIntoViewIfNeeded();
   const hit=await page.getByText(/Hauswirtschaftliche Unterstützung · Helene Musterfrau/).first().evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
   if(!hit)throw Error('Assignment notice content is hidden behind the popup header or footer.');
   await page.screenshot({path:join(output,`employee-notices-content-${viewport.width}x${viewport.height}.png`)});
  }
  if(screen==='employee-shell' && viewport.width>=980){
   const logout=page.getByRole('button',{name:'Sicher abmelden',exact:true});
   const box=await logout.boundingBox();if(!box||box.y<24||box.y+box.height>viewport.height-34+.5)throw Error(JSON.stringify({message:'Sidebar logout extends below the safe visible viewport',viewport,box}));
  }
  if(screen==='family-home'){const area=await page.getByLabel('Portalbereich today',{exact:true}).boundingBox();const logout=await page.getByRole('button',{name:'Abmelden',exact:true}).boundingBox();if(!area||area.height<160||!logout||logout.x+logout.width>viewport.width+1)throw Error('Family portal content or logout is clipped.');}
  if(screen==='desktop'||screen==='web-desktop')await page.getByRole('button',{name:'Desktop bearbeiten',exact:true}).waitFor();
  if(screen==='inventory'||screen==='web-inventory')await page.getByText('Diensttelefon · Verwaltung Nord',{exact:true}).waitFor();
  const overflow=await page.evaluate(()=>document.body.scrollWidth>innerWidth+1);if(overflow||errors.length)throw new Error(JSON.stringify({screen,viewport,overflow,errors}));
  await page.screenshot({path:join(output,`${screen}-${viewport.width}x${viewport.height}.png`)});
  if((screen==='consultation'||screen==='web-consultation')&&viewport.width===320){
   const workspace=await page.getByLabel('Beratung und Schulungen',{exact:true}).boundingBox(),header=await page.getByRole('button',{name:'Vorlagenbibliothek',exact:true}).locator('..').locator('..').boundingBox();
   if(!workspace||!header||Math.abs(header.y-workspace.y-16)>1)throw Error(JSON.stringify({message:'Consultation phone workspace must use the final authored 16px top padding.',screen,viewport,workspace,header}));
   const lines=await page.getByRole('button',{name:'+ Neuen Fall anlegen',exact:true}).evaluate(element=>{const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),ys=new Set();let node;while((node=walker.nextNode())){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const rect of range.getClientRects())if(rect.width>0&&rect.height>0)ys.add(Math.round(rect.y));}return ys.size;});
   if(lines<1||lines>2)throw Error(JSON.stringify({message:'Consultation phone creation action must retain the shared maximum of two text lines.',screen,viewport,lines}));
   const subtitle=await page.getByText('Beratungsbesuche nach § 37.3 und häusliche Schulungen nach § 45.',{exact:true}).evaluate(element=>{const style=getComputedStyle(element);return {fontSize:parseFloat(style.fontSize),lineHeight:parseFloat(style.lineHeight)};});
   if(!Number.isFinite(subtitle.lineHeight)||Math.abs(subtitle.lineHeight/subtitle.fontSize-1.55)>.02)throw Error(JSON.stringify({message:'Consultation subtitle must inherit its authored font line ratio.',screen,viewport,subtitle}));
   const metric=page.getByRole('button',{name:/^Offene Besuche/}),metricLabel=metric.getByText('Offene Besuche',{exact:true}),labelBounds=await metricLabel.boundingBox(),metricBounds=await metric.boundingBox();
   if(!labelBounds||!metricBounds||Math.abs(labelBounds.x-metricBounds.x-13)>1)throw Error(JSON.stringify({message:'Consultation metric labels must start at the authored left padding.',screen,viewport,labelBounds,metricBounds}));
  }
  if(screen==='clients'||screen==='web-clients'){
   const icons=await page.getByLabel('Akten nach Bearbeitungsstand filtern',{exact:true}).locator('svg').evaluateAll(nodes=>nodes.map(node=>{const style=getComputedStyle(node),bounds=node.getBoundingClientRect();return {display:style.display,width:bounds.width,height:bounds.height};}));
   if(icons.length!==4||icons.some(icon=>icon.display==='none'||Math.abs(icon.width-16)>1||Math.abs(icon.height-16)>1))throw Error(JSON.stringify({message:'Client metric arrows must retain the shared Web inline visibility and 16px size.',screen,viewport,icons}));
  }
  if((screen==='clients'||screen==='web-clients')&&viewport.width>=1100){
   const first=page.getByRole('button',{name:'Klient:in ↑',exact:true}).locator('..'),cell=await first.boundingBox(),row=await first.locator('..').boundingBox();
   if(!cell||!row||Math.abs(cell.width/row.width-.27)>.015||row.height<32||row.height>50)throw Error(JSON.stringify({message:'Client table must preserve its authored column widths and compact header height.',screen,viewport,cell,row}));
  }
  if((screen==='clients'||screen==='web-clients')&&viewport.width===320){
   const draft=page.getByRole('button').filter({hasText:'begonnene Aufnahmen'}),draftBounds=await draft.boundingBox(),draftLabel=await draft.getByText('Entwürfe',{exact:true}).boundingBox(),draftHint=await draft.getByText('begonnene Aufnahmen',{exact:true}).boundingBox();
   if(!draftBounds||!draftLabel||!draftHint||Math.abs((draftLabel.y+draftHint.y+draftHint.height)/2-draftBounds.y-draftBounds.height/2)>2)throw Error(JSON.stringify({message:'Client block-button content must retain the Web vertical centering when the adjacent card is taller.',screen,viewport,draftBounds,draftLabel,draftHint}));

   const first=await page.getByText('Import / Export',{exact:true}).boundingBox(),second=await page.getByText('Aktualisieren',{exact:true}).first().boundingBox();
   if(!first||!second||Math.abs(first.y-second.y)>1)throw Error(JSON.stringify({message:'Phone client header actions must keep the original shared row.',screen,viewport,first,second}));
  }
  if((screen==='clients'||screen==='web-clients')&&viewport.width>=1100)await assertUnbrokenWord(page.getByRole('button',{name:'Akte von Helene Musterfrau öffnen',exact:true}),'Akte öffnen');
  if((screen==='notes'||screen==='web-notes')&&viewport.width>=1100){
   const workspace=await page.getByLabel('Persönliche Notizen',{exact:true}).boundingBox(),sidebar=await page.getByLabel('Notizübersicht',{exact:true}).boundingBox(),footer=await page.getByText('Persönliche Notizen in Ihrem Unternehmenskonto.',{exact:true}).boundingBox();
   if(!workspace||!sidebar||!footer||footer.y+footer.height>Math.min(workspace.y+workspace.height,viewport.height)+1)throw Error(JSON.stringify({message:'The note sidebar footer must stay inside the bounded workspace without scrolling the whole sidebar.',screen,viewport,workspace,sidebar,footer}));
   report.push({screen:'notes-footer-bounded',renderer:screen,viewport,workspace,sidebar,footer});

   const glyph=page.locator('svg').first(),icon=await glyph.boundingBox(),plate=await glyph.locator('..').boundingBox();
   if(!icon||!plate||icon.width<24||Math.abs(icon.x+icon.width/2-plate.x-plate.width/2)>2||Math.abs(icon.y+icon.height/2-plate.y-plate.height/2)>2)throw Error(JSON.stringify({message:'Note header artwork must keep its authored size and center.',screen,viewport,icon,plate}));
   const button=await page.getByRole('button',{name:/Freie Notiz beginnen/}).boundingBox();
   if(!button||button.width>viewport.width*.35)throw Error(JSON.stringify({message:'The inline note-start action stretches across its block container.',screen,viewport,button}));
  }
  if(screen==='notes'){
   for(const name of ['Desktop','Vorlagen','Neue Notiz']){const bounds=await page.getByRole('button',{name,exact:true}).boundingBox();if(!bounds||bounds.x<0||bounds.x+bounds.width>viewport.width+1)throw Error(JSON.stringify({message:'Note header action extends beyond the viewport.',name,viewport,bounds}));}
   for(const name of ['Angeheftet','Aufgaben'])await assertUnbrokenWord(page.getByRole('button',{name,exact:true}),name);
  }
  if(screen==='inventory'||screen==='web-inventory'){
   const stock=page.getByRole('button').filter({hasText:'ohne archivierte Einträge'}),label=await stock.getByText('Bestand',{exact:true}).boundingBox(),value=await stock.getByText('2',{exact:true}).boundingBox();
   if(!label||!value||value.y<label.y+label.height-1)throw Error(JSON.stringify({message:'Inventory statistic labels and values must stack without overlap.',screen,viewport,label,value}));
  }
  if((screen==='employees'||screen==='web-employees')&&viewport.width>=1100){
   const fields=[page.getByPlaceholder('Name, Funktion, Abteilung oder Kontakt …'),...['Status','Abteilung','Sortierung'].map(name=>page.getByRole('combobox',{name,exact:true}))];
   const bounds=await Promise.all(fields.map(field=>field.boundingBox()));
   if(bounds.some(box=>!box)||Math.max(...bounds.map(box=>box.y))-Math.min(...bounds.map(box=>box.y))>2||bounds.some((box,index)=>index>0&&box.x<=bounds[index-1].x))throw Error(JSON.stringify({message:'Personnel search and three filters must share the original four-column row.',screen,viewport,bounds}));
  }
  if(screen==='academy'||screen==='web-academy'){
   const heading=page.getByRole('heading',{name:'Wissen weitergeben. Lernen begleiten.',exact:true});
   const titleSize=await heading.evaluate(element=>parseFloat(getComputedStyle(element).fontSize));
   const copy=page.getByText('Kurse gestalten, Schulungen zuweisen und Abschlüsse gemeinsam verfolgen.',{exact:true});
   const copyColor=await copy.evaluate(element=>getComputedStyle(element).color);
   if(titleSize<24||!copyColor.startsWith('rgba(255, 255, 255')&&!copyColor.startsWith('rgb(255, 255, 255')&&!copyColor.startsWith('color(srgb 1 1 1'))throw Error(JSON.stringify({message:'Academy heading scale or header copy contrast differs from the original theme.',screen,viewport,titleSize,copyColor}));
  }
  if(screen==='consultation'){
   const library=page.getByRole('button',{name:'Vorlagenbibliothek',exact:true});await assertUnbrokenWord(library,'Vorlagenbibliothek');
   const bounds=await library.boundingBox();if(!bounds||bounds.x<0||bounds.x+bounds.width>viewport.width+1)throw Error(JSON.stringify({message:'Consultation action extends beyond the viewport.',viewport,bounds}));
  }
  if((screen==='company'||screen==='web-company')&&viewport.width===600){
   const brand=await page.getByText('P&',{exact:true}).boundingBox(),edit=await page.getByRole('button',{name:'Stammdaten bearbeiten',exact:true}).boundingBox();
   if(!brand||Math.abs(brand.x+brand.width/2-viewport.width/2)>24||!edit||edit.width<viewport.width*.7)throw Error(JSON.stringify({message:'Narrow company header must center the brand and stretch its vertical actions.',screen,viewport,brand,edit}));
  }
  if((screen==='company'||screen==='web-company')&&viewport.width>=1000){
   const heading=await page.getByRole('heading',{name:'Pflege & Alltag Nord',exact:true}).boundingBox(),brand=await page.getByText('P&',{exact:true}).boundingBox();
   if(!heading||!brand||brand.x<heading.x+heading.width)throw Error(JSON.stringify({message:'Wide company identity and brand must share the two-column header.',screen,viewport,heading,brand}));
  }

  if(screen==='registration'){for(let step=2;step<=5;step++){if(step===5){await page.getByLabel('Admin-Passwort',{exact:true}).fill('LokaleLayoutPruefung2026!');await page.getByLabel('Passwort bestätigen',{exact:true}).fill('LokaleLayoutPruefung2026!');await page.getByRole('checkbox').click();}await page.getByRole('button',{name:'Weiter',exact:true}).click();await page.getByText(`REGISTRIERUNG · SCHRITT ${step} VON 5`,{exact:true}).waitFor();await page.screenshot({path:join(output,`registration-step-${step}-${viewport.width}x${viewport.height}.png`)});}}
  if(screen==='clients'||screen==='web-clients'){await page.getByRole('button',{name:'Filter',exact:true}).click();await page.getByRole('combobox',{name:'Bearbeitungsstand',exact:true}).waitFor();await page.screenshot({path:join(output,`${screen}-filters-${viewport.width}x${viewport.height}.png`)});}
  if(screen==='help'){
   await page.getByRole('button',{name:'Logo hochladen',exact:true}).click();
   await page.getByRole('button',{name:/Logo, Briefkopf und Dokumentlayout einstellen/}).click();
   await page.getByRole('heading',{name:'Logo, Briefkopf und Dokumentlayout einstellen',exact:true}).waitFor();
   await page.screenshot({path:join(output,`help-reader-${viewport.width}x${viewport.height}.png`)});
  }
  if(screen==='help'||screen==='help-article')await verifyHelpSteps(page,viewport);
  if(screen==='google-service'){
   await verifyGoogleDescription(page,viewport);
   await page.getByRole('button',{name:'Neu erstellen',exact:false}).click();
   await page.getByRole('heading',{name:'Termin anlegen',exact:true}).waitFor();
   await page.screenshot({path:join(output,`google-event-form-${viewport.width}x${viewport.height}.png`)});
   await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
  }
  if(screen==='notes')await verifyNotesList(page,viewport);
  if(screen==='desktop')await verifyDesktopCenter(page,viewport);
  if(screen==='weather-dialog')await verifyWeatherDialog(page,viewport);
  if(screen.startsWith('owner-'))await verifyOwnerConsole(page,screen,viewport);
  if(screen==='desktop' && viewport.width<980){await page.getByRole('button',{name:'Navigation',exact:true}).click();await page.getByRole('textbox',{name:'Seiten suchen'}).waitFor();await page.waitForTimeout(400);await page.screenshot({path:join(output,`navigation-${viewport.width}x${viewport.height}.png`)});}
  if(screen==='notes'||screen==='web-notes'){await page.getByRole('button',{name:/Teamrunde vorbereiten/}).click();await page.getByRole('textbox',{name:'Titel der Notiz',exact:true}).waitFor();await page.waitForTimeout(400);await page.screenshot({path:join(output,`${screen}-editor-${viewport.width}x${viewport.height}.png`)});if(screen==='notes'){const bounds=await page.getByRole('button',{name:'Speichern',exact:true}).boundingBox();if(!bounds||bounds.x<0||bounds.x+bounds.width>viewport.width+1)throw Error(JSON.stringify({message:'Note editor save action extends beyond the viewport.',viewport,bounds}));}await page.getByRole('button',{name:'Handschrift',exact:true}).click();await page.getByRole('slider',{name:'Stiftbreite',exact:true}).waitFor();await page.screenshot({path:join(output,`${screen}-handwriting-${viewport.width}x${viewport.height}.png`)});await page.getByRole('button',{name:'Mindmap',exact:true}).click();await page.screenshot({path:join(output,`${screen}-mindmap-${viewport.width}x${viewport.height}.png`)});}
  if(screen==='inventory'){await page.getByRole('button',{name:'Details ansehen',exact:true}).first().click();await page.getByRole('button',{name:'Ausgeben',exact:true}).click();await page.getByRole('combobox',{name:/Empfänger:in/}).waitFor();await page.waitForTimeout(400);await page.screenshot({path:join(output,`inventory-issue-${viewport.width}x${viewport.height}.png`)});}
  await verifyActualPortal(page,screen,viewport);
  report.push({screen,viewport,overflow,errors});
  }catch(error){await recordCaseFailure(page,{screen,viewport,fontScale:1},error);}finally{await page.close();}
 }
}
if(failures.length)throw new AggregateError(failures.map(row=>new Error(JSON.stringify(row))),`${failures.length} native layout cases failed.`);
writeFileSync(join(output,'verification.json'),JSON.stringify({renderer:'React Native Web using native source, fixture data only; Android hardware verification remains separate.',checks:report},null,2));console.log(`Native layout screenshots: ${output}`);
}catch(error){writeFileSync(join(output,'verification.json'),JSON.stringify({status:'failed',error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:undefined,checks:report,failures},null,2));throw error;}finally{await browser.close();await new Promise(done=>server.close(done));}
