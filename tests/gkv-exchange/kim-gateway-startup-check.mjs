// Run with CommonJS -> ESM require disabled, as on the Vercel runtime that
// returned ERR_REQUIRE_ESM before it could answer even a GET. Do not bundle:
// bundling would hide a broken require() at exactly this boundary.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const tmp=await mkdtemp(join(tmpdir(),'caresuite-kim-gateway-'));
const originalFetch=globalThis.fetch;
let calls=0;
try {
  assert.equal(process.features.require_module,false,'This test must run without the require(ESM) bridge.');
  await build({absWorkingDir:root,entryPoints:['api/gkv/kim-host.ts','api/_lib/kim-host-gateway.ts',
    'src/lib/gkvExchange/kimHostContract.ts','src/lib/gkvExchange/kimReceiveContract.ts'],
    bundle:false,platform:'node',format:'cjs',target:'node20',outbase:root,outdir:tmp,logLevel:'silent'});
  // The legacy ESM adapter is deliberately present: accidentally restoring
  // a CommonJS require of it must fail for the same reason as the deployed bug.
  for(const file of ['kim-host-transport.cjs','kim-host-handler.mjs','kim-host-transport.mjs'])
    await copyFile(join(root,'api/_lib',file),join(tmp,'api/_lib',file));
  await writeFile(join(tmp,'package.json'),'{"type":"commonjs"}');
  globalThis.fetch=async()=>{calls++;throw Error('Unexpected network access for a rejected request');};
  const handler=createRequire(join(tmp,'package.json'))('./api/gkv/kim-host.js').default;
  const tenantId='81bd07c1-ea07-47c2-998e-b435c395e3a1';
  for(const [name,req,code,error] of [
    ['GET',{method:'GET',headers:{}},405,'KIM_HOST_METHOD'],
    ['unauthenticated POST',{method:'POST',headers:{},body:{action:'status',tenantId}},401,'KIM_HOST_AUTH'],
    ['caller-supplied host',{method:'POST',headers:{authorization:'Bearer synthetic'},body:{action:'status',tenantId,url:'https://other.invalid'}},400,'KIM_HOST_INPUT'],
  ]){
    const res={headers:{},setHeader(key,value){this.headers[key]=value;},status(n){this.code=n;return this;},json(v){this.body=v;}};
    await handler(req,res);assert.equal(res.code,code);assert.deepEqual(res.body,{error});
    assert.equal(res.headers['Cache-Control'],'private, no-store');assert.equal(res.headers['X-Content-Type-Options'],'nosniff');
    if(code===405)assert.equal(res.headers.Allow,'POST');assert.equal(calls,0);
    console.log('ok - compiled KIM gateway: '+name+' → '+code);
  }
} finally {globalThis.fetch=originalFetch;await rm(tmp,{recursive:true,force:true});}
