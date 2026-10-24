// Temporary local test process, backed by the same migration as production.
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {consultationFixture,id} from '../supabase/tests/consultation_workspace_fixture.mjs';
export async function startConsultationFixture({seed=false}={}){
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const output=resolve(root,'.audit-consultation');mkdirSync(output,{recursive:true});
 await build({entryPoints:[resolve(root,'scripts/fixtures/consultation/preview.tsx')],bundle:true,platform:'browser',format:'esm',jsx:'automatic',outfile:resolve(output,'preview.js'),define:{'process.env.EXPO_PUBLIC_CONSULTATION_WORKSPACE_ENABLED':'"true"'},tsconfigRaw:{compilerOptions:{jsx:'react-jsx'}},plugins:[{name:'test-session',setup(b){b.onResolve({filter:/^(expo-router|@\/lib\/auth\/context|@\/hooks\/usePortalActor|@\/hooks\/usePermissions|@\/lib\/supabase\/client)$/},()=>({path:resolve(root,'scripts/fixtures/consultation/adapters.ts')}));b.onResolve({filter:/^@\//},args=>b.resolve(resolve(root,'src',args.path.slice(2)),{kind:args.kind,resolveDir:args.resolveDir}));}}]});
 const f=await consultationFixture();
 if(seed){
  for(const kind of ['37_3','45'])await f.mutate('qualify',{employee_id:id(41),service_kind:kind,valid_from:'2025-01-01',valid_until:'2035-01-01',evidence:'Synthetischer Prüfnachweis',active:true});
  for(const [index,name,kind] of [[0,'Erika Sommer','37_3'],[1,'Wolfgang Richter','45'],[2,'Helga Neumann','37_3'],[3,'Friedrich Weber','45'],[4,'Anna Bergmann','37_3']]){
   const client=index===0?id(50):id(70+index);if(index){await f.owner();await f.db.query("INSERT INTO clients(id,tenant_id,full_name,care_level,street,house_number,postal_code,city,insurance_name) VALUES($1,$2,$3,'3','Beispielweg',$4,'10115','Berlin','Beispiel-Pflegekasse')",[client,id(10),name,String(index+3)]);await f.actor();}
   let e=await f.mutate('create',{client_id:client,title:'Synthetische Fallakte',service_kind:kind,preparation:'Letzte Empfehlungen gemeinsam besprechen. Die Pflegeperson nimmt am Gespräch teil.'});
   e=await f.mutate('plan',{employee_id:id(41),scheduled_start:`2026-10-${20+index}T08:00:00Z`,scheduled_end:`2026-10-${20+index}T09:00:00Z` ,preparation:'Letzte Empfehlungen gemeinsam besprechen. Die Pflegeperson nimmt am Gespräch teil.'},e);
  }
 }
 let chain=Promise.resolve();
 const server=createServer((req,res)=>{if(req.url==='/preview.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(readFileSync(resolve(output,'preview.js')));return;}
  if(req.method==='POST'&&req.url==='/rpc'){
   let body='';req.on('data',chunk=>{body+=chunk;if(body.length>1200000)req.destroy();});req.on('end',()=>{chain=chain.then(async()=>{try{const{actor,args:a,name}=JSON.parse(body);await(actor==='portal'?f.portal():f.actor());let result;if(name==='consultation_workspace_load')result=await f.load(a.p_employee_view,a.p_case,a.p_tenant);else if(name==='consultation_workspace_mutate')result=await f.mutate(a.p_action,a.p_data,{id:a.p_encounter,version:a.p_version},a.p_request,a.p_tenant);else throw new Error('Unsupported test RPC');res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data:result,error:null}));}catch(e){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data:null,error:{code:e.code??'unknown',message:e.message}}));}});});return;
  }
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CareSuite Beratung · Isolierte Testdaten</title><style>html,body,#root{margin:0;height:100%;width:100%}body{background:#f3f8ff}#root{max-width:1490px;margin:auto}</style><div id="root"></div><script type="module" src="/preview.js"></script></html>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {url:`http://127.0.0.1:${server.address().port}`,output,fixture:f,close:async()=>{await new Promise(r=>server.close(r));await f.db.close();}};
}
if(process.argv.includes('--serve')){const server=await startConsultationFixture({seed:true});console.log(server.url);}
