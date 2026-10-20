import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import { transform } from 'esbuild';

const root = process.cwd();
const publicRoot = resolve(root, 'public');
const out = resolve(root, '.google-workspace-qa/public-branding');
mkdirSync(out, { recursive: true });
const routes = ['/caresuite', '/datenschutz', '/nutzungsbedingungen', '/impressum'];
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
for (const route of routes) {
  assert.equal(config.rewrites.find(row=>row.source===route)?.destination, route+'/index.html');
  const html=readFileSync(resolve(publicRoot,route.slice(1),'index.html'),'utf8');
  assert.ok(html.includes('CareSuite Software Technologie'));
  assert.ok(!html.includes('caresuiteplus.de'));
  assert.ok(!html.includes('<script'), 'Public information must not depend on client-side JavaScript.');
}
const webScreen = 'src/liquid-command/screens/AccessHubBaseScreen.web.tsx';
await transform(readFileSync(webScreen,'utf8'), {loader:'tsx',jsx:'automatic'});
await transform(readFileSync('src/lib/platform/supportLinks.web.ts','utf8'), {loader:'ts'});
const server = createServer((req,res)=>{
  const url = new URL(req.url,'http://localhost');
  const route = config.rewrites.find(row=>row.source===url.pathname && row.source!=='/(.*)');
  const file=resolve(publicRoot,'.'+(route?.destination??url.pathname));
  if(!file.startsWith(publicRoot)||!existsSync(file)){res.writeHead(404);res.end('Not found');return;}
  res.setHeader('content-type',({'.html':'text/html; charset=utf-8','.png':'image/png','.ttf':'font/ttf'})[extname(file)]??'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
const report=[];
try {
  const page=await browser.newPage();
  const failures=[];
  page.on('pageerror',error=>failures.push(error.message));
  page.on('response',response=>{if(response.status()>=400)failures.push(`${response.status()} ${response.url()}`);});
  for(const variant of [{name:'desktop',width:1440,height:1000,fontSize:16},{name:'mobile',width:390,height:844,fontSize:16},{name:'compact',width:320,height:800,fontSize:16},{name:'large-text',width:900,height:1000,fontSize:24}]){
    await page.setViewportSize({width:variant.width,height:variant.height});
    for(const route of routes){
      const response=await page.goto(base+route);
      assert.equal(response.status(),200);
      await page.evaluate(async(fontSize)=>{document.documentElement.style.fontSize=fontSize+'px';await document.fonts.ready;},variant.fontSize);
      assert.equal(await page.getByRole('heading',{level:1}).count(),1);
      const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,headerOverlap:document.querySelector('.wordmark').getBoundingClientRect().right>document.querySelector('.top-actions').getBoundingClientRect().left,brokenImages:[...document.images].filter(img=>!img.complete||img.naturalWidth===0).map(img=>img.src),missingAnchors:[...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href').slice(1)).filter(id=>!document.getElementById(id))}));
      assert.equal(metrics.overflow,false,`${variant.name} ${route} overflows`);
      assert.equal(metrics.headerOverlap,false,`${variant.name} ${route} header overlaps`);
      assert.deepEqual(metrics.brokenImages,[]);
      assert.deepEqual(metrics.missingAnchors,[]);
      const navLinks=await page.locator('footer nav a').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
      assert.deepEqual(navLinks,routes);
      if(variant.name==='desktop'||variant.name==='mobile')await page.screenshot({path:resolve(out,variant.name+'-'+route.slice(1)+'.png')});
      if(route==='/datenschutz'||route==='/nutzungsbedingungen'){
        await page.locator('summary').click();
        await page.locator('.toc a').first().click();
        assert.match(page.url(),/#abschnitt-/);
      }
      report.push({view:variant.name,route,status:response.status(),...metrics});
    }
  }
  await page.goto(base+'/caresuite');
  await page.getByRole('link',{name:'Wie CareSuite Google-Daten verarbeitet'}).click();
  assert.ok(page.url().endsWith('/datenschutz#google-workspace'));
  assert.equal(await page.getByRole('heading',{name:'Google-Kontodaten und Ihre Freigaben'}).count(),1);
  assert.deepEqual(failures,[]);
  writeFileSync(resolve(out,'results.json'),JSON.stringify({report,failures},null,2));
  console.log(JSON.stringify({passed:report.length,failures,checks:'public HTTP routes, responsive overflow, 150% text, images, navigation, anchors, disclosure link, TSX compilation',screenshots:out}));
} finally {
  await browser.close();
  server.close();
}
