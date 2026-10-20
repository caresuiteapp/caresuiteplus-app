import type{RoleKey}from'@/types';import type{CareStopWriteReconciliation,CareStopWriteReconciliationRequest}from'@/lib/pflege/careStopWriteReconciliationDomain';
export function CareWriteReconciliationNotice(_props:{tenantId:string;role?:RoleKey|null;request:CareStopWriteReconciliationRequest;disabled?:boolean;onConfirmed:(receipt:CareStopWriteReconciliation)=>void|Promise<void>}){return null;}
