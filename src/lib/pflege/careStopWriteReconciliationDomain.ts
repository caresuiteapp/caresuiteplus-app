export type CareStopWriteOperation='emergency_open'|'emergency_event'|'stop_completion';
export type CareStopWriteReconciliationRequest=Readonly<{operation:CareStopWriteOperation;requestId:string;payload:Readonly<Record<string,unknown>>}>;
export type CareStopWriteReconciliation=Readonly<{state:'confirmed'|'not_found'|'conflict';operation:CareStopWriteOperation;requestId:string;serverCheckedAt:string;message:string;recordId?:string;stopId?:string;recordedAt?:string;requestFingerprint?:string}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const instant=(value:unknown)=>typeof value==='string'&&!Number.isNaN(Date.parse(value));
const exact=(value:Record<string,unknown>,keys:readonly string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

export function freezeCareStopWriteRequest(operation:CareStopWriteOperation,requestId:string,payload:Record<string,unknown>):CareStopWriteReconciliationRequest{
 if(!uuid.test(requestId)||!payload||Array.isArray(payload)||Object.getPrototypeOf(payload)!==Object.prototype)throw new Error('Anfrage-ID und eingefrorene Nutzdaten sind ungültig.');
 return Object.freeze({operation,requestId,payload:Object.freeze(structuredClone(payload))});
}

export function decodeCareStopWriteReconciliation(value:unknown,request:CareStopWriteReconciliationRequest):CareStopWriteReconciliation{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Der Serverabgleich enthält keine prüfbare Rückmeldung.');
 const row=value as Record<string,unknown>;const state=row.state;
 const common=['state','operation','requestId','serverCheckedAt','message'] as const;
 if(!['confirmed','not_found','conflict'].includes(String(state))||row.operation!==request.operation||row.requestId!==request.requestId||!instant(row.serverCheckedAt)||typeof row.message!=='string'||!row.message.trim())throw new Error('Der Serverabgleich gehört nicht zur unveränderten Anfrage.');
 if(state!=='confirmed'){
  if(!exact(row,common))throw new Error('Die offene Serverrückmeldung enthält unerwartete Belegdaten.');
  return Object.freeze({state,operation:request.operation,requestId:request.requestId,serverCheckedAt:row.serverCheckedAt as string,message:row.message}) as CareStopWriteReconciliation;
 }
 const confirmed=[...common,'recordId','stopId','recordedAt','requestFingerprint'] as const;
 if(!exact(row,confirmed)||!uuid.test(String(row.recordId))||!uuid.test(String(row.stopId))||!instant(row.recordedAt)||!/^[0-9a-f]{32}$/.test(String(row.requestFingerprint)))throw new Error('Der bestätigte Originalbeleg ist unvollständig.');
 return Object.freeze({state:'confirmed',operation:request.operation,requestId:request.requestId,serverCheckedAt:row.serverCheckedAt as string,message:row.message,recordId:row.recordId as string,stopId:row.stopId as string,recordedAt:row.recordedAt as string,requestFingerprint:row.requestFingerprint as string});
}
