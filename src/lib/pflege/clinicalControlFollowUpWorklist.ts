import {controlQueue} from './clinicalControlDomain.ts';
import {controlFollowUps,type ControlFollowUpRelation} from './clinicalControlFollowUps.ts';
import type {ControlRecord} from './clinicalControlGateway.ts';
export type ControlFollowUpFilter='all'|'referenced'|'open_follow_up'|'missing_target'|'needs_comparison';
export function controlFollowUpNeedsComparison(r:ControlFollowUpRelation):boolean{return r.comparison!=='open_at_recording'||r.targetState?.status==='not_fulfilled'||r.targetState?.status==='cancelled';}

/** Whole client histories first; all existing task statuses and native queue ordering are retained. */
export function controlFollowUpWorklist(records:ControlRecord[],tenant:string,client:string,now=Date.now()){
 const full=controlFollowUps(records,tenant,client,now),queue=controlQueue(full.originals,now),byId=new Map(full.originals.map(r=>[r.task.id,r]));
 const incoming=new Map<string,ControlFollowUpRelation[]>(),outgoing=new Map<string,ControlFollowUpRelation[]>();
 for(const relation of full.relations){for(const [index,id] of [[incoming,relation.targetTaskId],[outgoing,relation.originTaskId]] as const){const group=index.get(id)??[];group.push(relation);index.set(id,group);}}
 const rows=[...queue.open,...queue.closed].map(state=>{const inward=incoming.get(state.task.id)??[],outward=outgoing.get(state.task.id)??[];return {...state,record:byId.get(state.task.id)!,incoming:inward,outgoing:outward,needsComparison:[...inward,...outward].some(controlFollowUpNeedsComparison)};});
 return {checkedAt:full.checkedAt,rows,total:rows.length,open:queue.open.length,closed:queue.closed.length,referenced:rows.filter(r=>r.incoming.length>0).length,openFollowUps:rows.filter(r=>r.status==='open'&&r.incoming.length>0).length,missingTargets:new Set(full.relations.filter(r=>!r.target).map(r=>r.targetTaskId)).size,needsComparison:rows.filter(r=>r.needsComparison).length};
}
/** Filter only a projection that has passed the full current data/time boundary. */
export function selectControlFollowUpWorklist(full:ReturnType<typeof controlFollowUpWorklist>,filter:ControlFollowUpFilter){
 if(!['all','referenced','open_follow_up','missing_target','needs_comparison'].includes(filter))throw Error('Folgeauftragsfilter ungültig.');
 const visible=full.rows.filter(r=>filter==='all'||filter==='referenced'&&r.incoming.length>0||filter==='open_follow_up'&&r.status==='open'&&r.incoming.length>0||filter==='missing_target'&&r.outgoing.some(link=>!link.target)||filter==='needs_comparison'&&r.needsComparison);
 return {...full,visible,matching:visible.length};
}
