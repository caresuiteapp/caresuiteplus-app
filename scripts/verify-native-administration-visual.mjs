import { createHash } from 'node:crypto';
import { build } from 'esbuild';
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
const mockFixture=resolve('scripts/fixtures/administration-preview-mocks.jsx');
const mocks=new Set(['expo-router','react-native-safe-area-context','expo-linear-gradient','@/components/images/CareSuiteImage','@/lib/auth','@/hooks/usePermissions','@/hooks/useModuleAccess','@/hooks/useDesktopWeather.native','@/hooks/useDesktopWeather.web','@/design/web/WebFontScaleProvider','./DesktopWeatherLocationDialog.native','./DesktopWeatherLocationDialog.web','@/components/googleWorkspace/GoogleWorkspaceWidget.native','@/components/googleWorkspace/GoogleWorkspaceWidget.web','@/hooks/useClientList','@/hooks/useEmployeeList','@/lib/inventory/companyInventoryService','@/hooks/core/useAsyncQuery','expo-crypto','@/lib/office/notes/service.shared','@/components/layout/ScreenShell','@/lib/auth/context']);
for(const renderer of ['native','web']){
await build({entryPoints:[renderer==='native'?fixture:resolve('scripts/fixtures/web-desktop-preview.jsx')],outfile:join(output,renderer+'-preview.js'),bundle:true,assetNames:'assets/[name]-[hash]',platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.EXPO_OS':'"web"','process.env':'{}','__DEV__':'false'},loader:{'.png':'file','.jpg':'file','.jpeg':'file','.ttf':'dataurl','.gif':'file','.mp4':'dataurl','.svg':'dataurl','.js':'jsx'},plugins:[{name:'isolated-native-preview',setup(b){
 const aliasTargets=new Set(['src/lib/platform/nativeWorkflowEnvironment.native','src/lib/platform/nativeFileDelivery.native','src/lib/platform/nativePdfInspection.native','src/lib/inventory/companyInventoryService','src/lib/inventory/companyInventoryService.native','src/lib/inventory/companyInventoryService.web','src/lib/office/notes/service.shared','src/lib/office/notes/service.native','src/lib/office/notes/service.web','src/hooks/useTenantId']);
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
 b.onResolve({filter:/^react-native-keyboard-controller$/},()=>({path:'keyboard',namespace:'preview-keyboard'}));
 b.onLoad({filter:/.*/,namespace:'preview-keyboard'},()=>({loader:'jsx',resolveDir:root,contents:`import React from 'react';import {View,ScrollView,KeyboardAvoidingView as Avoid} from ${JSON.stringify(nativeWeb)};export const KeyboardProvider=({children})=><View style={{flex:1}}>{children}</View>;export const KeyboardAwareScrollView=ScrollView,KeyboardAvoidingView=Avoid;`}));
 b.onResolve({filter:/^react-native-reanimated$/},()=>({path:'animated',namespace:'qa'}));
 b.onResolve({filter:/^expo-blur$/},()=>({path:'blur',namespace:'qa'}));
 b.onResolve({filter:/^react-native-svg$/},()=>({path:resolve('node_modules/react-native-svg/lib/module/elements.web.js')}));
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
 b.onLoad({filter:/.*/,namespace:'qa'},args=>({loader:'jsx',resolveDir:root,contents:args.path==='storage'?`const data=new Map([['caresuite.liquid.registration.v1',JSON.stringify({companyName:'Pflege & Alltag Nord GmbH',legalForm:'GmbH',industry:'Alltagsbegleitung',street:'Gartenstraße 24',zip:'30159',city:'Hannover',phone:'0511 000000',email:'kontakt@example.invalid',adminFirstName:'Marlene',adminLastName:'Mustermann-Beispiel',adminEmail:'verwaltung@example.invalid',contactRole:'Geschäftsführung'})]]); export default {getItem:async k=>data.get(k)??null,removeItem:async k=>{data.delete(k)},setItem:async(k,v)=>{data.set(k,v)},multiGet:async keys=>keys.map(k=>[k,data.get(k)??null]),multiSet:async rows=>rows.forEach(([k,v])=>data.set(k,v))};`:args.path==='animated'?`import {useRef} from 'react';import * as RN from ${JSON.stringify(nativeWeb)};export default {View:RN.View,Text:RN.Text,createAnimatedComponent:c=>c};export const useSharedValue=v=>useRef({value:v}).current,useAnimatedStyle=f=>f(),withSpring=v=>v,withTiming=v=>v,withRepeat=v=>v,withSequence=(v)=>v,withDelay=(_delay,v)=>v,runOnJS=f=>f,cancelAnimation=()=>{},Easing=RN.Easing;`:args.path==='blur'?`import {View} from ${JSON.stringify(nativeWeb)};export const BlurView=View;`:['icon','ionicons'].includes(args.path)?`import {Text} from ${JSON.stringify(nativeWeb)};import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/${args.path==='ionicons'?'Ionicons':'Feather'}.json';export default function Icon({name,size,color}){return <Text aria-hidden style={{fontFamily:'${args.path==='ionicons'?'Ionicons':'Feather'}',fontSize:size,color}}>{String.fromCodePoint(glyphs[name]??63)}</Text>}`:`import React from 'react';import * as RN from ${JSON.stringify(nativeWeb)};export * from ${JSON.stringify(nativeWeb)};function nativeStyle(style){const flat=RN.StyleSheet.flatten(style)??{};const {experimental_backgroundImage,...rest}=flat;return [rest,experimental_backgroundImage?{backgroundImage:experimental_backgroundImage}:null];}export const Pressable=React.forwardRef(({style,...props},ref)=><RN.Pressable {...props} ref={ref} style={typeof style==='function'?state=>nativeStyle(style(state)):nativeStyle(style)}/>);const NativeView=RN.View;export const View=React.forwardRef(({style,...props},ref)=>{const s=RN.StyleSheet.flatten(style)??{};const {experimental_backgroundImage,...rest}=s;return <NativeView {...props} ref={ref} style={[rest,experimental_backgroundImage?{backgroundImage:experimental_backgroundImage}:null]}/>;});export const Platform={...RN.Platform,OS:new URLSearchParams(location.search).get('screen')?.startsWith('web-')?'web':'android'};const scale=Number(new URLSearchParams(location.search).get('scale')??1);export const useWindowDimensions=()=>({...RN.useWindowDimensions(),fontScale:scale});export const Text=({style,allowFontScaling,...props})=>{const s=RN.StyleSheet.flatten(style)??{};return <RN.Text {...props} style={[s,allowFontScaling===false?{}:{fontSize:(s.fontSize??14)*scale,lineHeight:(s.lineHeight??(s.fontSize??14)*1.4)*scale}]}/>};` }));
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
const browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox']});const report=[];
async function assertUnbrokenWord(locator,word){
 const fragments=await locator.evaluate((element,word)=>{const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){const start=node.textContent.indexOf(word);if(start>=0){const range=document.createRange();range.setStart(node,start);range.setEnd(node,start+word.length);return [...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0).length;}}return 0;},word);
 if(fragments!==1)throw Error(JSON.stringify({message:'Text splits an ordinary label inside a word.',word,fragments}));
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
 await page.screenshot({path:join(output,'desktop-844x390-large-text.png')});await page.close();
}
for(const screen of ['desktop','clients','employees','company','notes','catalog','academy','consultation','employee-home','client-home','business-access','employee-access','client-access','registration','access-hub','family-home']){
 const page=await browser.newPage({viewport:{width:360,height:800}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/?screen=${screen}&scale=1.6`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
 await page.screenshot({path:join(output,`${screen}-360-large-text.png`)});
 if(errors.length)throw Error(JSON.stringify({screen,fontScale:1.6,errors}));
 if(screen==='academy'){await assertUnbrokenWord(page.getByRole('heading',{name:'Wissen weitergeben. Lernen begleiten.',exact:true}),'weitergeben.');await assertUnbrokenWord(page.getByRole('button',{name:'Schulungsplan',exact:true}),'Schulungsplan');}
 if(screen==='consultation'){
  await assertUnbrokenWord(page.getByRole('button',{name:'Vorlagenbibliothek',exact:true}),'Vorlagenbibliothek');
  for(const name of ['Vorlagenbibliothek','Teamvorlagen','+ Neuen Fall anlegen']){
   const bounds=await page.getByRole('button',{name,exact:true}).boundingBox();
   if(!bounds||bounds.x<0||bounds.x+bounds.width>361)throw Error(JSON.stringify({message:'Enlarged consultation header action extends beyond the viewport.',name,bounds}));
  }
 }
 if(screen==='notes'){const create=await page.getByRole('button',{name:'Neue Notiz',exact:true}).boundingBox();if(!create||create.x<0||create.x+create.width>361)throw Error(JSON.stringify({message:'Enlarged note creation control is clipped.',create}));}
 if(screen==='employee-home'){
  await assertUnbrokenWord(page.getByText(/^Hauswirtschaftliche Unterstützung/).first(),'Hauswirtschaftliche');
  const card=await page.getByText('Ihr aktueller Einsatz ist bereit',{exact:true}).locator('..').boundingBox(),action=await page.getByRole('button',{name:'Einsatz öffnen',exact:true}).first().boundingBox();
  if(!card||!action||action.y+action.height>card.y+card.height+1)throw Error(JSON.stringify({message:'Enlarged employee guide content extends beyond its card.',card,action}));
 }
 await page.close();
}
for(const viewport of [{width:768,height:1024},{width:320,height:740},{width:360,height:800},{width:390,height:844},{width:412,height:915},{width:600,height:960},{width:844,height:390},{width:1280,height:800}]){
 for(const screen of ['desktop','web-desktop','clients','web-clients','employees','web-employees','company','web-company','company-editor','inventory','web-inventory','notes','web-notes','catalog','web-catalog','academy','web-academy','consultation','web-consultation','employee-home','client-home','family-home','client-appointment','employee-execution-card','access-hub','business-access','employee-access','client-access','registration','first-password','password-recovery','password-reset']){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?screen=${screen}`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
  if(errors.length){await page.screenshot({path:join(output,`failure-${screen}-${viewport.width}x${viewport.height}.png`)});writeFileSync(join(output,'verification.json'),JSON.stringify({screen,viewport,errors},null,2));throw new Error(JSON.stringify({screen,viewport,errors}));}
  if(screen==='access-hub'){await page.waitForTimeout(1100);const title=await page.getByText('Mitarbeiter',{exact:true}).boundingBox();const character=await page.getByLabel('CareSuite-Assistent mit Stethoskop',{exact:true}).boundingBox();if(viewport.width<900&&title&&character&&title.x<character.x+character.width&&title.x+title.width>character.x&&title.y<character.y+character.height&&title.y+title.height>character.y)throw Error('Access character overlaps its role label.');}
  if(screen==='family-home'){const area=await page.getByLabel('Portalbereich today',{exact:true}).boundingBox();const logout=await page.getByRole('button',{name:'Abmelden',exact:true}).boundingBox();if(!area||area.height<160||!logout||logout.x+logout.width>viewport.width+1)throw Error('Family portal content or logout is clipped.');}
  if(screen==='desktop'||screen==='web-desktop')await page.getByRole('button',{name:'Desktop bearbeiten',exact:true}).waitFor();
  if(screen==='inventory'||screen==='web-inventory')await page.getByText('Diensttelefon · Verwaltung Nord',{exact:true}).waitFor();
  const overflow=await page.evaluate(()=>document.body.scrollWidth>innerWidth+1);if(overflow||errors.length)throw new Error(JSON.stringify({screen,viewport,overflow,errors}));
  await page.screenshot({path:join(output,`${screen}-${viewport.width}x${viewport.height}.png`)});
  if(screen==='notes'){
   for(const name of ['Desktop','Vorlagen','Neue Notiz']){const bounds=await page.getByRole('button',{name,exact:true}).boundingBox();if(!bounds||bounds.x<0||bounds.x+bounds.width>viewport.width+1)throw Error(JSON.stringify({message:'Note header action extends beyond the viewport.',name,viewport,bounds}));}
   for(const name of ['Angeheftet','Aufgaben'])await assertUnbrokenWord(page.getByRole('button',{name,exact:true}),name);
  }
  if(screen==='inventory'||screen==='web-inventory'){
   const stock=page.getByRole('button').filter({hasText:'ohne archivierte Einträge'}),label=await stock.getByText('Bestand',{exact:true}).boundingBox(),value=await stock.getByText('2',{exact:true}).boundingBox();
   if(!label||!value||value.y<label.y+label.height-1)throw Error(JSON.stringify({message:'Inventory statistic labels and values must stack without overlap.',screen,viewport,label,value}));
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
  if(screen==='desktop' && viewport.width<980){await page.getByRole('button',{name:'Navigation',exact:true}).click();await page.getByRole('textbox',{name:'Seiten suchen'}).waitFor();await page.waitForTimeout(400);await page.screenshot({path:join(output,`navigation-${viewport.width}x${viewport.height}.png`)});}
  if(screen==='notes'||screen==='web-notes'){await page.getByRole('button',{name:/Teamrunde vorbereiten/}).click();await page.getByRole('textbox',{name:'Titel der Notiz',exact:true}).waitFor();await page.waitForTimeout(400);await page.screenshot({path:join(output,`${screen}-editor-${viewport.width}x${viewport.height}.png`)});if(screen==='notes'){const bounds=await page.getByRole('button',{name:'Speichern',exact:true}).boundingBox();if(!bounds||bounds.x<0||bounds.x+bounds.width>viewport.width+1)throw Error(JSON.stringify({message:'Note editor save action extends beyond the viewport.',viewport,bounds}));}await page.getByRole('button',{name:'Handschrift',exact:true}).click();await page.getByRole('slider',{name:'Stiftbreite',exact:true}).waitFor();await page.screenshot({path:join(output,`${screen}-handwriting-${viewport.width}x${viewport.height}.png`)});await page.getByRole('button',{name:'Mindmap',exact:true}).click();await page.screenshot({path:join(output,`${screen}-mindmap-${viewport.width}x${viewport.height}.png`)});}
  if(screen==='inventory'){await page.getByRole('button',{name:'Details ansehen',exact:true}).first().click();await page.getByRole('button',{name:'Ausgeben',exact:true}).click();await page.getByRole('combobox',{name:/Empfänger:in/}).waitFor();await page.waitForTimeout(400);await page.screenshot({path:join(output,`inventory-issue-${viewport.width}x${viewport.height}.png`)});}
  report.push({screen,viewport,overflow,errors});await page.close();
 }
}
writeFileSync(join(output,'verification.json'),JSON.stringify({renderer:'React Native Web using native source, fixture data only; Android hardware verification remains separate.',checks:report},null,2));console.log(`Native layout screenshots: ${output}`);
}catch(error){writeFileSync(join(output,'verification.json'),JSON.stringify({status:'failed',error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:undefined},null,2));throw error;}finally{await browser.close();await new Promise(done=>server.close(done));}
