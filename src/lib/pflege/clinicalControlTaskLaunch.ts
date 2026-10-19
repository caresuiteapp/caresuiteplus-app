import {woundUuid} from './woundCareDomain.ts';
import {decodeControlSnapshot,type ControlRecord} from './clinicalControlGateway.ts';
import {clinicalControlVersion} from './clinicalControlDomain.ts';
export type ControlTaskLaunch={clientId:string;taskId:string};
/** Routes carry native IDs only; the complete task is reloaded under current account rights. */
export function parseControlTaskLaunch(params:Record<string,unknown>):ControlTaskLaunch|null{
 if(params.taskId===undefined)return null;
 if(![params.clientId,params.taskId].every(v=>woundUuid(v)&&v===v.toLowerCase())||['sourceId','sourceKind','evaluationMeasureId'].some(k=>params[k]!==undefined))throw Error('Auftragsverknüpfung ungültig oder mit einer anderen Belegverknüpfung vermischt.');
 return {clientId:params.clientId as string,taskId:params.taskId as string};
}
export function resolveControlTaskLaunch(launch:ControlTaskLaunch,records:ControlRecord[],tenant:string,client:string,now=Date.now()):ControlRecord{
 const parsed=parseControlTaskLaunch(launch);if(!parsed||parsed.clientId!==client)throw Error('Auftragsverknüpfung gehört nicht zur ausgewählten Pflegeakte.');
 const full=decodeControlSnapshot({version:clinicalControlVersion,tenantId:tenant,clientId:client,count:records.length,tasks:records},tenant,client,now),record=full.find(r=>r.task.id===parsed.taskId);
 if(!record)throw Error('Verknüpfter Auftrag ist im vollständigen aktuell zugänglichen Bestand nicht vorhanden.');
 return record;
}
