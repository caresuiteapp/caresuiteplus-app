import test from 'node:test';
import assert from 'node:assert/strict';
import {exportPlanReviewOverview} from '../../src/lib/careAssessment/planReviewExport.web.ts';
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
function host(options={}){
 const calls=[],blobs=[],timer=[];
 const link={remove:()=>calls.push('remove'),click:()=>{calls.push('click');if(options.clickError)throw Error('Download failed');}};
 const page={opener:{},document:{open:()=>calls.push('open'),write:html=>{calls.push('write');assert.match(html,/Aktuelle Einzelmaßnahmenprüfungen/);},close:()=>calls.push('document-close')},focus:()=>calls.push('focus'),print:()=>{calls.push('print');if(options.printError)throw Error('Print failed');},close:()=>calls.push('window-close')};
 const original={window:globalThis.window,document:globalThis.document,setTimeout:globalThis.setTimeout,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
 globalThis.window={open:()=>options.blocked?null:page};globalThis.document={createElement:()=>link,body:{appendChild:()=>calls.push('append')}};
 URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:local-test';};URL.revokeObjectURL=url=>calls.push('revoke:'+url);globalThis.setTimeout=fn=>timer.push(fn);
 return {calls,blobs,timer,page,link,restore(){if(original.window===undefined)delete globalThis.window;else globalThis.window=original.window;if(original.document===undefined)delete globalThis.document;else globalThis.document=original.document;globalThis.setTimeout=original.setTimeout;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;}};
}
import {plan,tenant,assessment,client} from './fixtures/plan-amendment.mjs';
const run=mode=>exportPlanReviewOverview(plan(),[],tenant,assessment,client,mode);
for(const mode of ['html','json'])test(`Actual ${mode} download builds expected bytes and cleans temporary link/URL`,async()=>{const h=host();try{run(mode);assert.deepEqual(h.calls,['append','click','remove']);assert.match(h.link.download,new RegExp('\\.'+mode+'$'));assert.equal(h.blobs[0].type,mode==='json'?'application/json;charset=utf-8':'text/html;charset=utf-8');const bytes=await h.blobs[0].text();if(mode==='json')assert.equal(JSON.parse(bytes).overview.total,2);else assert.match(bytes,/2 Maßnahmen/);assert.equal(h.timer.length,1);h.timer[0]();assert.equal(h.calls.at(-1),'revoke:blob:local-test');}finally{h.restore();}});
test('Failed download cleans temporary objects immediately without pretending success',()=>{const h=host({clickError:true});try{assert.throws(()=>run('html'),/Download failed/);assert.deepEqual(h.calls,['append','click','remove','revoke:blob:local-test']);assert.equal(h.timer.length,0);}finally{h.restore();}});
test('Print uses isolated local document and does not create downloadable objects',()=>{const h=host();try{run('print');assert.equal(h.page.opener,null);assert.deepEqual(h.calls,['open','write','document-close','focus','print']);assert.equal(h.blobs.length,0);}finally{h.restore();}});
test('Blocked print window exposes a recoverable error and creates no file',()=>{const h=host({blocked:true});try{assert.throws(()=>run('print'),/Druckfenster wurde blockiert/);assert.equal(h.blobs.length,0);assert.deepEqual(h.calls,[]);}finally{h.restore();}});
test('Failed print closes the incomplete window and preserves error',()=>{const h=host({printError:true});try{assert.throws(()=>run('print'),/Print failed/);assert.equal(h.calls.at(-1),'window-close');}finally{h.restore();}});
test('Unknown output format is rejected before downloading any clinical information',()=>{const h=host();try{assert.throws(()=>run('csv'),/Unbekanntes/);assert.equal(h.blobs.length,0);assert.deepEqual(h.calls,[]);}finally{h.restore();}});
test('No DOM cannot be treated as a successful export',()=>{assert.throws(()=>run('html'),/Webansicht/);});
test('Invalid file scope blocks download and print before side effects',()=>{const h=host();try{for(const mode of ['html','json','print'])assert.throws(()=>exportPlanReviewOverview(plan(),[],tenant,'foreign',client,mode));assert.deepEqual(h.calls,[]);assert.equal(h.blobs.length,0);}finally{h.restore();}});
