
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const out=path.resolve('.workflow-recovery-qa'); fs.mkdirSync(out,{recursive:true});
const contents=`
import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
import {WorkflowFeedbackOverlay} from './src/components/ui/WorkflowFeedbackOverlay';
import {CENTRAL_HEALTHOS_POPUP_CONTRACT_CSS} from './src/design/web/centralHealthOSPopupContractCss';
window.clicks=0;function App(){const [pending,setPending]=useState(false); window.setPending=setPending;
return <><style>{CENTRAL_HEALTHOS_POPUP_CONTRACT_CSS}</style><button id="start" onClick={()=>{window.clicks++;setPending(true)}}>Einsatz starten</button><input aria-label="Dokumentation" defaultValue="Fiktiver Testeinsatz"/><WorkflowFeedbackOverlay loading={pending} loadingMessage="Die Serverbestätigung läuft weiter. Der aktuelle Status wird automatisch abgeglichen."/></>;}
createRoot(document.getElementById('root')).render(<App/>);
`;
await build({stdin:{contents,loader:'tsx',resolveDir:process.cwd()},bundle:true,outfile:path.join(out,'app.js'),format:'iife',platform:'browser',jsx:'automatic',
define:{'process.env.NODE_ENV':'"production"',__DEV__:'false'},alias:{'react-native':'react-native-web','@':path.resolve('src'),'@/theme':path.resolve('src/theme/typography.ts')}});fs.writeFileSync(path.join(out,'index.html'),'<html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#ecf3fa;font-family:Arial}button,input{margin:30px;padding:16px}</style><main id="root"></main><script src="app.js"></script></html>');
const executablePath=[chromium.executablePath(),'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({headless:true,executablePath});const page=await browser.newPage();const errors=[]; page.on('pageerror',e=>(errors.push(e.message),console.error(e.stack)));
page.setDefaultTimeout(5000);const results=[];
for(const [name,width,height] of [['wide',1920,1080],['desktop',1366,900],['tablet',768,1024],['phone',390,844],['landscape',844,390]]){
await page.setViewportSize({width,height});await page.goto(pathToFileURL(path.join(out,'index.html')).href);await page.locator('#start').click();
await page.waitForSelector('[data-caresuite-workflow-feedback]');
await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.keyboard.press('Escape');
const result=await page.evaluate(()=>{const h=document.querySelector('[data-caresuite-workflow-feedback]');const r=h.getBoundingClientRect();return {clicks:window.clicks,focused:document.activeElement===h,inert:document.getElementById('root').inert,overflow:document.documentElement.scrollWidth>innerWidth,viewport:r.width===innerWidth&&r.height===innerHeight};});
if(result.clicks!==1||!result.focused||!result.inert||result.overflow||!result.viewport)throw new Error(name+JSON.stringify(result));
await page.screenshot({path:path.join(out,name+'.png')});
await page.evaluate(()=>window.setPending(false));await page.waitForSelector('[data-caresuite-workflow-feedback]',{state:'detached'});
if(await page.locator('#root').evaluate(e=>e.inert))throw new Error('background remained locked');
results.push({name,...result});
}
await browser.close();if(errors.length)throw new Error(errors.join('\n'));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
