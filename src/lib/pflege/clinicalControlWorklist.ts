import {validateEvaluationControlSnapshot} from '../careAssessment/planEvaluationControl.ts';
import {validateProtocolControlSnapshot} from './dailyProtocolControl.ts';
import {clinicalControlVersion,controlReadModel,type ControlSource,type ControlState} from './clinicalControlDomain.ts';
import {decodeControlSnapshot,type ControlRecord} from './clinicalControlGateway.ts';
import {decodeControlSources} from './clinicalControlRuntime.ts';
import {emptyControlForm,type ControlForm} from './clinicalControlForm.ts';
import {validateTreatmentSource} from './treatmentCorrectionDomain.ts';
import {treatmentProfileVersion,treatmentProfiles} from './treatmentExecutionDomain.ts';
import {validateInfusionRequest} from './infusionCourseGateway.ts';
import {sameWoundJson,woundInstant,woundUuid} from './woundCareDomain.ts';

export type ControlLaunch={clientId:string;sourceKind:'treatment_execution'|'infusion_event'|'protocol_event'|'plan_evaluation';sourceId:string;evaluationMeasureId?:string};
export function parseControlLaunch(params:Record<string,unknown>):ControlLaunch|null{
 const values=[params.clientId,params.sourceKind,params.sourceId];if(values.every(v=>v===undefined)&&params.evaluationMeasureId===undefined)return null;
 if(values.some(v=>typeof v!=='string')||!woundUuid(params.clientId)||params.clientId!==params.clientId.toLowerCase()||!woundUuid(params.sourceId)||params.sourceId!==params.sourceId.toLowerCase()||!['treatment_execution','infusion_event','protocol_event','plan_evaluation'].includes(String(params.sourceKind)))throw Error('Belegverknüpfung unvollständig oder ungültig. Pflegefall und Originalbeleg erneut auswählen.');
 if(params.evaluationMeasureId!==undefined&&(params.sourceKind!=='plan_evaluation'||!woundUuid(params.evaluationMeasureId)||params.evaluationMeasureId!==params.evaluationMeasureId.toLowerCase()))throw Error('Originalmaßnahmen-Verknüpfung ungültig.');
 return {...(params.evaluationMeasureId!==undefined?{evaluationMeasureId:params.evaluationMeasureId as string}:{}),clientId:params.clientId,sourceKind:params.sourceKind as ControlLaunch['sourceKind'],sourceId:params.sourceId};
}
export const controlSourceKey=(s:Pick<ControlSource,'kind'|'id'>)=>s.kind+':'+s.id;
export type ControlAgreement={evaluationMeasureId?:string;key:string;source:ControlSource;state:'scheduled'|'pending'|'not_required'|'completed'|'unavailable';reason:string;dueAt:string;occurredAt:string;title:string;issue:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Only explicit original fields. No text extraction, medical interval or current clinical need inferred. */
function agreement(source:ControlSource,now:number):ControlAgreement{
 const s=source.snapshot,r:ControlAgreement={key:controlSourceKey(source),source:structuredClone(source),state:'unavailable',reason:'',dueAt:'',occurredAt:'',title:typeof s.title==='string'?s.title:source.id,issue:''};
 try{
  let d:Record<string,unknown>,due:unknown;
  if(source.kind==='treatment_execution'){
   validateTreatmentSource(s);if(typeof s.details!=='string')throw Error('Keine angebundene strukturierte Kontrollvereinbarung.');d=JSON.parse(s.details);
   if(!object(d)||d.profileVersion!==treatmentProfileVersion||!Object.hasOwn(treatmentProfiles,String(d.treatmentType))||d.clientId!==s.client_id||d.treatmentType!==s.treatment_type||d.title!==s.title||d.outcome!==s.outcome||woundInstant(d.occurredAt)!==woundInstant(s.performed_at))throw Error('Strukturierte Vereinbarung und Originalnachweis passen nicht zusammen.');due=d.nextReviewAt;
  }else if(source.kind==='plan_evaluation'){
   validateEvaluationControlSnapshot(s,String(s.tenant_id),String(s.client_id),now);d=s.draft.entry as Record<string,unknown>;due=d.reviewAt;r.title=s.title;
  }else if(source.kind==='protocol_event'){
   validateProtocolControlSnapshot(s,String(s.tenant_id),String(s.client_id),now);d=s.draft.entry as Record<string,unknown>;due=d.reviewAt;r.title=s.title;
  }else{
   validateInfusionRequest(String(s.tenant_id),s.request_payload,now);const payload=s.request_payload as {episode:{id:string;clientId:string;title:string};draft:Record<string,unknown>};
   if(payload.episode.id!==s.episode_id||payload.episode.clientId!==s.client_id||!sameWoundJson(payload.draft,s.draft))throw Error('Infusionsvereinbarung und Originalereignis passen nicht zusammen.');d=payload.draft;due=d.reviewAt;r.title=payload.episode.title;
  }
  const at=woundInstant(source.kind==='plan_evaluation'?d.evaluatedAt:d.occurredAt),recorded=woundInstant(s.created_at??s.recorded_at);
  if(at===null||recorded===null||at>BigInt(now)*1000n||recorded<at||recorded>BigInt(now)*1000n||typeof d.reviewReason!=='string'||!d.reviewReason.trim()||d.reviewReason.length>4000||typeof due!=='string')throw Error('Originalzeitpunkt oder Kontrollvereinbarung unvollständig.');
  const state=String(d.reviewState);if(!['scheduled','pending','not_required','completed'].includes(state)||state==='completed'&&(source.kind!=='infusion_event'||d.kind!=='review')||d.kind==='review'&&state!=='completed')throw Error('Kontrollzustand nicht eindeutig belegt.');
  if(state==='scheduled'?(woundInstant(due)===null||(['protocol_event','plan_evaluation'].includes(source.kind)?woundInstant(due)!<at:woundInstant(due)!<=at)):due!=='')throw Error('Originalfrist widerspricht der Kontrollvereinbarung.');
  return {...r,state:state as ControlAgreement['state'],reason:d.reviewReason,dueAt:due,occurredAt:String(source.kind==='plan_evaluation'?d.evaluatedAt:d.occurredAt)};
 }catch(e){return {...r,issue:e instanceof Error?e.message:'Originalvereinbarung nicht lesbar.'};}
}
export function controlAgreementQueue(sources:ControlSource[],records:ControlRecord[],tenant:string,client:string,now=Date.now()){
 if(!Number.isSafeInteger(now))throw Error('Auswertungszeitpunkt ungültig.');
 const originals=decodeControlSources({version:clinicalControlVersion,tenantId:tenant,clientId:client,count:sources.length,sources},tenant,client);
 const full=decodeControlSnapshot({version:clinicalControlVersion,tenantId:tenant,clientId:client,count:records.length,tasks:records},tenant,client,now);
 const linked=new Map<string,{record:ControlRecord;state:ReturnType<typeof controlReadModel>;sameOriginal:boolean}[]>();
 for(const record of full){const state=controlReadModel(record.task,record.events,now),key=controlSourceKey(state.source),items=linked.get(key)??[];items.push({record,state,sameOriginal:false});linked.set(key,items);}
 const protocolLinked=new Map<string,{record:ControlRecord;state:ReturnType<typeof controlReadModel>;sameOriginal:boolean}[]>();
 for(const items of linked.values())for(const item of items)if(['protocol_event','plan_evaluation'].includes(item.state.source.kind)){const root=item.state.source.kind+':'+String(item.state.source.snapshot.root_id),sameRoot=protocolLinked.get(root)??[];sameRoot.push(item);protocolLinked.set(root,sameRoot);}
 const rows=originals.filter(s=>['treatment_execution','infusion_event','protocol_event','plan_evaluation'].includes(s.kind)).flatMap(s=>{
  const agreements=[agreement(s,now)];
  if(s.kind==='plan_evaluation'){validateEvaluationControlSnapshot(s.snapshot,tenant,client,now);const snapshot=s.snapshot;
   for(const review of snapshot.draft.entry!.measureReviews??[]){const m=snapshot.plan.measures.find(m=>m.id===review.measureId)!;agreements.push({key:controlSourceKey(s)+':'+review.measureId,source:agreements[0].source,evaluationMeasureId:review.measureId,title:m.title!,state:review.reviewState as ControlAgreement['state'],reason:review.reviewReason,dueAt:review.reviewAt,occurredAt:snapshot.draft.entry!.evaluatedAt,issue:''});}
  }
  const associated=['protocol_event','plan_evaluation'].includes(s.kind)?(protocolLinked.get(s.kind+':'+String(s.snapshot.root_id))??[]):(linked.get(controlSourceKey(s))??[]);
  return agreements.map(a=>{const matches=associated.filter(l=>a.evaluationMeasureId?!l.state.evaluationMeasureId||l.state.evaluationMeasureId===a.evaluationMeasureId:!l.state.evaluationMeasureId).map(l=>({...l,sameOriginal:sameWoundJson(l.state.source.snapshot,s.snapshot)}));
   const current=matches.filter(l=>l.sameOriginal),needsReview=['scheduled','pending'].includes(a.state)&&!current.some(l=>l.state.status==='open'||l.state.status==='completed');
   return {...a,originalOverdue:a.state==='scheduled'&&woundInstant(a.dueAt)!<=BigInt(now)*1000n,linked:matches,needsReview};
  });
 });
 rows.sort((a,b)=>{const at=a.dueAt?woundInstant(a.dueAt):null,bt=b.dueAt?woundInstant(b.dueAt):null;return at===null?(bt===null?a.key.localeCompare(b.key):1):bt===null?-1:at<bt?-1:at>bt?1:a.key.localeCompare(b.key);});
 return {rows,count:rows.length,withoutLinkedTask:rows.filter(r=>['scheduled','pending'].includes(r.state)&&!r.linked.length).length,unavailable:rows.filter(r=>r.state==='unavailable').length,needsReview:rows.filter(r=>r.needsReview).length};
}
export function adoptControlAgreement(a:ControlAgreement):ControlForm{
 if(!['scheduled','pending'].includes(a.state)||a.issue)throw Error('Nur eine ausdrücklich vereinbarte oder offene Originalkontrolle übernehmen.');
 return {...emptyControlForm(),kind:'create',sourceKey:controlSourceKey(a.source),evaluationMeasureId:a.evaluationMeasureId??'',reason:a.reason,dueAt:a.dueAt};
}
/** Source is reloaded under current account rights; URLs carry no clinical snapshot. */
export function resolveControlLaunch(launch:ControlLaunch,sources:ControlSource[],records:ControlRecord[],tenant:string,client:string,now=Date.now()){
 if(launch.clientId!==client)throw Error('Belegverknüpfung gehört zu einer anderen Pflegeakte.');
 const parsed=parseControlLaunch(launch);if(!parsed)throw Error('Belegverknüpfung fehlt.');
 const q=controlAgreementQueue(sources,records,tenant,client,now),row=q.rows.find(r=>r.source.kind===launch.sourceKind&&r.source.id===launch.sourceId&&(r.evaluationMeasureId??'')===(launch.evaluationMeasureId??''));
 if(!row)throw Error('Originalbeleg nicht mehr zugänglich, berichtigt oder nicht vollständig geladen. Keine automatische Übernahme.');return row;
}
export function pendingControlResponses(state:ControlState,actorId:string){
 if(!woundUuid(actorId)||actorId!==actorId.toLowerCase())throw Error('Rückmeldungsperson ungültig.');if(state.status!=='open')return [];
 const acknowledged=new Set(state.acknowledgements.flatMap(e=>e.draft.kind==='acknowledge'?[e.draft.escalationEventId]:[]));
 return state.escalations.filter(e=>e.draft.kind==='escalate'&&e.draft.policyEventId===state.policyEventId&&e.draft.delivery==='sent'&&e.draft.recipientId===actorId&&!acknowledged.has(e.id)).map(e=>structuredClone(e));
}
export function controlEditorRevision(record:ControlRecord|null,current:ControlRecord[],tenant:string,client:string,now=Date.now()):string|null{
 const loaded=decodeControlSnapshot({version:clinicalControlVersion,tenantId:tenant,clientId:client,count:current.length,tasks:current},tenant,client,now);if(!record)return null;
 if(record.task.tenantId!==tenant||record.task.clientId!==client)throw Error('Bearbeiteter Kontrollauftrag fremd.');
 decodeControlSnapshot({version:clinicalControlVersion,tenantId:tenant,clientId:client,count:1,tasks:[record]},tenant,client,now);const latest=loaded.find(r=>r.task.id===record.task.id);
 if(!latest)return 'Auftrag nicht mehr zugänglich. Zur Übersicht zurückkehren und Originalbestand neu laden.';
 if(latest.headId!==record.headId||latest.eventCount!==record.eventCount||!sameWoundJson(latest.events,record.events))return 'Auftrag inzwischen geändert. Zur Übersicht zurückkehren und aktuelle Auftragsfassung öffnen.';
 if(!sameWoundJson(latest.actorNames,record.actorNames))return 'Gesicherte historische Personenbelege inzwischen geändert. Zur Übersicht zurückkehren und vollständige Originalfassung prüfen.';
 return null;
}
export function controlMatchesPerson(state:ControlState,actorId:string,filter:string):boolean{
 if(!['all','responsible','responses'].includes(filter))throw Error('Persönlicher Kontrollfilter unbekannt.');
 if(filter==='all')return true;if(!woundUuid(actorId)||actorId!==actorId.toLowerCase())throw Error('Aktive eigene Person für Kontrollfilter fehlt.');
 return filter==='responsible'?state.status==='open'&&(state.policy.assigneeId===actorId||state.policy.backupId===actorId):pendingControlResponses(state,actorId).length>0;
}
