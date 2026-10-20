export type ClientAddressPlanningEvidence = Readonly<{
  tenantId: string;
  clientId: string;
  addressId: string;
  oldRevision: number;
  newRevision: number;
  historicalVisitCount: number;
  futureVisitCount: number;
  historicalVisitsPreserved: true;
  planningReceiptConfirmed: true;
  persistenceInferred: false;
  functionalAcceptanceInferred: false;
  careAcceptanceInferred: false;
  designAcceptanceInferred: false;
  legalAcceptanceInferred: false;
}>;

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256=/^[0-9a-f]{64}$/;
const CODE=/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const INSTANT=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;

function record(value:unknown,label:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error(`${label} ist kein eigener Originaldatensatz.`);
  return value as Record<string,unknown>;
}
function exact(value:Record<string,unknown>,keys:readonly string[],label:string){
  const actual=Object.keys(value),extra=actual.filter((key)=>!keys.includes(key)),missing=keys.filter((key)=>!actual.includes(key));
  if(extra.length)throw Error(`${label} enthaelt nicht erlaubte Felder: ${extra.join(', ')}.`);
  if(missing.length)throw Error(`${label} ist unvollstaendig: ${missing.join(', ')}.`);
}
function own(value:Record<string,unknown>,key:string,label:string){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!Object.hasOwn(descriptor,'value'))throw Error(`${label} ${key} fehlt als Originalwert.`);return descriptor.value;}
function id(value:unknown,label:string){if(typeof value!=='string'||!UUID.test(value))throw Error(`${label} ist keine native UUID.`);return value;}
function text(value:unknown,label:string,max=1000){if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>max)throw Error(`${label} ist kein begrenzter Originaltext.`);return value;}
function nullableText(value:unknown,label:string,max=1000){if(value===null)return null;return text(value,label,max);}
function integer(value:unknown,label:string){if(!Number.isSafeInteger(value)||Number(value)<1)throw Error(`${label} ist keine positive native Revision.`);return Number(value);}
function instant(value:unknown,label:string){
  if(typeof value!=='string')throw Error(`${label} ist kein Mikrosekundenzeitpunkt.`);const match=INSTANT.exec(value);if(!match)throw Error(`${label} ist kein Mikrosekundenzeitpunkt.`);
  const[,y0,m0,d0,h0,min0,s0,fraction,zone,sign,zh0,zm0]=match,y=+y0,m=+m0,d=+d0,h=+h0,min=+min0,s=+s0,zh=+(zh0??0),zm=+(zm0??0),days=m>=1&&m<=12?new Date(Date.UTC(y,m,0)).getUTCDate():0;
  if(y<1||d<1||d>days||h>23||min>59||s>59||zh>23||zm>59)throw Error(`${label} enthaelt kein Kalenderdatum.`);const offset=zone==='Z'?0:(sign==='-'?-1:1)*(zh*60+zm);return BigInt(Date.UTC(y,m-1,d,h,min,s)-offset*60000)*1000n+BigInt(fraction.padEnd(6,'0'));
}
function address(value:unknown,label:string){
  const row=record(value,label);exact(row,['addressId','tenantId','clientId','revision','street','houseNumber','postalCode','city','floor','accessNote','reachabilityNote','householdContext','validFrom'],label);
  const result={addressId:id(own(row,'addressId',label),`${label} Kennung`),tenantId:id(own(row,'tenantId',label),`${label} Mandant`),clientId:id(own(row,'clientId',label),`${label} Pflegefall`),revision:integer(own(row,'revision',label),`${label} Revision`),street:text(own(row,'street',label),`${label} Strasse`,200),houseNumber:text(own(row,'houseNumber',label),`${label} Hausnummer`,50),postalCode:text(own(row,'postalCode',label),`${label} Postleitzahl`,20),city:text(own(row,'city',label),`${label} Ort`,200),floor:nullableText(own(row,'floor',label),`${label} Etage`,100),accessNote:nullableText(own(row,'accessNote',label),`${label} Zugang`,1000),reachabilityNote:nullableText(own(row,'reachabilityNote',label),`${label} Erreichbarkeit`,1000),householdContext:nullableText(own(row,'householdContext',label),`${label} Haushaltskontext`,2000),validFrom:instant(own(row,'validFrom',label),`${label} Gueltigkeit`)};
  return result;
}
function historical(value:unknown,index:number,tenantId:string,clientId:string,changedAt:bigint){
  const label=`Historischer Besuch ${index+1}`,row=record(value,label);exact(row,['visitId','tenantId','clientId','addressRevision','addressSnapshotSha256','addressTextSnapshot','plannedAt','occurredAt','status'],label);
  const visitId=id(own(row,'visitId',label),`${label} Kennung`);if(id(own(row,'tenantId',label),`${label} Mandant`)!==tenantId||id(own(row,'clientId',label),`${label} Pflegefall`)!==clientId)throw Error('Historischer Besuch gehoert nicht zum aktuellen Kontext.');
  const revision=integer(own(row,'addressRevision',label),`${label} Adressrevision`),hash=own(row,'addressSnapshotSha256',label);if(typeof hash!=='string'||!SHA256.test(hash))throw Error('Historischer Besuch hat keine stabile Adresspruefsumme.');
  const snapshot=text(own(row,'addressTextSnapshot',label),`${label} Adresssnapshot`,2000),plannedAt=instant(own(row,'plannedAt',label),`${label} Plantermin`),occurredAt=instant(own(row,'occurredAt',label),`${label} Ereigniszeit`),status=own(row,'status',label);
  if(status!=='completed'||plannedAt>occurredAt||occurredAt>=changedAt)throw Error('Historischer Besuch ist kein abgeschlossenes Ereignis vor der Adressaenderung.');
  return {visitId,tenantId,clientId,addressRevision:revision,addressSnapshotSha256:hash,addressTextSnapshot:snapshot,plannedAt:String(own(row,'plannedAt',label)),occurredAt:String(own(row,'occurredAt',label)),status};
}

/** Validates address-change evidence without reading, writing, or rewriting visits. */
export function projectClientAddressPlanningEvidence(input:unknown):ClientAddressPlanningEvidence{
  const root=record(input,'Adressbeleg');exact(root,['context','addressBefore','addressAfter','change','historicalVisitsBefore','historicalVisitsAfter','futurePlans','planningReceipt','evaluatedAt'],'Adressbeleg');
  const context=record(own(root,'context','Adressbeleg'),'Kontext');exact(context,['tenantId','locationId','profileId','clientId','permissionKey'],'Kontext');
  const tenantId=id(own(context,'tenantId','Kontext'),'Mandant'),locationId=id(own(context,'locationId','Kontext'),'Standort'),profileId=id(own(context,'profileId','Kontext'),'Profil'),clientId=id(own(context,'clientId','Kontext'),'Pflegefall');if(own(context,'permissionKey','Kontext')!=='office.clients.manage')throw Error('Aktuelles Recht zur Adressaenderung fehlt.');
  const before=address(own(root,'addressBefore','Adressbeleg'),'Alte Adresse'),after=address(own(root,'addressAfter','Adressbeleg'),'Neue Adresse');
  for(const entry of [before,after])if(entry.tenantId!==tenantId||entry.clientId!==clientId)throw Error('Adresse gehoert nicht zum aktuellen Mandanten und Pflegefall.');
  if(before.addressId!==after.addressId||after.revision!==before.revision+1||before.validFrom>=after.validFrom)throw Error('Adressidentitaet und native Revision werden nicht lueckenlos fortgeschrieben.');
  const changedFields=['street','houseNumber','postalCode','city','floor','accessNote','reachabilityNote','householdContext'] as const;if(!changedFields.some((key)=>before[key]!==after[key]))throw Error('Adressbeleg enthaelt keine tatsaechliche Aenderung.');
  const change=record(own(root,'change','Adressbeleg'),'Adressaenderung');exact(change,['changeId','tenantId','locationId','clientId','addressId','expectedRevision','newRevision','profileId','reasonCode','reasonText','changedAt'],'Adressaenderung');
  const changeId=id(own(change,'changeId','Adressaenderung'),'Aenderungskennung');if(id(own(change,'tenantId','Adressaenderung'),'Aenderungsmandant')!==tenantId||id(own(change,'locationId','Adressaenderung'),'Aenderungsstandort')!==locationId||id(own(change,'clientId','Adressaenderung'),'Aenderungspflegefall')!==clientId||id(own(change,'addressId','Adressaenderung'),'Aenderungsadresse')!==after.addressId||id(own(change,'profileId','Adressaenderung'),'Aenderungsprofil')!==profileId)throw Error('Adressaenderung bindet den aktuellen Kontext nicht exakt.');
  if(own(change,'expectedRevision','Adressaenderung')!==before.revision||own(change,'newRevision','Adressaenderung')!==after.revision)throw Error('Adressaenderung verwendet nicht die native Revisionsfolge.');const reason=own(change,'reasonCode','Adressaenderung');if(typeof reason!=='string'||!CODE.test(reason))throw Error('Aenderungsgrund ist kein stabiler Code.');text(own(change,'reasonText','Adressaenderung'),'Aenderungsbegruendung',2000);const changedAt=instant(own(change,'changedAt','Adressaenderung'),'Aenderungszeit');if(after.validFrom!==changedAt)throw Error('Neue Adressgueltigkeit und Aenderungszeit weichen ab.');
  const historyBefore=own(root,'historicalVisitsBefore','Adressbeleg'),historyAfter=own(root,'historicalVisitsAfter','Adressbeleg');if(!Array.isArray(historyBefore)||!Array.isArray(historyAfter)||historyBefore.length>500||historyBefore.length!==historyAfter.length)throw Error('Historische Besuchsstaende sind unvollstaendig.');
  const normalizedBefore=historyBefore.map((row,index)=>historical(row,index,tenantId,clientId,changedAt)),normalizedAfter=historyAfter.map((row,index)=>historical(row,index,tenantId,clientId,changedAt));if(JSON.stringify(normalizedBefore)!==JSON.stringify(normalizedAfter))throw Error('Adressaenderung hat historische Besuche umgeschrieben.');
  const historicalIds=new Set<string>();for(const visit of normalizedBefore){if(historicalIds.has(visit.visitId))throw Error('Historische Besuchskennung ist doppelt.');historicalIds.add(visit.visitId);if(visit.addressRevision>before.revision)throw Error('Historischer Besuch verweist auf eine spaetere Adressrevision.');}
  const futureValue=own(root,'futurePlans','Adressbeleg');if(!Array.isArray(futureValue)||futureValue.length>500)throw Error('Zukuenftige Planungen sind ungueltig.');const futureIds=new Set<string>();
  for(const [index,value] of futureValue.entries()){const label=`Zukuenftiger Besuch ${index+1}`,row=record(value,label);exact(row,['visitId','tenantId','locationId','clientId','addressId','addressRevision','scheduledAt','status'],label);const visitId=id(own(row,'visitId',label),`${label} Kennung`);if(futureIds.has(visitId)||historicalIds.has(visitId))throw Error('Besuchskennung ist doppelt oder historisch.');futureIds.add(visitId);if(id(own(row,'tenantId',label),`${label} Mandant`)!==tenantId||id(own(row,'locationId',label),`${label} Standort`)!==locationId||id(own(row,'clientId',label),`${label} Pflegefall`)!==clientId||id(own(row,'addressId',label),`${label} Adresse`)!==after.addressId||own(row,'addressRevision',label)!==after.revision)throw Error('Zukuenftige Planung hat die neue Adresse nicht uebernommen.');if(instant(own(row,'scheduledAt',label),`${label} Plantermin`)<=changedAt)throw Error('Zukuenftige Planung liegt nicht nach der Adressaenderung.');if(!['planned','assigned'].includes(String(own(row,'status',label))))throw Error('Zukuenftige Planung ist nicht offen.');}
  const receipt=record(own(root,'planningReceipt','Adressbeleg'),'Planungsquittung');exact(receipt,['receiptId','changeId','tenantId','locationId','clientId','addressId','addressRevision','profileId','permissionKey','futureVisitIds','acceptedAt'],'Planungsquittung');id(own(receipt,'receiptId','Planungsquittung'),'Quittungskennung');if(id(own(receipt,'changeId','Planungsquittung'),'Quittungsaenderung')!==changeId||id(own(receipt,'tenantId','Planungsquittung'),'Quittungsmandant')!==tenantId||id(own(receipt,'locationId','Planungsquittung'),'Quittungsstandort')!==locationId||id(own(receipt,'clientId','Planungsquittung'),'Quittungspflegefall')!==clientId||id(own(receipt,'addressId','Planungsquittung'),'Quittungsadresse')!==after.addressId||own(receipt,'addressRevision','Planungsquittung')!==after.revision||id(own(receipt,'profileId','Planungsquittung'),'Quittungsprofil')!==profileId||own(receipt,'permissionKey','Planungsquittung')!=='office.tours.manage')throw Error('Planungsquittung bindet Aenderung, Kontext und neue Adresse nicht exakt.');
  const receiptIds=own(receipt,'futureVisitIds','Planungsquittung');if(!Array.isArray(receiptIds)||receiptIds.some((value)=>typeof value!=='string'||!UUID.test(value))||new Set(receiptIds).size!==receiptIds.length||receiptIds.length!==futureIds.size||receiptIds.some((value)=>!futureIds.has(value)))throw Error('Planungsquittung bestaetigt nicht exakt alle zukuenftigen Besuche.');const acceptedAt=instant(own(receipt,'acceptedAt','Planungsquittung'),'Quittungszeit'),evaluatedAt=instant(own(root,'evaluatedAt','Adressbeleg'),'Auswertungszeit');if(changedAt>acceptedAt||acceptedAt>evaluatedAt)throw Error('Adressbeleg verletzt die Mikrosekundenfolge.');
  return Object.freeze({tenantId,clientId,addressId:after.addressId,oldRevision:before.revision,newRevision:after.revision,historicalVisitCount:normalizedBefore.length,futureVisitCount:futureIds.size,historicalVisitsPreserved:true,planningReceiptConfirmed:true,persistenceInferred:false,functionalAcceptanceInferred:false,careAcceptanceInferred:false,designAcceptanceInferred:false,legalAcceptanceInferred:false});
}
