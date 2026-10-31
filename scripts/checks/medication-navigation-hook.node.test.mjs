import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
for (const platform of ['web','native']) {
const test=(name,run)=>nodeTest(platform+': '+name,run);
const source=readFileSync(new URL('../../src/hooks/useUnsavedWebChanges.'+platform+'.ts',import.meta.url),'utf8');
const body=stripTypeScriptTypes(source.replace(/^import .*\n/gm,'').replaceAll('export ',''));
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function world(initial={}){
 const state={dirty:true,busy:false,message:'Original leave prompt',epoch:1,owner:'own',...initial},slots=[],prompts=[],dispatches=[],listeners=new Map();let index=0,api;
 const navigation={dispatch:action=>dispatches.push(action)},env={handler:null,prevent:false};
 const useRef=value=>{const i=index++;return slots[i]??(slots[i]={current:value});};
 const useCallback=fn=>fn;
 const useEffect=(fn,deps)=>{const i=index++,old=slots[i];if(!old||!deps||deps.length!==old.deps?.length||deps.some((v,j)=>v!==old.deps[j])){old?.cleanup?.();slots[i]={deps,cleanup:fn()};}};
 const capture=()=>{if(state.captureThrow)throw Error('lost owner');if(state.captureNull)return null;const epoch=state.epoch,owner=state.owner;return()=>{if(state.checkThrow)throw Error('lost scope');return epoch===state.epoch&&owner===state.owner;};};
 const run=new Function('useRef','useCallback','useEffect','useNavigation','usePreventRemove',platform==='web'?'confirmAction':'confirmNativeWorkspaceAction','window',body+'\nreturn useUnsavedWebChanges;')(useRef,useCallback,useEffect,()=>state.navigation??navigation,(prevent,handler)=>{env.prevent=prevent;env.handler=handler;},()=>new Promise((resolve,reject)=>prompts.push({resolve,reject})),{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:(k,v)=>{if(listeners.get(k)===v)listeners.delete(k);}});
 const render=()=>{index=0;api=run(state.dirty,state.busy,state.message,state.noCapture?undefined:capture);return api;};render();
 return {state,env,prompts,dispatches,listeners,render,get api(){return api;},navigate(action={type:'BACK'}){env.handler({data:{action}});},dispose(){for(const slot of slots)slot?.cleanup?.();}};
}
test('Real route removal requires the accepted original prompt and dispatches exactly once',async()=>{const w=world(),action={type:'BACK',key:'own-route'};w.navigate(action);assert.equal(w.env.prevent,true);assert.equal(w.prompts.length,1);w.prompts[0].resolve(true);await settle();assert.deepEqual(w.dispatches,[action]);});
for(const change of ['busy','dirty','message','owner','epoch','navigation','noCapture'])test(`Pending real route removal rejects changed ${change}`,async()=>{const w=world();w.navigate();if(change==='busy')w.state.busy=true;else if(change==='dirty')w.state.dirty=false;else if(change==='message')w.state.message='Changed';else if(change==='owner')w.state.owner='other';else if(change==='epoch')w.state.epoch++;else if(change==='navigation')w.state.navigation={dispatch:()=>assert.fail('new route')};else w.state.noCapture=true;w.render();w.prompts[0].resolve(true);await settle();assert.equal(w.dispatches.length,0);});
test('Synchronous write/phase change without React rerender invalidates the captured route decision',async()=>{const w=world();w.navigate();w.state.epoch++;w.prompts[0].resolve(true);await settle();assert.equal(w.dispatches.length,0);});
test('Owner is checked again immediately before dispatch after the confirmation await',async()=>{const w=world();w.navigate();w.prompts[0].resolve(true);queueMicrotask(()=>{w.state.owner='other';});await settle();assert.equal(w.dispatches.length,0);});
test('Local explicit leave uses the same owner guard as real route removal',async()=>{const w=world(),pending=w.api();w.state.epoch++;w.prompts[0].resolve(true);assert.equal(await pending,false);assert.equal(w.dispatches.length,0);});
test('Busy state rejects local and route removal without opening a prompt',async()=>{const w=world({busy:true});assert.equal(await w.api(),false);w.navigate();await settle();assert.equal(w.prompts.length,0);assert.equal(w.dispatches.length,0);});
test('Clean current form can leave without a prompt and without a forced route dispatch',async()=>{const w=world({dirty:false});assert.equal(await w.api(),true);assert.equal(w.env.prevent,false);assert.equal(w.prompts.length,0);assert.equal(w.dispatches.length,0);});
test('A second remove event cannot consume or duplicate the first open confirmation',async()=>{const w=world();w.navigate({type:'FIRST'});w.navigate({type:'SECOND'});await settle();assert.equal(w.prompts.length,1);w.prompts[0].resolve(true);await settle();assert.deepEqual(w.dispatches,[{type:'FIRST'}]);});
for(const issue of ['captureThrow','captureNull','checkThrow'])test(`Invalid navigation capture ${issue} stays closed before any prompt`,async()=>{const w=world({[issue]:true});assert.equal(await w.api(),false);w.navigate();await settle();assert.equal(w.prompts.length,0);assert.equal(w.dispatches.length,0);});
test('Unmount rejects an already accepted prompt before route dispatch',async()=>{const w=world();w.navigate();w.dispose();w.prompts[0].resolve(true);await settle();assert.equal(w.dispatches.length,0);});
test('Rejected prompt transport releases its lock and never dispatches',async()=>{const w=world();w.navigate();w.prompts[0].reject(Error('dialog unavailable'));await settle();assert.equal(w.dispatches.length,0);w.navigate();assert.equal(w.prompts.length,2);w.prompts[1].resolve(false);await settle();assert.equal(w.dispatches.length,0);});
if(platform==='web')test('Browser reload guard is registered only for dirty/busy state and held callbacks reread current state',()=>{const w=world(),unload=w.listeners.get('beforeunload'),a={preventDefault(){this.prevented=true;}};unload(a);assert.equal(a.prevented,true);assert.equal(a.returnValue,'');w.state.dirty=false;w.render();assert.equal(w.listeners.has('beforeunload'),false);const b={preventDefault(){this.prevented=true;}};unload(b);assert.equal(b.prevented,undefined);});
test('Existing callers without an optional owner capture still reject busy changes during confirmation',async()=>{const w=world({noCapture:true}),pending=w.api();w.state.busy=true;w.render();w.prompts[0].resolve(true);assert.equal(await pending,false);});

if(platform==='native')test('Native route guard does not register a browser unload listener',()=>{const w=world();assert.equal(w.listeners.size,0);w.dispose();});
}
