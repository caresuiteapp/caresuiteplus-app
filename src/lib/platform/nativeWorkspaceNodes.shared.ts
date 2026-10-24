export type WorkspaceHandle={focus():void;scrollIntoView?(options?:unknown):void;props?:Record<string,any>;[key:string]:unknown};
const nodes=new Map<string,WorkspaceHandle>();let active:WorkspaceHandle|null=null;
export const nativeWorkspaceNodes={register(id:string,handle:WorkspaceHandle){nodes.set(id,handle);return()=>{if(nodes.get(id)===handle)nodes.delete(id);if(active===handle)active=null;};},get:(id:string)=>nodes.get(id)??null,focus(handle:WorkspaceHandle|null){active=handle;},get active(){return active;},all:()=>[...nodes.values()]};
