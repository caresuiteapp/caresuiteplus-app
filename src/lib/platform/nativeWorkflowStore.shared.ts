export type SynchronousKeyValueStore = { getItemSync(key:string):string|null;setItemSync(key:string,value:string):void;removeItemSync(key:string):unknown;clearSync():unknown;getKeyByIndexSync(index:number):string|null;getLengthSync():number };
export function synchronousWorkflowStore(database:SynchronousKeyValueStore):Storage {
  return {get length(){return database.getLengthSync();},key:index=>database.getKeyByIndexSync(index),getItem:key=>database.getItemSync(String(key)),setItem:(key,value)=>{database.setItemSync(String(key),String(value));},removeItem:key=>{database.removeItemSync(String(key));},clear:()=>{database.clearSync();}};
}
/** One native JS runtime; the server retains cross-device and idempotency checks. */
export function nativeWorkflowLocks(){
  const held=new Set<string>(),waiting=new Map<string,(()=>void)[]>();
  return {async request<T>(name:string,options:{ifAvailable?:boolean;mode?:string},action:(lock:{name:string;mode:'exclusive'}|null)=>Promise<T>):Promise<T>{
    if(options.mode&&options.mode!=='exclusive')throw Error('Nur exklusive Fachvorgänge werden unterstützt.');
    if(held.has(name)){if(options.ifAvailable)return action(null);await new Promise<void>(resolve=>waiting.set(name,[...(waiting.get(name)??[]),resolve]));}
    held.add(name);try{return await action({name,mode:'exclusive'});}finally{const queue=waiting.get(name),next=queue?.shift();if(!queue?.length)waiting.delete(name);if(next)next();else held.delete(name);}
  }};
}
