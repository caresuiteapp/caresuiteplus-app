import {UUID} from './sources';
import type {MonthlyProof} from './monthlyProof';
export const AUTHORITY_BASES={vollmacht:'Vollmacht',gesetzliche_vertretung:'Gesetzliche Vertretung',angehoerige:'Berechtigte Angehörige'} as const;
export type MonthlyAuthority={id:string;tenant_id:string;client_id:string;service_type:string;signer_name:string;
  basis:keyof typeof AUTHORITY_BASES;evidence_reference:string;review_note:string;valid_from:string;valid_until:string;
  reviewed_by:string;reviewed_at:string;revoked_by:string|null;revoked_at:string|null;revocation_reason:string|null};
export type MonthlyAuthorities={tenantId:string;proofId:string;clientId:string;serviceType:string;canManage:boolean;checkedAt:string;authorities:MonthlyAuthority[]};
export type AuthorityCommand={proofId:string}&({action:'list'}|{action:'register';id:string;signerName:string;basis:MonthlyAuthority['basis'];
 evidenceReference:string;reviewNote:string;validFrom:string;validUntil:string;reviewed:true}|{action:'revoke';id:string;reason:string});
const uuid=(v:unknown):v is string=>typeof v==='string' && UUID.test(v) && v===v.toLowerCase();
const instant=(v:unknown):v is string=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const text=(v:unknown,min:number,max:number):v is string=>typeof v==='string' && [...v.replace(/^ +| +$/g,'')].length>=min && [...v].length<=max && !/[\p{Cc}\p{Cf}]/u.test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v);
function fail():never{throw Error('Die gespeicherte Vertretungsprüfung ist unvollständig oder gehört nicht zu diesem Nachweis.');}
export function readMonthlyAuthority(value:unknown):MonthlyAuthority{
 if(!object(value) || Object.keys(value).sort().join()!==['id','tenant_id','client_id','service_type','signer_name','basis','evidence_reference','review_note','valid_from','valid_until','reviewed_by','reviewed_at','revoked_by','revoked_at','revocation_reason'].sort().join()
  || ![value.id,value.tenant_id,value.client_id,value.reviewed_by].every(uuid) || typeof value.service_type!=='string' || !/^(0[1-9]|1[0-5])$/.test(value.service_type)
  || !text(value.signer_name,2,300) || !Object.hasOwn(AUTHORITY_BASES,String(value.basis)) || !text(value.evidence_reference,3,500)
  || !text(value.review_note,10,1000) || ![value.valid_from,value.valid_until,value.reviewed_at].every(instant)
  || Date.parse(value.valid_from as string)>=Date.parse(value.valid_until as string)
  || (value.revoked_at===null ? value.revoked_by!==null || value.revocation_reason!==null : !instant(value.revoked_at) || !uuid(value.revoked_by) || !text(value.revocation_reason,3,1000)))fail();
 return structuredClone(value) as MonthlyAuthority;
}
export function authorityAvailable(value:MonthlyAuthority,at:string):boolean{
 return !value.revoked_at && Date.parse(value.valid_from)<=Date.parse(at) && Date.parse(value.valid_until)>Date.parse(at);
}
export function readMonthlyAuthorities(value:unknown,proof:MonthlyProof):MonthlyAuthorities{
 if(!object(value) || Object.keys(value).sort().join()!==['tenantId','proofId','clientId','serviceType','canManage','checkedAt','authorities'].sort().join()
  || value.tenantId!==proof.tenant_id || value.proofId!==proof.id || value.clientId!==proof.payload.clientId || value.serviceType!==proof.payload.serviceType
  || typeof value.canManage!=='boolean' || !instant(value.checkedAt) || !Array.isArray(value.authorities))fail();
 const authorities=value.authorities.map(readMonthlyAuthority);
 if(new Set(authorities.map(a=>a.id)).size!==authorities.length || authorities.some(a=>a.tenant_id!==proof.tenant_id || a.client_id!==proof.payload.clientId || a.service_type!==proof.payload.serviceType))fail();
 return {...value,authorities} as MonthlyAuthorities;
}
