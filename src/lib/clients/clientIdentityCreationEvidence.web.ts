export type ClientIdentityCreationEvidence = Readonly<{
  tenantId: string;
  requestId: string;
  resolution: 'create_distinct' | 'use_existing' | 'needs_review';
  clientId: string | null;
  candidateCount: number;
  silentMergePrevented: true;
  persistenceInferred: false;
  functionalAcceptanceInferred: false;
  careAcceptanceInferred: false;
  designAcceptanceInferred: false;
  legalAcceptanceInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CODE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error(`${label} ist kein eigener Originaldatensatz.`);
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[], label: string) {
  const actual = Object.keys(value), extra = actual.filter((key) => !keys.includes(key)), missing = keys.filter((key) => !actual.includes(key));
  if (extra.length) throw Error(`${label} enthaelt nicht erlaubte Felder: ${extra.join(', ')}.`);
  if (missing.length) throw Error(`${label} ist unvollstaendig: ${missing.join(', ')}.`);
}
function own(value: Record<string, unknown>, key: string, label: string) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw Error(`${label} ${key} fehlt als Originalwert.`);
  return descriptor.value;
}
function id(value: unknown, label: string) { if (typeof value !== 'string' || !UUID.test(value)) throw Error(`${label} ist keine native UUID.`); return value; }
function text(value: unknown, label: string, max = 500) { if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max) throw Error(`${label} ist kein begrenzter Originaltext.`); return value; }
function nullableText(value: unknown, label: string, max = 500) { if (value === null) return null; return text(value, label, max); }
function code(value: unknown, label: string) { if (typeof value !== 'string' || !CODE.test(value)) throw Error(`${label} ist kein stabiler Code.`); return value; }
function date(value: unknown, label: string) {
  if (typeof value !== 'string') throw Error(`${label} ist kein Kalenderdatum.`);
  const match = DATE.exec(value); if (!match) throw Error(`${label} ist kein Kalenderdatum.`);
  const y = +match[1], m = +match[2], d = +match[3], days = m >= 1 && m <= 12 ? new Date(Date.UTC(y, m, 0)).getUTCDate() : 0;
  if (y < 1 || d < 1 || d > days) throw Error(`${label} ist kein Kalenderdatum.`);
  return value;
}
function instant(value: unknown, label: string) {
  if (typeof value !== 'string') throw Error(`${label} ist kein Mikrosekundenzeitpunkt.`);
  const match = INSTANT.exec(value); if (!match) throw Error(`${label} ist kein Mikrosekundenzeitpunkt.`);
  const [, y0, m0, d0, h0, min0, s0, fraction, zone, sign, zh0, zm0] = match;
  const y=+y0,m=+m0,d=+d0,h=+h0,min=+min0,s=+s0,zh=+(zh0??0),zm=+(zm0??0),days=m>=1&&m<=12?new Date(Date.UTC(y,m,0)).getUTCDate():0;
  if (y<1||d<1||d>days||h>23||min>59||s>59||zh>23||zm>59) throw Error(`${label} enthaelt kein Kalenderdatum.`);
  const offset=zone==='Z'?0:(sign==='-'?-1:1)*(zh*60+zm);
  return BigInt(Date.UTC(y,m-1,d,h,min,s)-offset*60000)*1000n+BigInt(fraction.padEnd(6,'0'));
}

/** Validates one explicit identity resolution; it neither reads nor writes a client record. */
export function projectClientIdentityCreationEvidence(input: unknown): ClientIdentityCreationEvidence {
  const root=record(input,'Identitaetsbeleg'); exact(root,['context','request','candidateSnapshot','decision','mutation','evaluatedAt'],'Identitaetsbeleg');
  const evaluatedAt=instant(own(root,'evaluatedAt','Identitaetsbeleg'),'Auswertungszeit');
  const context=record(own(root,'context','Identitaetsbeleg'),'Kontext'); exact(context,['tenantId','locationId','profileId','permissionKey'],'Kontext');
  const tenantId=id(own(context,'tenantId','Kontext'),'Mandant'),locationId=id(own(context,'locationId','Kontext'),'Standort'),profileId=id(own(context,'profileId','Kontext'),'Profil');
  if(own(context,'permissionKey','Kontext')!=='office.clients.manage')throw Error('Aktuelles Recht zur Personenanlage fehlt.');

  const request=record(own(root,'request','Identitaetsbeleg'),'Anlageauftrag'); exact(request,['requestId','tenantId','locationId','sourceInquiryId','firstName','lastName','dateOfBirth','insuranceNumber','submittedAt'],'Anlageauftrag');
  const requestId=id(own(request,'requestId','Anlageauftrag'),'Auftragskennung');
  if(id(own(request,'tenantId','Anlageauftrag'),'Auftragsmandant')!==tenantId||id(own(request,'locationId','Anlageauftrag'),'Auftragsstandort')!==locationId)throw Error('Anlageauftrag gehoert nicht zum aktuellen Kontext.');
  id(own(request,'sourceInquiryId','Anlageauftrag'),'Anfragekennung');
  const firstName=text(own(request,'firstName','Anlageauftrag'),'Vorname'),lastName=text(own(request,'lastName','Anlageauftrag'),'Nachname'),dateOfBirth=date(own(request,'dateOfBirth','Anlageauftrag'),'Geburtsdatum'),insuranceNumber=nullableText(own(request,'insuranceNumber','Anlageauftrag'),'Versicherungsnummer');
  const submittedAt=instant(own(request,'submittedAt','Anlageauftrag'),'Auftragszeit');

  const snapshot=record(own(root,'candidateSnapshot','Identitaetsbeleg'),'Kandidatenstand'); exact(snapshot,['snapshotId','requestId','tenantId','locationId','revision','candidates','capturedAt'],'Kandidatenstand');
  id(own(snapshot,'snapshotId','Kandidatenstand'),'Snapshotkennung');
  if(id(own(snapshot,'requestId','Kandidatenstand'),'Snapshotauftrag')!==requestId||id(own(snapshot,'tenantId','Kandidatenstand'),'Snapshotmandant')!==tenantId||id(own(snapshot,'locationId','Kandidatenstand'),'Snapshotstandort')!==locationId)throw Error('Kandidatenstand bindet Auftrag und Kontext nicht exakt.');
  const revision=own(snapshot,'revision','Kandidatenstand'); if(!Number.isSafeInteger(revision)||Number(revision)<1)throw Error('Kandidatenrevision ist ungueltig.');
  const capturedAt=instant(own(snapshot,'capturedAt','Kandidatenstand'),'Snapshotzeit');
  const candidatesValue=own(snapshot,'candidates','Kandidatenstand'); if(!Array.isArray(candidatesValue)||candidatesValue.length>100)throw Error('Kandidatenliste ist ungueltig.');
  const seen=new Set<string>(); let exactIdentity=false;
  const candidates=candidatesValue.map((value,index)=>{
    const candidate=record(value,`Kandidat ${index+1}`); exact(candidate,['clientId','tenantId','firstName','lastName','dateOfBirth','insuranceNumber','status','identityRevision','matchCodes'],`Kandidat ${index+1}`);
    const clientId=id(own(candidate,'clientId',`Kandidat ${index+1}`),'Klientenkennung'); if(seen.has(clientId))throw Error('Kandidatenliste enthaelt doppelte native Identitaeten.'); seen.add(clientId);
    if(id(own(candidate,'tenantId',`Kandidat ${index+1}`),'Kandidatenmandant')!==tenantId)throw Error('Kandidat gehoert nicht zum aktuellen Mandanten.');
    const cf=text(own(candidate,'firstName',`Kandidat ${index+1}`),'Kandidatenvorname'),cl=text(own(candidate,'lastName',`Kandidat ${index+1}`),'Kandidatennachname'),cd=date(own(candidate,'dateOfBirth',`Kandidat ${index+1}`),'Kandidatengeburtsdatum'),ci=nullableText(own(candidate,'insuranceNumber',`Kandidat ${index+1}`),'Kandidatenversicherungsnummer');
    code(own(candidate,'status',`Kandidat ${index+1}`),'Kandidatenstatus'); const ir=own(candidate,'identityRevision',`Kandidat ${index+1}`); if(!Number.isSafeInteger(ir)||Number(ir)<1)throw Error('Kandidatenrevision ist ungueltig.');
    const matchCodes=own(candidate,'matchCodes',`Kandidat ${index+1}`); if(!Array.isArray(matchCodes)||!matchCodes.length||matchCodes.some((v)=>typeof v!=='string'||!CODE.test(v)))throw Error('Kandidatenabgleich ist nicht stabil codiert.');
    const sameName=cf.toLocaleLowerCase('de-DE')===firstName.toLocaleLowerCase('de-DE')&&cl.toLocaleLowerCase('de-DE')===lastName.toLocaleLowerCase('de-DE');
    if((sameName&&cd===dateOfBirth)||(insuranceNumber!==null&&ci!==null&&insuranceNumber.toLocaleUpperCase('de-DE')===ci.toLocaleUpperCase('de-DE')))exactIdentity=true;
    return clientId;
  });

  const decision=record(own(root,'decision','Identitaetsbeleg'),'Identitaetsentscheidung'); exact(decision,['decisionId','requestId','snapshotId','tenantId','locationId','profileId','expectedRevision','resolution','selectedClientId','reasonCode','reasonText','decidedAt'],'Identitaetsentscheidung');
  id(own(decision,'decisionId','Identitaetsentscheidung'),'Entscheidungskennung');
  if(id(own(decision,'requestId','Identitaetsentscheidung'),'Entscheidungsauftrag')!==requestId||id(own(decision,'snapshotId','Identitaetsentscheidung'),'Entscheidungssnapshot')!==own(snapshot,'snapshotId','Kandidatenstand')||id(own(decision,'tenantId','Identitaetsentscheidung'),'Entscheidungsmandant')!==tenantId||id(own(decision,'locationId','Identitaetsentscheidung'),'Entscheidungsstandort')!==locationId||id(own(decision,'profileId','Identitaetsentscheidung'),'Entscheidungsprofil')!==profileId)throw Error('Identitaetsentscheidung bindet Auftrag, Snapshot und Kontext nicht exakt.');
  if(own(decision,'expectedRevision','Identitaetsentscheidung')!==revision)throw Error('Identitaetsentscheidung verwendet nicht die gelesene Kandidatenrevision.');
  const resolution=own(decision,'resolution','Identitaetsentscheidung'); if(!['create_distinct','use_existing','needs_review'].includes(String(resolution)))throw Error('Identitaetsentscheidung ist ungueltig.');
  const selected=own(decision,'selectedClientId','Identitaetsentscheidung'); if(selected!==null)id(selected,'Ausgewaehlte Klientenkennung');
  code(own(decision,'reasonCode','Identitaetsentscheidung'),'Entscheidungsgrund'); text(own(decision,'reasonText','Identitaetsentscheidung'),'Entscheidungsbegruendung',2000);
  if(resolution==='create_distinct'&&(selected!==null||exactIdentity))throw Error('Exakte Identitaet darf nicht still als neue Person angelegt werden.');
  if(resolution==='use_existing'&&(typeof selected!=='string'||!candidates.includes(selected)))throw Error('Bestehende Person muss ausdruecklich aus dem Kandidatenstand gewaehlt werden.');
  if(resolution==='needs_review'&&selected!==null)throw Error('Offene Pruefung darf keine Person vorwegnehmen.');
  const decidedAt=instant(own(decision,'decidedAt','Identitaetsentscheidung'),'Entscheidungszeit');

  const mutation=record(own(root,'mutation','Identitaetsbeleg'),'Mutation'); exact(mutation,['operation','requestId','tenantId','clientId','sourceClientId','recordedAt'],'Mutation');
  if(id(own(mutation,'requestId','Mutation'),'Mutationsauftrag')!==requestId||id(own(mutation,'tenantId','Mutation'),'Mutationsmandant')!==tenantId)throw Error('Mutation bindet Auftrag und Mandant nicht exakt.');
  const operation=own(mutation,'operation','Mutation'),clientValue=own(mutation,'clientId','Mutation'),sourceClient=own(mutation,'sourceClientId','Mutation');
  let clientId:string|null=null;
  if(resolution==='create_distinct'){
    if(operation!=='insert'||sourceClient!==null)throw Error('Getrennte Anlage benoetigt einen ausdruecklichen Insert ohne Quellperson.');
    clientId=id(clientValue,'Neue Klientenkennung'); if(candidates.includes(clientId))throw Error('Neue Person darf keine vorhandene Kandidatenkennung uebernehmen.');
  }else if(resolution==='use_existing'){
    if(operation!=='link_existing'||clientValue!==selected||sourceClient!==selected)throw Error('Ausdrueckliche Bestandszuordnung passt nicht zur gewaehlten Person.'); clientId=String(selected);
  }else if(operation!=='none'||clientValue!==null||sourceClient!==null)throw Error('Offene Pruefung darf keine Mutation behaupten.');
  const recordedAt=instant(own(mutation,'recordedAt','Mutation'),'Mutationszeit');
  if(submittedAt>capturedAt||capturedAt>decidedAt||decidedAt>recordedAt||recordedAt>evaluatedAt)throw Error('Identitaetsbeleg verletzt die Mikrosekundenfolge.');

  return Object.freeze({tenantId,requestId,resolution:resolution as ClientIdentityCreationEvidence['resolution'],clientId,candidateCount:candidates.length,silentMergePrevented:true,persistenceInferred:false,functionalAcceptanceInferred:false,careAcceptanceInferred:false,designAcceptanceInferred:false,legalAcceptanceInferred:false});
}
