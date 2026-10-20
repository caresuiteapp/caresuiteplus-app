import {woundUuid} from '../pflege/woundCareDomain.ts';

export type CareAssessmentRuntimeAccessInput={
 tenantId:string|null|undefined;
 profileId:string|null|undefined;
 profileRole:string|null|undefined;
 runtimeTenantId:string|null|undefined;
 runtimeRole:string|null|undefined;
 canView:boolean;
 canManage:boolean;
};
export type CareAssessmentRuntimeAccess={canRead:boolean;canManage:boolean};

/** Evaluate supplied runtime rights in the current native profile context; this does not establish permission-loading readiness or backend access. */
export function careAssessmentRuntimeAccess(input:CareAssessmentRuntimeAccessInput):CareAssessmentRuntimeAccess{
 const contextMatches=!!input&&woundUuid(input.tenantId)&&woundUuid(input.profileId)&&woundUuid(input.runtimeTenantId)&&input.tenantId===input.runtimeTenantId&&typeof input.profileRole==='string'&&input.profileRole.trim().length>0&&typeof input.runtimeRole==='string'&&input.runtimeRole.trim().length>0&&input.profileRole===input.runtimeRole;
 const canRead=contextMatches&&input.canView===true;
 return {canRead,canManage:canRead&&input.canManage===true};
}

/** Call with freshly evaluated access before and after an awaited read, alongside the caller's complete native context guards. */
export function assertCareAssessmentRuntimeReadAccess(latestAccess:CareAssessmentRuntimeAccess):void{
 if(!latestAccess||latestAccess.canRead!==true)throw Error('Das aktuelle Pflegeplan-Leserecht ist nicht verfügbar oder der Benutzerkontext hat sich geändert.');
}
