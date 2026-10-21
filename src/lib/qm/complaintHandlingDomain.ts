export type ComplaintInvestigationEvidence = {
  evidenceId: string;
  sourceType: 'portal_request' | 'care_record' | 'qm_document_version' | 'communication' | 'other';
  sourceEntityId: string;
  sourceVersionId: string | null;
  recordLocator: string;
  sourceSha256: string;
};

export type ComplaintEventInput = {
  eventId: string;
  clientRequestId: string;
  kind: 'investigation' | 'response' | 'closure' | 'reopened';
  occurredAt: string;
  recordedAt: string;
  actorId: string;
  actorName: string;
  summary: string;
  evidence: readonly ComplaintInvestigationEvidence[];
  responseRecipient: string | null;
  responseChannel: 'letter' | 'email' | 'portal' | 'phone' | 'in_person' | null;
  resultCode: 'resolved' | 'partially_resolved' | 'not_resolved' | 'withdrawn' | null;
  resultSummary: string | null;
  resultSha256: string | null;
  referencesEventIds: readonly string[];
};

export type ComplaintCaseInput = {
  complaintId: string;
  clientRequestId: string;
  tenantId: string;
  scope: 'client' | 'facility';
  clientId: string | null;
  sourcePortalRequestId: string | null;
  concern: string;
  receivedAt: string;
  receivedChannel: 'letter' | 'email' | 'portal' | 'phone' | 'in_person' | 'other';
  complainantKind: 'client' | 'representative' | 'anonymous' | 'employee' | 'other';
  complainantReference: string | null;
  assignedRecipientId: string;
  assignedRecipientName: string;
  assignedRecipientRole: string;
  dueAt: string;
  recordedAt: string;
  recordedBy: string;
  recordedByName: string;
  events: readonly ComplaintEventInput[];
};

export type ComplaintCase = ComplaintCaseInput & {
  status: 'open' | 'investigating' | 'responded' | 'closed';
  cycle: number;
  closureResult: ComplaintEventInput['resultCode'];
  satisfaction: 'not_inferred';
  careCompletion: 'not_inferred';
  historyMode: 'append_only';
};

const exactUtcMicros=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const sha256=/^[0-9a-f]{64}$/;
function required(value:string|null|undefined,label:string){if(typeof value!=='string'||!value.trim())throw Error(`${label} fehlt.`);return value.trim();}
function micros(value:string,label:string){const v=required(value,label);if(!exactUtcMicros.test(v)||Number.isNaN(Date.parse(v)))throw Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`);return v;}
function fingerprint(value:string|null,label:string){const v=required(value,label);if(!sha256.test(v))throw Error(`${label} benötigt einen SHA-256-Fingerprint.`);return v;}

export function buildComplaintCase(input:ComplaintCaseInput):ComplaintCase{
  for(const [value,label] of [[input.complaintId,'Beschwerde'],[input.clientRequestId,'Anforderungs-ID'],[input.tenantId,'Mandant'],[input.concern,'Anliegen'],[input.assignedRecipientId,'Empfängeridentität'],[input.assignedRecipientName,'Empfängername'],[input.assignedRecipientRole,'Empfängerrolle'],[input.recordedBy,'Erfassungsidentität'],[input.recordedByName,'Erfassungsname']] as const)required(value,label);
  if(!['client','facility'].includes(input.scope))throw Error('Beschwerdeumfang ist ungültig.');
  if(input.scope==='client'&&!input.clientId)throw Error('Personenbezogene Beschwerde benötigt eine native Pflegefall-ID.');
  if(input.scope==='facility'&&input.clientId)throw Error('Einrichtungsbeschwerde darf keinen Pflegefall erfinden.');
  if(!['letter','email','portal','phone','in_person','other'].includes(input.receivedChannel))throw Error('Eingangskanal ist ungültig.');
  if(!['client','representative','anonymous','employee','other'].includes(input.complainantKind))throw Error('Beschwerdeführendenart ist ungültig.');
  if(input.complainantKind==='anonymous'&&input.complainantReference)throw Error('Anonyme Beschwerde darf keine Beschwerdeführendenidentität erfinden.');
  const receivedAt=micros(input.receivedAt,'Eingangszeit');const dueAt=micros(input.dueAt,'Bearbeitungsfrist');const recordedAt=micros(input.recordedAt,'Erfassungszeit');
  if(receivedAt>recordedAt||dueAt<=receivedAt)throw Error('Eingang, Erfassung und Frist sind zeitlich widersprüchlich.');
  const eventIds=new Set<string>(),requestIds=new Set<string>(),evidenceIds=new Set<string>();let lastAt=receivedAt,lastRecordedAt=recordedAt,status:ComplaintCase['status']='open',cycle=1,cycleInvestigations=new Set<string>(),cycleResponses=new Set<string>(),closureResult:ComplaintCase['closureResult']=null;
  const events=input.events.map(event=>{
    for(const [value,label] of [[event.eventId,'Ereignis'],[event.clientRequestId,'Ereignis-Anforderungs-ID'],[event.actorId,'Ereignisautor'],[event.actorName,'Ereignisautorname'],[event.summary,'Ereignisinhalt']] as const)required(value,label);
    if(eventIds.has(event.eventId)||requestIds.has(event.clientRequestId))throw Error('Beschwerdeereignis oder Anforderungs-ID ist doppelt.');eventIds.add(event.eventId);requestIds.add(event.clientRequestId);
    const occurredAt=micros(event.occurredAt,'Ereigniszeit');const eventRecordedAt=micros(event.recordedAt,'Ereigniserfassungszeit');if(occurredAt<lastAt||eventRecordedAt<occurredAt||eventRecordedAt<lastRecordedAt)throw Error('Beschwerdehistorie ist zeitlich widersprüchlich.');lastAt=occurredAt;lastRecordedAt=eventRecordedAt;
    const evidence=event.evidence.map(item=>{for(const [value,label] of [[item.evidenceId,'Beleg'],[item.sourceEntityId,'Belegquelle'],[item.recordLocator,'Aktenstelle']] as const)required(value,label);if(!['portal_request','care_record','qm_document_version','communication','other'].includes(item.sourceType))throw Error('Beschwerdebelegart ist ungültig.');if(evidenceIds.has(item.evidenceId))throw Error('Beschwerdebeleg ist doppelt.');evidenceIds.add(item.evidenceId);fingerprint(item.sourceSha256,'Beschwerdebeleg');return Object.freeze({...item});});
    const refs=new Set(event.referencesEventIds);if(refs.size!==event.referencesEventIds.length||event.referencesEventIds.some(id=>!eventIds.has(id)))throw Error('Ereignisreferenz fehlt, ist doppelt oder zeigt in die Zukunft.');
    if(status==='closed'&&event.kind!=='reopened')throw Error('Geschlossene Beschwerde benötigt vor weiterer Bearbeitung eine ausdrückliche Wiederaufnahme.');
    if(event.kind==='investigation'){
      if(!evidence.length||event.responseRecipient||event.responseChannel||event.resultCode||event.resultSummary||event.resultSha256)throw Error('Untersuchung benötigt konkrete Belege und darf keine Antwort oder Abschlussbehauptung enthalten.');
      cycleInvestigations.add(event.eventId);status='investigating';closureResult=null;
    }else if(event.kind==='response'){
      required(event.responseRecipient,'Antwortempfänger');if(!event.responseChannel||!['letter','email','portal','phone','in_person'].includes(event.responseChannel)||!evidence.length)throw Error('Antwort benötigt Kanal und konkreten Beleg.');
      if(!event.referencesEventIds.some(id=>cycleInvestigations.has(id)))throw Error('Antwort muss eine Untersuchung des aktuellen Bearbeitungszyklus referenzieren.');
      if(event.resultCode||event.resultSummary||event.resultSha256)throw Error('Antwort darf keinen Abschluss erfinden.');cycleResponses.add(event.eventId);status='responded';
    }else if(event.kind==='closure'){
      if(status==='closed'||!cycleInvestigations.size||!cycleResponses.size)throw Error('Abschluss benötigt Untersuchung und dokumentierte Antwort im aktuellen Zyklus.');
      if(!event.resultCode)throw Error('Abschluss benötigt ein dokumentiertes Ergebnis.');if(!['resolved','partially_resolved','not_resolved','withdrawn'].includes(event.resultCode))throw Error('Abschlussergebniscode ist ungültig.');required(event.resultSummary,'Abschlussergebnis');fingerprint(event.resultSha256,'Abschlussergebnis');
      if(!event.referencesEventIds.some(id=>cycleInvestigations.has(id))||!event.referencesEventIds.some(id=>cycleResponses.has(id)))throw Error('Abschluss muss Untersuchung und Antwort des aktuellen Zyklus referenzieren.');
      if(event.responseRecipient||event.responseChannel||!evidence.length)throw Error('Abschluss benötigt einen eigenen Ergebnisbeleg und keine zweite Antwort.');status='closed';closureResult=event.resultCode;
    }else if(event.kind==='reopened'){
      if(status!=='closed'||event.evidence.length||event.responseRecipient||event.responseChannel||event.resultCode||event.resultSummary||event.resultSha256)throw Error('Wiederaufnahme ist nur nach dokumentiertem Abschluss als begründetes eigenes Ereignis zulässig.');
      status='open';closureResult=null;cycle+=1;cycleInvestigations=new Set();cycleResponses=new Set();
    }else throw Error('Beschwerdeereignisart ist ungültig.');
    return Object.freeze({...event,occurredAt,recordedAt:eventRecordedAt,evidence:Object.freeze(evidence),referencesEventIds:Object.freeze([...event.referencesEventIds])});
  });
  return Object.freeze({...input,receivedAt,dueAt,recordedAt,events:Object.freeze(events),status,cycle,closureResult,satisfaction:'not_inferred',careCompletion:'not_inferred',historyMode:'append_only'});
}
