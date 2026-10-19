import { woundInstant } from './woundCareDomain.ts';

export type MedicationSourceDocument = { id: string; tenantId: string; clientId: string; title: string; fileName: string; mimeType: string; updatedAt: string; storagePath: string | null; status: string };
export type MedicationSourcePayload = { documentId: string; documentUpdatedAt: string; expectedUpdatedAt: string; reason: string; contentSha256: string; contentSize: number };
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
// Metadata may use the native PostgreSQL space separator. Check a copy only;
// original version strings remain exact and are never normalized in a payload.
const validMetadataInstant=(value:unknown)=>typeof value==='string'&&woundInstant(value.replace(' ','T'))!==null;
export function validateMedicationSource(order:{tenantId:string;clientId:string;updatedAt:string},doc:MedicationSourceDocument,p:MedicationSourcePayload):string|null {
 if(!uuid(doc.id)||doc.id!==p.documentId||doc.tenantId!==order.tenantId||doc.clientId!==order.clientId)return 'Dokument und Verordnung gehören nicht zur selben Klientenakte.';
 if(doc.status!=='aktiv')return 'Nur ein aktives Dokument kann neu zugeordnet werden.';
 const prefix=`tenant/${order.tenantId}/clients/${order.clientId}/documents/`;
 if(!doc.storagePath?.startsWith(prefix)||doc.storagePath.includes('..')||!doc.storagePath.slice(prefix.length))return 'Die Originaldatei ist nicht eindeutig in dieser Klientenakte hinterlegt.';
 if(doc.updatedAt!==p.documentUpdatedAt||!validMetadataInstant(doc.updatedAt))return 'Das Dokument wurde geändert. Neu laden und prüfen.';
 if(order.updatedAt!==p.expectedUpdatedAt||!validMetadataInstant(order.updatedAt))return 'Die Verordnung wurde geändert. Neu laden und prüfen.';
 if(!p.reason.trim()||p.reason.length>2000)return 'Eine Begründung bis 2.000 Zeichen ist erforderlich.';
 if(!/^[0-9a-f]{64}$/.test(p.contentSha256)||!Number.isSafeInteger(p.contentSize)||p.contentSize<=0||p.contentSize>52_428_800)return 'Dateiinhalt zuerst laden und den Inhaltsfingerabdruck erfassen (maximal 50 MiB).';
 return null;
}
