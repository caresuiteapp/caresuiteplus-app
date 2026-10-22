import type { MedicationSourceDocument } from './medicationSourceDomain.ts';
import type { MedicationSourceFingerprint } from './medicationSourceFile.ts';
import { sameWoundJson } from './woundCareDomain.ts';

type SourceLink = { id:string;orderVersion:string;hasFingerprint:boolean;archive:unknown };
export function medicationSourceArchiveReadiness(link:SourceLink|undefined,currentOrderVersion:string):{allowed:boolean;reason:string;recheck:boolean}{
 if(!link)return {allowed:false,reason:'Die gespeicherte Quellenzuordnung zuerst neu laden.',recheck:false};
 if(link.orderVersion!==currentOrderVersion)return {allowed:false,reason:'Diese Quelle gehört zu einem früheren Verordnungsstand. Eine vorhandene Archivkopie bleibt über den Download erreichbar.',recheck:false};
 if(!link.hasFingerprint)return {allowed:false,reason:'Für diese historische Zuordnung fehlt der erfasste Dateiinhalt. Das aktive Originaldokument neu zuordnen.',recheck:false};
 return {allowed:true,reason:link.archive?'Die vorhandene Archivkopie kann mit erneuter Inhalts- und Rechteprüfung bestätigt werden.':'Die gespeicherte Quelldatei kann jetzt im Archiv gesichert werden.',recheck:!!link.archive};
}
export function medicationSourceCaptureProgress(selected:MedicationSourceDocument|null,documents:MedicationSourceDocument[],fingerprint:MedicationSourceFingerprint|null,initialOrderVersion:string,currentOrderVersion:string){
 const orderCurrent=initialOrderVersion===currentOrderVersion;
 const documentCurrent=!!selected&&documents.some(doc=>sameWoundJson(doc,selected));
 const bytesCurrent=!!selected&&!!fingerprint&&documentCurrent&&orderCurrent&&fingerprint.documentId===selected.id&&fingerprint.documentUpdatedAt===selected.updatedAt&&fingerprint.storagePath===selected.storagePath&&/^[0-9a-f]{64}$/.test(fingerprint.sha256)&&Number.isSafeInteger(fingerprint.sizeBytes)&&fingerprint.sizeBytes>0&&fingerprint.sizeBytes<=52_428_800;
 return {orderCurrent,documentCurrent,bytesCurrent,step:!selected?1:!bytesCurrent?2:3,issue:!orderCurrent?'Die Verordnung wurde geändert. Die Bearbeitung schließen und mit dem aktuellen Stand beginnen.':selected&&!documentCurrent?'Das ausgewählte Dokument wurde geändert oder ist nicht mehr aktiv verfügbar. Den Dokumentbestand neu laden und erneut auswählen.':null};
}
