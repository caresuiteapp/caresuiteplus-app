import {SQLiteStorage} from 'expo-sqlite/kv-store';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import clone from '@ungap/structured-clone';
import NetInfo from '@react-native-community/netinfo';
import {useContext,useMemo} from 'react';
import {AccessibilityInfo,Alert,AppState,Appearance,Dimensions} from 'react-native';
import {synchronousWorkflowStore,nativeWorkflowLocks} from './nativeWorkflowStore.shared';
import {nativeWorkflowLifecycle,type LifecycleListener} from './nativeWorkflowLifecycle.shared';
import {nativeWorkspaceNodes} from './nativeWorkspaceNodes.shared';
import {NativeWorkflowPageContext} from '@/components/navigation/NativeWorkflowPageContext.shared';
import {NativeByteBlob} from './nativeByteBlob.shared';
export type nativeBlob=Blob;
export const nativeBlob:typeof Blob=NativeByteBlob;
export {platformFetch as nativeFetch} from './platformFetch.native';
export {nativeURL} from './nativeObjectUrl.native';

// Workflow journals are independent from authentication and portal preferences.
export const nativeLocalStorage=synchronousWorkflowStore(new SQLiteStorage('caresuite-workflow-journals-v1.db'));
export const nativeSessionStorage=synchronousWorkflowStore(new SQLiteStorage('caresuite-workflow-drafts-v1.db'));
export const nativeStructuredClone=<T,>(value:T):T=>typeof globalThis.structuredClone==='function'?globalThis.structuredClone(value):clone(value);
export const nativeCrypto={randomUUID:Crypto.randomUUID,getRandomValues:Crypto.getRandomValues,subtle:{digest(algorithm:AlgorithmIdentifier,data:BufferSource){const name=typeof algorithm==='string'?algorithm:algorithm.name;if(!Object.values(Crypto.CryptoDigestAlgorithm).includes(name as Crypto.CryptoDigestAlgorithm))throw Error('Der angeforderte Datei-Hash wird nicht unterstützt.');return Crypto.digest(name as Crypto.CryptoDigestAlgorithm,data);}}};
let connected=false,reducedMotion=true;
NetInfo.addEventListener(state=>{connected=state.isConnected===true&&state.isInternetReachable!==false;});
void AccessibilityInfo.isReduceMotionEnabled().then(value=>{reducedMotion=value;});
AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{reducedMotion=value;});
export const nativeNavigator={get onLine(){return connected;},locks:nativeWorkflowLocks(),clipboard:{writeText:Clipboard.setStringAsync}};
const lifecycle=new Map<LifecycleListener,Map<string,{remove():void}>>();
function addLifecycle(name:string,handler:LifecycleListener,_options?:unknown){
  if(name==='storage')return; // Native shares one document and one SQLite connection.
  const handlers=lifecycle.get(handler)??new Map();if(handlers.has(name))return;
  if(name==='online'||name==='offline'){let before:boolean|null=null;const unsubscribe=NetInfo.addEventListener(state=>{const next=state.isConnected===true&&state.isInternetReachable!==false;if(name==='online'&&next&&before!==true||name==='offline'&&!next&&before===true)handler({type:name});before=next;});handlers.set(name,{remove:unsubscribe});}
  else if(name==='resize'||name==='orientationchange'){handlers.set(name,Dimensions.addEventListener('change',()=>handler({type:name})));}
  else if(['visibilitychange','focus','blur','pageshow','pagehide'].includes(name))handlers.set(name,AppState.addEventListener('change',state=>{if(name==='visibilitychange'||['focus','pageshow'].includes(name)&&state==='active'||['blur','pagehide'].includes(name)&&state!=='active')handler({type:name});}));
  lifecycle.set(handler,handlers);
}
function removeLifecycle(name:string,handler:LifecycleListener,_options?:unknown){const handlers=lifecycle.get(handler);handlers?.get(name)?.remove();handlers?.delete(name);if(!handlers?.size)lifecycle.delete(handler);}
export const nativeDocument={get visibilityState(){return AppState.currentState==='active'?'visible':'hidden';},get hidden(){return AppState.currentState!=='active';},get activeElement(){return nativeWorkspaceNodes.active as unknown as HTMLElement|null;},getElementById:(id:string)=>nativeWorkspaceNodes.get(id) as unknown as HTMLElement|null,addEventListener:addLifecycle,removeEventListener:removeLifecycle};
export const nativeWindow={localStorage:nativeLocalStorage,sessionStorage:nativeSessionStorage,crypto:nativeCrypto,get innerWidth(){return Dimensions.get('window').width;},get innerHeight(){return Dimensions.get('window').height;},setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,alert:(message:string)=>Alert.alert('CareSuite',message),matchMedia(query:string){let matches=false;if(query.includes('prefers-reduced-motion'))matches=reducedMotion;else if(query.includes('prefers-color-scheme'))matches=query.includes('dark')===(Appearance.getColorScheme()==='dark');else {const bound=query.match(/(min|max)-width:\s*(\d+)px/);if(!bound)throw Error('Die Medienabfrage ist für diese native Ansicht nicht umgesetzt.');matches=bound[1]==='min'?Dimensions.get('window').width>=Number(bound[2]):Dimensions.get('window').width<=Number(bound[2]);}return {matches};},addEventListener:addLifecycle,removeEventListener:removeLifecycle};
export function useNativeWorkflowWindow(){const owner=useContext(NativeWorkflowPageContext);return useMemo(()=>({...nativeWindow,addEventListener(name:string,handler:LifecycleListener,options?:unknown){if(name==='beforeunload')nativeWorkflowLifecycle.add(owner,handler);else addLifecycle(name,handler,options);},removeEventListener(name:string,handler:LifecycleListener,options?:unknown){if(name==='beforeunload')nativeWorkflowLifecycle.remove(owner,handler);else removeLifecycle(name,handler,options);}}),[owner]);}
