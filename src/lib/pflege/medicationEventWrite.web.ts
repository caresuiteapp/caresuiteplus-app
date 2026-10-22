import {recordMedicationEvent} from './medicationAdministrationService';
import {isMedicationGiven} from './medicationAdministrationDomain.ts';

/** An assessment is not a shared, serialized PRN administration protocol. */
export function medicationActualWriteIssueWeb(order:{isPrn:unknown},payload:{status:unknown}):string|null{
 if(typeof payload.status!=='string'||!isMedicationGiven(payload.status))return null;
 if(typeof order.isPrn!=='boolean')return 'Die Verordnungsart ist ungeklärt. Eine tatsächliche Gabe kann nicht bestätigt werden.';
 if(order.isPrn)return 'Bedarfsgaben können noch nicht gespeichert werden. Mindestabstand und Höchstmenge müssen über alle tatsächlichen Gaben und Schreibwege verbindlich geprüft werden. Eine Grenzprüfung allein gibt die Gabe nicht frei.';
 return null;
}

/** Web boundary only; native callers retain their existing implementation. */
export async function recordMedicationEventWeb(...args:Parameters<typeof recordMedicationEvent>):Promise<Awaited<ReturnType<typeof recordMedicationEvent>>>{
 let original:Parameters<typeof recordMedicationEvent>;
 try{original=structuredClone(args);}catch{return {ok:false,error:'Der ursprüngliche Gabeauftrag konnte nicht unverändert erfasst werden.',...(args[6]?{uncertain:true}:{})};}
 const [order,tenantId,actorId,requestId,payload,role,replay=false]=original;
 const issue=medicationActualWriteIssueWeb(order,payload);
 if(issue)return {ok:false,error:replay?'Die frühere Bedarfsgabe bleibt ungeklärt. Eine erneute Schreibanfrage ist gesperrt, bis ihr ursprünglicher Ausgang unabhängig bestätigt werden kann.':issue,...(replay?{uncertain:true}:{})};
 return recordMedicationEvent(order,tenantId,actorId,requestId,payload,role,replay);
}
