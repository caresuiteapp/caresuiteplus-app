import {cloneClientNativeOriginal,freezeClientNativeOriginal,type ClientNativeRow} from '../clients/clientRecordNativeOriginal.web.ts';
import {woundUuid} from '../pflege/woundCareDomain.ts';

export type QmVersionReferenceStateWeb='supplied_reference'|'missing'|'null'|'empty'|'invalid'|'unresolved';
export type QmVersionReadEvidenceWeb=Readonly<{
 original:ClientNativeRow;version:ClientNativeRow|null;
 relation:'current'|'other'|'unresolved';reason:'same_supplied_reference'|'other_supplied_version'|'version_not_supplied'|'current_reference_unresolved';
}>;
export type QmVersionReferenceWeb=Readonly<{
 provenance:'supplied_unverified_excerpt';freshness:'not_verified';completeness:'not_verified';
 reference:Readonly<{state:QmVersionReferenceStateWeb;id:string|null;version:ClientNativeRow|null}>;
 evidence:Readonly<{current:readonly QmVersionReadEvidenceWeb[];other:readonly QmVersionReadEvidenceWeb[];unresolved:readonly QmVersionReadEvidenceWeb[]}>;
 originals:Readonly<ClientNativeRow & {document:ClientNativeRow;versions:readonly ClientNativeRow[];confirmations:readonly ClientNativeRow[]}>;
}>;
export type QmVersionReferenceResultWeb=Readonly<{ok:true;data:QmVersionReferenceWeb}|{ok:false;error:string}>;
const plain=(v:unknown):v is ClientNativeRow=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const invalid=()=>Error('Die gelieferten QM-Belege sind im eigenen Dokumentbezug nicht verlustfrei prüfbar.');
function nativeId(row:ClientNativeRow,key:string):string{if(!Object.hasOwn(row,key)||!woundUuid(row[key]))throw invalid();return row[key].toLowerCase();}
function pool(value:unknown,tenant:string,document:string):ClientNativeRow[]{
 if(!Array.isArray(value))throw invalid();const seen=new Set<string>();
 for(const row of value){if(!plain(row))throw invalid();const id=nativeId(row,'id');if(seen.has(id)||nativeId(row,'tenantId')!==tenant||nativeId(row,'documentId')!==document)throw invalid();seen.add(id);}
 return value;
}
/** Whole supplied DTOs only. This pure model is neither an authoritative read receipt nor a verified empty collection.
 * Mutable/independently read document and version rows do not prove clinical validity or an as-of revision history. */
export function projectQmDocumentVersionReferenceWeb(input:unknown,scope:unknown):QmVersionReferenceResultWeb{
 try{
  // Descriptor-first clone before owner/reference/metadata access. Unknown extras stay in the private originals.
  const ownScope=cloneClientNativeOriginal(scope),whole=cloneClientNativeOriginal(input);
  if(!plain(ownScope)||!plain(whole)||!['document','versions','confirmations'].every(k=>Object.hasOwn(whole,k)))throw invalid();
  const tenant=nativeId(ownScope,'tenantId'),document=nativeId(ownScope,'documentId');
  if(!plain(whole.document)||nativeId(whole.document,'id')!==document||nativeId(whole.document,'tenantId')!==tenant)throw invalid();
  const versions=pool(whole.versions,tenant,document),confirmations=pool(whole.confirmations,tenant,document);
  const map=new Map(versions.map(row=>[nativeId(row,'id'),row]));
  // Validate every confirmation relation, including hidden/unselected originals, before selecting any reference.
  for(const row of confirmations)nativeId(row,'documentVersionId');
  const raw=Object.hasOwn(whole.document,'currentVersionId')?whole.document.currentVersionId:undefined;
  let state:QmVersionReferenceStateWeb=!Object.hasOwn(whole.document,'currentVersionId')||raw===undefined?'missing':raw===null?'null':raw===''?'empty':!woundUuid(raw)?'invalid':'unresolved';
  const id=woundUuid(raw)?raw:null,version=id?map.get(id.toLowerCase())??null:null;
  if(version)state='supplied_reference';
  const current:QmVersionReadEvidenceWeb[]=[],other:QmVersionReadEvidenceWeb[]=[],unresolved:QmVersionReadEvidenceWeb[]=[];
  for(const row of confirmations){
   const supplied=map.get(nativeId(row,'documentVersionId'))??null;
   if(!supplied){unresolved.push({original:row,version:null,relation:'unresolved',reason:'version_not_supplied'});continue;}
   if(!version){unresolved.push({original:row,version:supplied,relation:'unresolved',reason:'current_reference_unresolved'});continue;}
   if(nativeId(supplied,'id')===nativeId(version,'id'))current.push({original:row,version:supplied,relation:'current',reason:'same_supplied_reference'});
   else other.push({original:row,version:supplied,relation:'other',reason:'other_supplied_version'});
  }
  return freezeClientNativeOriginal({ok:true,data:{provenance:'supplied_unverified_excerpt',freshness:'not_verified',completeness:'not_verified',reference:{state,id,version},evidence:{current,other,unresolved},originals:whole as QmVersionReferenceWeb['originals']}});
 }catch{return {ok:false,error:invalid().message};}
}
