// Component layout check using existing Playwright/esbuild. Synthetic input only.
const fs=require('node:fs');const path=require('node:path');
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=modules?require(path.join(modules,'playwright')):require('playwright');
const dir=process.env.INTAKE_IDENTITY_QA_DIR||'/tmp/caresuite-intake-identity-qa';
(async()=>{const browser=await chromium.launch({headless:true});const checks=[];try{
 for(const [name,width,height,scale] of [['wide',1440,960,1],['compact',960,800,1],['narrow',390,844,1],['minimum-large-text',320,720,1.4]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort());
  await page.setContent(fs.readFileSync(path.join(dir,'index.html'),'utf8'));await page.addScriptTag({content:fs.readFileSync(path.join(dir,'intake.js'),'utf8')});await page.waitForFunction(()=>!!window.intakeQA);
  await page.getByText('Vorhandene Person oder neue Aufnahme?',{exact:true}).waitFor();
  if(scale!==1)await page.evaluate(scale=>{for(const element of document.querySelectorAll('#preview *'))if([...element.childNodes].some(node=>node.nodeType===3&&node.textContent.trim())){const s=getComputedStyle(element);element.style.fontSize=`${parseFloat(s.fontSize)*scale}px`;const line=parseFloat(s.lineHeight);if(Number.isFinite(line))element.style.lineHeight=`${line*scale}px`;}},scale);
  const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('#preview *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1);}).slice(0,8).map(el=>({text:el.textContent.slice(0,70),width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))}));
  await page.screenshot({path:path.join(dir,`${name}.png`),fullPage:true});
  if(geometry.scroll>width+1||geometry.overflow.length)throw Error(`${name}: horizontal overflow ${JSON.stringify(geometry)}`);
  const count=await page.getByRole('button',{name:'Diese bestehende Akte öffnen',exact:true}).count();if(count!==10)throw Error('Initial visible candidate count must be ten.');
  await page.getByRole('button',{name:/Weitere Personen anzeigen/}).click();if(await page.getByRole('button',{name:'Diese bestehende Akte öffnen',exact:true}).count()!==12)throw Error('More must expose the two already delivered candidates.');
  await page.getByRole('button',{name:'Diese bestehende Akte öffnen',exact:true}).first().click();if(!await page.evaluate(()=>window.intakeQA.events.some(event=>event.startsWith('existing:'))))throw Error('Existing selection callback not delivered.');
  checks.push({name,width,height,textScale:scale,horizontalOverflow:false,visibleMore:12,existingCallback:true,pageErrors:errors});
  for(const scenario of ['exact','denied','error','empty']){
   await page.evaluate(value=>window.intakeQA.setScenario(value),scenario);
   if(scenario==='exact'){await page.getByText(/Übereinstimmende Identitätsmerkmale gefunden/).waitFor();if(await page.getByRole('button',{name:'Als neue Person fortfahren',exact:true}).count())throw Error('Exact conflict exposes creation.');}
   if(scenario==='error')await page.getByText('Die vorhandenen Personen konnten nicht vollständig geprüft werden. Ihre Eingaben bleiben erhalten.',{exact:true}).waitFor();
   if(scenario==='empty')await page.getByRole('button',{name:'Als neue Person fortfahren',exact:true}).waitFor();
   await page.screenshot({path:path.join(dir,`${name}-${scenario}.png`),fullPage:true});
  }
  if(errors.length)throw Error(errors.join('\n'));await page.close();
 }
 fs.writeFileSync(path.join(dir,'layout-result.json'),JSON.stringify({scope:'real React/React-Native-Web panel and project UI components with synthetic data/callbacks; no full app, Metro, auth or SDK acceptance',checks},null,2)+'\n');console.log(JSON.stringify({ok:true,viewports:checks.length,result:path.join(dir,'layout-result.json')}));
}finally{await browser.close();}})().catch(error=>{console.error(error.stack);process.exitCode=1;});
