import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { createContext,runInContext } from 'node:vm';
import { test } from 'node:test';

const source=await readFile(new URL('../public/platform-observation.js',import.meta.url),'utf8');
const release='caresuite-platform-operations-20261007';
const flush=()=>new Promise(resolve=>setTimeout(resolve,20));
function fixture({ready=false,collectorRelease=release,dnt='0',gpc=false,hostname='www.caresuiteplus.app',offline=false}={}){
  const requests=[];const windowEvents={};const documentEvents={};const intervals=[];let visible='visible';
  const context=createContext({URL,Response,AbortController,Uint8Array,crypto:webcrypto,console,setTimeout,clearTimeout,
    setInterval:(fn,delay)=>intervals.push({fn,delay}),
    navigator:{doNotTrack:dnt,globalPrivacyControl:gpc},
    window:{location:{hostname,href:'https://www.caresuiteplus.app/landingpage?token=private'},addEventListener:(name,fn)=>windowEvents[name]=fn},
    document:{get visibilityState(){return visible;},addEventListener:(name,fn)=>documentEvents[name]=fn},
    fetch:async(url,init)=>{
      if(offline)throw new Error('offline');
      requests.push({url,init,body:init?.body?JSON.parse(init.body):null});
      return new Response(JSON.stringify(url.includes('/rpc/')?{release,inventoryReady:true,observationReady:ready}:{release:collectorRelease,ready:true}),{status:200});
    }});
  runInContext(source,context);
  return {requests,windowEvents,documentEvents,intervals,hide(){visible='hidden';},context};
}
test('public pages do not send visitor identities before approval',async()=>{
  const f=fixture();await flush();
  assert.equal(f.requests.length,1);assert.deepEqual(f.requests[0].body,{});
  for(const timer of f.intervals)timer.fn();await flush();
  assert.equal(f.requests.some(x=>x.body?.sessionId),false);
});
test('privacy signals and preview hosts suppress all public observation requests',async()=>{
  for(const options of [{dnt:'1'},{gpc:true},{hostname:'preview.vercel.app'}]){
    const f=fixture(options);await flush();assert.equal(f.requests.length,0);
  }
});
test('approved static pages report only a random active view and promptly mark hidden pages inactive',async()=>{
  const f=fixture({ready:true});await flush();const first=f.requests.find(x=>x.body?.kind==='heartbeat');
  assert.equal(first.body.surface,'website');assert.equal(first.body.active,true);
  assert.match(first.body.sessionSecret,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(first.body).includes('private'),false);
  f.hide();f.documentEvents.visibilitychange();await flush();
  const last=f.requests.at(-1);assert.equal(last.body.active,false);assert.equal(last.init.keepalive,true);
  f.windowEvents.pagehide();await flush();assert.equal(f.requests.at(-1).body.sessionId,first.body.sessionId);
});
test('collector release mismatch and network failure leave public collection inactive',async()=>{
  for(const options of [{ready:true,collectorRelease:'old'},{ready:true,offline:true}]){
    const f=fixture(options);await flush();assert.equal(f.requests.some(x=>x.body?.sessionId),false);
  }
});
test('public error reports contain no error text, resource URL or form values',async()=>{
  const f=fixture({ready:true});await flush();
  f.windowEvents.error({message:'private password',filename:'https://site/?token=private'});await flush();
  const event=f.requests.find(x=>x.body?.kind==='error');assert.equal(event.body.category,'render');assert.equal(event.body.operation,'page');
  assert.equal(JSON.stringify(event.body).includes('private'),false);
});
test('loading the public helper twice creates one lifecycle and one release check',async()=>{
  const f=fixture();runInContext(source,f.context);await flush();
  assert.equal(f.requests.length,1);assert.equal(f.intervals.length,2);
});
