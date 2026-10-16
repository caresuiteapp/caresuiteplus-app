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
const mocks=new Set(['expo-router','react-native-safe-area-context','expo-linear-gradient','@/components/images/CareSuiteImage','@/lib/auth','@/hooks/usePermissions','@/hooks/useModuleAccess','@/hooks/useDesktopWeather.native','./DesktopWeatherLocationDialog.native','@/components/googleWorkspace/GoogleWorkspaceWidget.native','@/hooks/useClientList','@/hooks/useEmployeeList','@/lib/inventory/companyInventoryService','@/hooks/core/useAsyncQuery']);
await build({entryPoints:[fixture],outfile:join(output,'preview.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','__DEV__':'false'},loader:{'.png':'dataurl','.jpg':'dataurl','.jpeg':'dataurl'},plugins:[{name:'isolated-native-preview',setup(b){
 b.onResolve({filter:/.*/},args=>mocks.has(args.path)?{path:fixture}:undefined);
 b.onResolve({filter:/^react-native$/},()=>({path:'native-shim',namespace:'qa'}));
 b.onResolve({filter:/^@expo\/vector-icons\/Feather$/},()=>({path:'icon',namespace:'qa'}));
 b.onResolve({filter:/^@react-native-async-storage\/async-storage$/},()=>({path:'storage',namespace:'qa'}));
 b.onLoad({filter:/.*/,namespace:'qa'},args=>({loader:'jsx',resolveDir:root,contents:args.path==='storage'?`const data=new Map(); export default {getItem:async k=>data.get(k)??null,setItem:async(k,v)=>{data.set(k,v)},multiGet:async keys=>keys.map(k=>[k,data.get(k)??null]),multiSet:async rows=>rows.forEach(([k,v])=>data.set(k,v))};`:args.path==='icon'?`import {Text} from ${JSON.stringify(nativeWeb)};import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json';export default function Icon({name,size,color}){return <Text aria-hidden style={{fontFamily:'Feather',fontSize:size,color}}>{String.fromCodePoint(glyphs[name]??63)}</Text>}`:`import React from 'react';import * as RN from ${JSON.stringify(nativeWeb)};export * from ${JSON.stringify(nativeWeb)};export const Platform={...RN.Platform,OS:'android'};const scale=Number(new URLSearchParams(location.search).get('scale')??1);export const useWindowDimensions=()=>({...RN.useWindowDimensions(),fontScale:scale});export const Text=({style,allowFontScaling,...props})=>{const s=RN.StyleSheet.flatten(style)??{};return <RN.Text {...props} style={[s,allowFontScaling===false?{}:{fontSize:(s.fontSize??14)*scale,lineHeight:(s.lineHeight??(s.fontSize??14)*1.4)*scale}]}/>};` }));
}}]});
copyFileSync('public/fonts/CenturyGothic.ttf',join(output,'CenturyGothic.ttf'));
copyFileSync(require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),join(output,'Feather.ttf'));
writeFileSync(join(output,'index.html'),`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:CenturyGothic;src:url(/CenturyGothic.ttf)}@font-face{font-family:Feather;src:url(/Feather.ttf)}html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:CenturyGothic,sans-serif}#root{display:flex;flex-direction:column}</style><div id="root"></div><script src="/preview.js"></script></html>`);
if(process.argv.includes('--prepare-only')){console.log(`Native preview compiled: ${output}`);process.exit(0);}
const server=createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;const path=join(output,name==='/'?'index.html':name.slice(1));if(!path.startsWith(output)||!existsSync(path)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.ttf')?'font/ttf':'text/html');res.end(readFileSync(path));});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const executable=process.env.LIQUID_COMMAND_BROWSER_EXECUTABLE??['/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()].find(existsSync);
if(!executable)throw new Error('No existing browser available for visual verification.');
const browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox']});const report=[];
try{
for(const viewport of [{width:360,height:800},{width:390,height:844},{width:844,height:390},{width:1280,height:800}]){
 for(const screen of ['desktop','clients','employees','company','inventory']){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?screen=${screen}`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
  if(screen==='desktop')await page.getByRole('button',{name:'Navigation',exact:true}).waitFor();
  if(screen==='inventory')await page.getByText('Diensttelefon · Verwaltung Nord',{exact:true}).waitFor();
  const overflow=await page.evaluate(()=>document.body.scrollWidth>innerWidth+1);if(overflow||errors.length)throw new Error(JSON.stringify({screen,viewport,overflow,errors}));
  await page.screenshot({path:join(output,`${screen}-${viewport.width}x${viewport.height}.png`)});
  if(screen==='clients'){await page.getByRole('button',{name:'Filter',exact:true}).click();await page.getByRole('button',{name:'Ergebnisse anzeigen'}).waitFor();await page.screenshot({path:join(output,`clients-filters-${viewport.width}x${viewport.height}.png`)});}
  if(screen==='desktop'){await page.getByRole('button',{name:'Navigation',exact:true}).click();await page.getByRole('textbox',{name:'Seiten suchen'}).waitFor();await page.screenshot({path:join(output,`navigation-${viewport.width}x${viewport.height}.png`)});}
  if(screen==='inventory'){await page.getByRole('button',{name:'Ausgeben',exact:true}).click();await page.getByText('Empfänger:in *',{exact:true}).waitFor();await page.screenshot({path:join(output,`inventory-issue-${viewport.width}x${viewport.height}.png`)});}
  report.push({screen,viewport,overflow,errors});await page.close();
 }
}
for(const screen of ['desktop','clients','company']){const page=await browser.newPage({viewport:{width:360,height:800}});await page.goto(`http://127.0.0.1:${server.address().port}/?screen=${screen}&scale=1.6`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);await page.screenshot({path:join(output,`${screen}-360-large-text.png`)});await page.close();}
writeFileSync(join(output,'verification.json'),JSON.stringify({renderer:'React Native Web using native source, fixture data only; Android hardware verification remains separate.',checks:report},null,2));console.log(`Native layout screenshots: ${output}`);
}finally{await browser.close();await new Promise(done=>server.close(done));}
