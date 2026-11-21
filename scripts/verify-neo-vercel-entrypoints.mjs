import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ts from 'typescript';
const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const typescriptFiles = ['api/neo/status.ts', 'api/neo/transcribe.ts', 'api/_lib/neo-vercel-handler.ts', 'api/_lib/neo-vercel-runtime.ts'];
const runtimeFiles = ['api/_lib/neo-vercel-engine.mjs', 'api/_lib/neo-wasm-worker.cjs', 'api/_lib/neo-wasm-runtime.cjs', 'api/_lib/neo-readiness-fixture.json'];
const childSource = String.raw`
'use strict';
const fs = require('node:fs');
const fixture = JSON.parse(fs.readFileSync('./api/_lib/neo-readiness-fixture.json', 'utf8'));
const scope = {tenantId:'11111111-1111-4111-8111-111111111111',actorId:'22222222-2222-4222-8222-222222222222'};
const requireReady = process.env.NEO_PROBE_REQUIRE_READY === '1', transcribe = process.env.NEO_PROBE_TRANSCRIBE === '1';
let fetches = 0;
globalThis.fetch = async (input, options = {}) => {
  const url = String(input); fetches++;
  if (!url.startsWith('https://neo-entrypoint-fixture.invalid/')) throw Error('Unexpected network destination in isolated NEO probe.');
  if (url === 'https://neo-entrypoint-fixture.invalid/auth/v1/user') return new Response(JSON.stringify({id:scope.actorId}));
  if (url === 'https://neo-entrypoint-fixture.invalid/rest/v1/rpc/neo_desktop_voice_authorize' && options.method === 'POST') {
    if (JSON.parse(options.body).p_tenant_id !== scope.tenantId) throw Error('Unexpected synthetic tenant.');
    return new Response('true');
  }
  throw Error('Unexpected network operation in isolated NEO probe.');
};
function response() {
  return {code:0,body:null,headers:{},status(code){this.code=code;return this;},setHeader(name,value){this.headers[name]=value;},json(value){this.body=value;return value;}};
}
async function invoke(handler, authenticated, audio) {
  const result=response();await handler({method:'POST',headers:authenticated?{authorization:'Bearer synthetic.jwt.token'}:{},body:{scope,...(audio?{audio}:{})}},result);return result;
}
(async()=>{
  // These are the actual emitted CommonJS entrypoints. With require-ESM disabled,
  // a static MJS import fails here before a handler can return its first 401.
  const status=require('./api/neo/status.js').default;
  const speech=require('./api/neo/transcribe.js').default;
  const unauthorizedStatus=await invoke(status,false), unauthorizedSpeech=await invoke(speech,false);
  if(unauthorizedStatus.code!==401||unauthorizedSpeech.code!==401)throw Error('NEO entrypoint authorization bootstrap failed.');
  const readiness=await invoke(status,true);
  if(readiness.code!==200||readiness.body?.ok!==true||typeof readiness.body.transcriptionReady!=='boolean')throw Error('NEO authorized readiness endpoint failed.');
  if(requireReady&&!readiness.body.transcriptionReady)throw Error('NEO bundled runtime is not ready through its emitted entrypoint.');
  let transcriptionStatus=null,syntheticTranscriptionPassed=null;
  if(transcribe||!readiness.body.transcriptionReady){
    const answer=await invoke(speech,true,fixture.audioBase64);transcriptionStatus=answer.code;
    if(!readiness.body.transcriptionReady){if(answer.code!==503||answer.body?.ok!==false)throw Error('Missing NEO assets were incorrectly accepted.');}
    else{
      const text=typeof answer.body?.text==='string'?answer.body.text:'';
      const normalized=text.normalize('NFKC').toLocaleLowerCase('de-DE').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
      if(answer.code!==200||answer.body?.ok!==true||!['keine schmerzen','neo','blutdruck','morgen'].every(phrase=>(' '+normalized+' ').includes(' '+phrase+' ')))throw Error('NEO emitted transcription endpoint failed its synthetic German probe.');
      syntheticTranscriptionPassed=true;
    }
  }
  console.log(JSON.stringify({entrypoints:['status','transcribe'],requireEsmDisabled:true,unauthenticated:{status:unauthorizedStatus.code,transcribe:unauthorizedSpeech.code},authorizedStatus:readiness.code,transcriptionReady:readiness.body.transcriptionReady,backend:readiness.body.backend??null,transcriptionStatus,syntheticTranscriptionPassed,isolatedBackendFetches:fetches,noLiveBackend:true}));
})().catch(error=>{console.error(error?.code==='ERR_REQUIRE_ESM'?'ERR_REQUIRE_ESM':'NEO_ENTRYPOINT_PROBE_FAILED');process.exitCode=1;});
`;

/**
 * Exercise the actual emitted API files with Vercel's require-ESM restriction.
 * Only synthetic authorization responses are supplied; no live session is used.
 * @param {{assetDirectory?: string, requireReady?: boolean, transcribe?: boolean}} [options]
 */
export async function verifyNeoVercelEntrypoints(options = {}) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'neo runtime entry '));
  const task = path.join(temporary, 'var', 'task');
  try {
    await fs.mkdir(task, {recursive:true});
    await fs.writeFile(path.join(task,'package.json'), JSON.stringify({type:'commonjs'}));
    for (const file of typescriptFiles) {
      const source = await fs.readFile(path.join(root,file),'utf8');
      const compiled=ts.transpileModule(source,{fileName:path.join(task,file),compilerOptions:{module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,target:ts.ScriptTarget.ES2022,verbatimModuleSyntax:false}});
      const target=path.join(task,file.replace(/\.ts$/,'.js'));await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,compiled.outputText);
    }
    for(const file of runtimeFiles){const target=path.join(task,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(root,file),target);}
    const assets=path.join(task,'api/_lib/neo-assets');
    if(options.assetDirectory)await fs.symlink(path.resolve(options.assetDirectory),assets,process.platform==='win32'?'junction':'dir');
    else await fs.mkdir(assets,{recursive:true});
    await fs.writeFile(path.join(task,'probe.cjs'),childSource);
    const env={NODE_ENV:'test',EXPO_PUBLIC_SUPABASE_URL:'https://neo-entrypoint-fixture.invalid',EXPO_PUBLIC_SUPABASE_ANON_KEY:'synthetic-public-key',NEO_PROBE_REQUIRE_READY:options.requireReady?'1':'0',NEO_PROBE_TRANSCRIBE:options.transcribe?'1':'0'};
    for(const name of ['PATH','Path','SystemRoot','WINDIR','TMP','TEMP','TMPDIR'])if(typeof process.env[name]==='string')env[name]=process.env[name];
    let result;
    try{result=await run(process.execPath,['--no-experimental-require-module','probe.cjs'],{cwd:task,env,timeout:options.transcribe?120000:30000,maxBuffer:1024*1024,windowsHide:true});}
    catch(error){const marker=String(error.stderr??'').includes('ERR_REQUIRE_ESM')?'ERR_REQUIRE_ESM':'isolated CommonJS entrypoint probe';throw Error('NEO Vercel API verification failed: '+marker);}
    const lines=result.stdout.trim().split(/\r?\n/).filter(Boolean);const summary=JSON.parse(lines.at(-1)??'null');
    if(summary?.requireEsmDisabled!==true||summary?.noLiveBackend!==true)throw Error('NEO Vercel API verification did not return a valid result.');
    return summary;
  } finally {await fs.rm(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)verifyNeoVercelEntrypoints().then(summary=>console.log(JSON.stringify(summary))).catch(error=>{console.error(error.message);process.exitCode=1;});
