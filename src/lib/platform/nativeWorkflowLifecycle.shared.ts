export type LifecycleListener=(event:any)=>void;
const dedicated=new Map<string,Set<string>>(),listeners=new Map<string,Set<LifecycleListener>>(),subscribers=new Set<()=>void>();
const emit=()=>{for(const listener of subscribers)listener();};
export const nativeWorkflowLifecycle={
  subscribe(listener:()=>void){subscribers.add(listener);return()=>{subscribers.delete(listener);};},
  setDedicatedGuard(owner:string,key:string,active:boolean){const set=dedicated.get(owner)??new Set<string>();if(active){if(set.has(key))return;set.add(key);dedicated.set(owner,set);}else{if(!set.delete(key))return;if(!set.size)dedicated.delete(owner);}emit();},
  needsPageGuard:(owner:string)=>(listeners.get(owner)?.size??0)>0&&(dedicated.get(owner)?.size??0)===0,
  count:(owner:string)=>listeners.get(owner)?.size??0,
  add(owner:string,listener:LifecycleListener){const set=listeners.get(owner)??new Set();set.add(listener);listeners.set(owner,set);emit();},
  remove(owner:string,listener:LifecycleListener){const set=listeners.get(owner);if(set?.delete(listener)){if(!set.size)listeners.delete(owner);emit();}},
  mayLeave(owner:string){const event={defaultPrevented:false,returnValue:undefined as unknown,preventDefault(){this.defaultPrevented=true;}};for(const listener of listeners.get(owner)??[])listener(event);return !event.defaultPrevented&&event.returnValue===undefined;},
};
