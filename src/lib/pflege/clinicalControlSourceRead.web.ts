import {clinicalControlVersion,type ControlSource} from './clinicalControlDomain.ts';
import {decodeControlSnapshot,type ControlRecord} from './clinicalControlGateway.ts';
import {controlSourcePermissions} from './clinicalControlRuntime.ts';
import {clinicalControlSourceComparison} from './clinicalControlSourceComparison.ts';
import {sameWoundJson} from './woundCareDomain.ts';

const readKeys=['pflege.documentation.view','pflege.treatment.view','pflege.orders.view','pflege.plans.view','pflege.medications.view','pflege.vitals.view','pflege.wounds.view'] as const;
type ReadKey=typeof readKeys[number];
export type ClinicalControlReadPermissions=Record<ReadKey,boolean>;
export type ClinicalControlSourceReadInput={tenantId:string;clientId:string;records:ControlRecord[]|null;sources:ControlSource[]|null;retainedRecordPools?:ControlRecord[][];retainedSourcePools?:ControlSource[][];permissions:ClinicalControlReadPermissions;now?:number};

/** Include every established read flag even when no source is currently loaded. This signature is not permission-loading readiness. */
export function clinicalControlSourceReadSignature(permissions:ClinicalControlReadPermissions):string{return readKeys.map(key=>permissions?.[key]===true?'1':'0').join('');}
function completeList<T>(values:T[]):T[]{if(!Array.isArray(values))throw Error('Vollständige Original- und Quellenpools müssen als Listen vorliegen.');return Array.from(values);}
function decodeRecords(records:ControlRecord[],tenant:string,client:string,now:number){const tasks=completeList(records);return decodeControlSnapshot({version:clinicalControlVersion,tenantId:tenant,clientId:client,count:tasks.length,tasks},tenant,client,now);}
function originalSources(records:ControlRecord[]){return records.flatMap(record=>record.events.flatMap(event=>'source' in event.draft?[event.draft.source]:'evidence' in event.draft&&event.draft.evidence?[event.draft.evidence]:[]));}
function assertNativeOriginals(records:ControlRecord[]){
 const tasks=new Map<string,ControlRecord['task']>(),events=new Map<string,{event:ControlRecord['events'][number];actorName:string}>(),requests=new Map<string,string>(),sequences=new Map<string,string>();
 for(const record of records){
  const task=tasks.get(record.task.id);if(task&&!sameWoundJson(task,record.task))throw Error('Dieselbe native Auftragskennung widerspricht ihrer unveränderten Originalidentität.');tasks.set(record.task.id,record.task);
  for(const event of record.events){
   const saved=events.get(event.id),requestEvent=requests.get(event.requestId),actorName=record.actorNames[event.id],sequenceKey=`${record.task.id}:${event.sequence}`,sequenceEvent=sequences.get(sequenceKey);
   if(saved&&(!sameWoundJson(saved.event,event)||saved.actorName!==actorName))throw Error('Dieselbe native Ereigniskennung widerspricht ihrem vollständigen unveränderten Original.');
   if(requestEvent&&requestEvent!==event.id)throw Error('Eine native Anfragekennung wurde für unterschiedliche Originalereignisse verwendet.');
   if(sequenceEvent&&sequenceEvent!==event.id)throw Error('Dieselbe native Auftragssequenz widerspricht ihrer unveränderten Originalereigniskennung.');
   events.set(event.id,{event,actorName});requests.set(event.requestId,event.id);sequences.set(sequenceKey,event.id);
  }
 }
}
function requiredPermissions(sources:ControlSource[]):ReadKey[]{
 const needed=new Set<string>(readKeys.slice(0,3));
 for(const source of sources)for(const permission of controlSourcePermissions(source.kind,String(source.snapshot.treatment_type??'')))needed.add(permission);
 return readKeys.filter(key=>needed.has(key));
}

/** Validate whole supplied native pools before projecting current runtime rights. No clinical conclusion, filtered pool, backend readiness or replay authorization is produced. */
export function clinicalControlSourceReadProjection({tenantId,clientId,records,sources,retainedRecordPools=[],retainedSourcePools=[],permissions,now=Date.now()}:ClinicalControlSourceReadInput){
 if((records!==null&&!Array.isArray(records))||(sources!==null&&!Array.isArray(sources)))throw Error('Kontrolloriginal- und Quellenabfragen müssen ausdrücklich als fehlend oder als vollständige Listen vorliegen.');
 const current=decodeRecords(records??[],tenantId,clientId,now),retained=completeList(retainedRecordPools).flatMap(pool=>decodeRecords(pool,tenantId,clientId,now));
 // A retained earlier prefix is legitimate; every repeated native event/request must still be the same immutable original.
 assertNativeOriginals([...current,...retained]);
 const currentSources=clinicalControlSourceComparison([],completeList(sources??[]),tenantId,clientId,now).sources;
 const preservedSources=completeList(retainedSourcePools).flatMap(pool=>clinicalControlSourceComparison([],completeList(pool),tenantId,clientId,now).sources);
 const originalRequiredPermissions=requiredPermissions([...originalSources(current),...originalSources(retained),...preservedSources]);
 const sourceRequiredPermissions=requiredPermissions(currentSources);
 const originalMissingPermissions=originalRequiredPermissions.filter(key=>permissions?.[key]!==true),sourceMissingPermissions=sourceRequiredPermissions.filter(key=>permissions?.[key]!==true);
 const canReadOriginals=originalMissingPermissions.length===0,canReadSources=sourceMissingPermissions.length===0;
 return {
  scope:{tenantId,clientId},permissionSignature:clinicalControlSourceReadSignature(permissions),
  canReadOriginals,canReadSources,canReadComparison:canReadOriginals&&canReadSources,
  originalRequiredPermissions,sourceRequiredPermissions,originalMissingPermissions,sourceMissingPermissions,
  originalPoolStatus:records===null?'not_loaded' as const:'provided' as const,sourcePoolStatus:sources===null?'not_loaded' as const:'provided' as const,
 };
}
