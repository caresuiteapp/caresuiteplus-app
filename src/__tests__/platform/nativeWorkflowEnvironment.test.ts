import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import ts from 'typescript';
import {nativeWorkflowLocks,synchronousWorkflowStore} from '@/lib/platform/nativeWorkflowStore.shared';
import {nativeWorkflowLifecycle} from '@/lib/platform/nativeWorkflowLifecycle.shared';

const nodeRequire=createRequire(import.meta.url);

/** A fresh native-like realm with Expo's actual lazy installer and locked clone.
 * Node's eagerly available structuredClone would hide this import-order fault.
 * Native dependencies are inert; this exercises JS initialization, not devices.
 */
function coldExpoCloneRuntime(){
  const context=createContext({__DEV__:false,console,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{}});
  runInContext('global=globalThis',context);
  const cache=new Map<string,{exports:any}>();
  const clonePath=nodeRequire.resolve('@ungap/structured-clone');
  const installerPath=resolve(dirname(nodeRequire.resolve('expo/package.json')),'src/winter/installGlobal.ts');
  const environmentPath=resolve(process.cwd(),'src/lib/platform/nativeWorkflowEnvironment.native.ts');
  const inertSubscription=()=>({remove(){}});
  const nativeModules:Record<string,unknown>={
    'expo-sqlite/kv-store':{SQLiteStorage:class{}},
    'expo-crypto':{randomUUID:()=>'',getRandomValues:(value:unknown)=>value},
    'expo-clipboard':{setStringAsync:async()=>{}},
    '@react-native-community/netinfo':{addEventListener:()=>()=>{}},
    react:{useContext:()=>null,useMemo:(factory:()=>unknown)=>factory()},
    'react-native':{AccessibilityInfo:{isReduceMotionEnabled:async()=>false,addEventListener:inertSubscription},Alert:{alert(){}},AppState:{currentState:'active',addEventListener:inertSubscription},Appearance:{getColorScheme:()=>null},Dimensions:{get:()=>({width:800,height:1200}),addEventListener:inertSubscription}},
    '@/components/navigation/NativeWorkflowPageContext.shared':{NativeWorkflowPageContext:{}},
    './platformFetch.native':{platformFetch:async()=>{}},
    './nativeObjectUrl.native':{nativeURL:{}},
  };
  function load(filename:string):any{
    if(cache.has(filename))return cache.get(filename)!.exports;
    const module={exports:{}};
    // Match CommonJS/Metro's partially initialized exports during a cycle.
    cache.set(filename,module);
    let source=readFileSync(filename,'utf8');
    if(filename.endsWith('.ts'))source=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
    const execute=runInContext('(function(require,module,exports){\n'+source+'\n})',context,{filename});
    execute((name:string)=>{
      if(Object.hasOwn(nativeModules,name))return nativeModules[name];
      if(name==='@ungap/structured-clone')return load(clonePath);
      if(name.startsWith('.')){
        const path=resolve(dirname(filename),name);
        return load(path.endsWith('.js')?path:path+'.ts');
      }
      throw Error('Unexpected cold-start dependency: '+name);
    },module,module.exports);
    return module.exports;
  }
  load(installerPath).installGlobal('structuredClone',()=>load(clonePath).default);
  return {context,loadClone:()=>load(clonePath),loadEnvironment:()=>load(environmentPath)};
}

describe('Expo lazy structuredClone startup',()=>{
  it('reproduces the device exception when the implementation is imported before its global',()=>{
    const runtime=coldExpoCloneRuntime();
    expect(()=>runtime.loadClone()).toThrow(/Object\.defineProperty.*non-object/);
  });
  it('imports the actual native environment cold and clones through the Expo global without a cycle',()=>{
    const runtime=coldExpoCloneRuntime();
    const environment=runtime.loadEnvironment();
    runtime.context.clone=environment.nativeStructuredClone;
    const result=runInContext(`
      const original={date:new Date(123),map:new Map([['value',7]]),bytes:new Uint8Array([0,128,255])};
      original.self=original;
      const copy=clone(original);
      copy.bytes[0]=42;
      ({different:copy!==original,self:copy.self===copy,date:copy.date instanceof Date&&copy.date.getTime(),map:copy.map instanceof Map&&copy.map.get('value'),bytes:Array.from(copy.bytes),originalBytes:Array.from(original.bytes)});
    `,runtime.context);
    expect(result).toEqual({different:true,self:true,date:123,map:7,bytes:[42,128,255],originalBytes:[0,128,255]});
  });
});

describe('native workflow durability and ownership',()=>{
  it('does not dispatch a write after a failed synchronous journal commit',async()=>{let dispatched=false;const storage=synchronousWorkflowStore({getItemSync:()=>null,setItemSync:()=>{throw Error('disk full');},removeItemSync:()=>{},clearSync:()=>{},getKeyByIndexSync:()=>null,getLengthSync:()=>0});const send=async()=>{storage.setItem('tenant:client:actor','request-before-rpc');dispatched=true;};await expect(send()).rejects.toThrow('disk full');expect(dispatched).toBe(false);});
  it('keeps the same durable value when a new facade is created',()=>{const data=new Map<string,string>(),db={getItemSync:(key:string)=>data.get(key)??null,setItemSync:(key:string,value:string)=>{data.set(key,value);},removeItemSync:(key:string)=>data.delete(key),clearSync:()=>data.clear(),getKeyByIndexSync:(index:number)=>[...data.keys()][index]??null,getLengthSync:()=>data.size};synchronousWorkflowStore(db).setItem('a:b:c','pending-request');expect(synchronousWorkflowStore(db).getItem('a:b:c')).toBe('pending-request');expect(synchronousWorkflowStore(db).getItem('a:b:other-actor')).toBeNull();});
  it('denies overlapping nonblocking requests and releases a failed operation',async()=>{const locks=nativeWorkflowLocks();let release!:()=>void;const first=locks.request('same',{},async()=>{await new Promise<void>(resolve=>{release=resolve;});throw Error('network');});expect(await locks.request('same',{ifAvailable:true},async lock=>lock===null)).toBe(true);expect(await locks.request('other',{ifAvailable:true},async lock=>!!lock)).toBe(true);release();await expect(first).rejects.toThrow('network');expect(await locks.request('same',{ifAvailable:true},async lock=>!!lock)).toBe(true);});
  it('queues waiting requests in order',async()=>{const locks=nativeWorkflowLocks(),order:number[]=[];await Promise.all([1,2,3].map(n=>locks.request('journal',{},async()=>{order.push(n);await Promise.resolve();})));expect(order).toEqual([1,2,3]);});
  it('vetoes navigation only for the owning page and unregisters it',()=>{const handler=(event:any)=>event.preventDefault();nativeWorkflowLifecycle.add('page-a',handler);expect(nativeWorkflowLifecycle.mayLeave('page-a')).toBe(false);expect(nativeWorkflowLifecycle.mayLeave('page-b')).toBe(true);nativeWorkflowLifecycle.remove('page-a',handler);expect(nativeWorkflowLifecycle.mayLeave('page-a')).toBe(true);});
  it('lets the active form own one leave question and restores the page guard after it closes',()=>{const owner='deduplicated-form',other='another-page',listener=(event:any)=>event.preventDefault();nativeWorkflowLifecycle.add(owner,listener);nativeWorkflowLifecycle.add(other,listener);expect(nativeWorkflowLifecycle.needsPageGuard(owner)).toBe(true);nativeWorkflowLifecycle.setDedicatedGuard(owner,'form',true);expect(nativeWorkflowLifecycle.needsPageGuard(owner)).toBe(false);expect(nativeWorkflowLifecycle.needsPageGuard(other)).toBe(true);nativeWorkflowLifecycle.setDedicatedGuard(owner,'form',false);expect(nativeWorkflowLifecycle.needsPageGuard(owner)).toBe(true);nativeWorkflowLifecycle.remove(owner,listener);nativeWorkflowLifecycle.remove(other,listener);});

});
