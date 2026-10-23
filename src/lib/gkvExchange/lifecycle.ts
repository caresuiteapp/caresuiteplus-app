import { GKV_SPEC, billingDay, isDate, validateDraft, type BatchStatus, type ExchangeDraft, type Issue } from './model';

/** Server-owned evidence; never populate these values from a submitted form or local storage. */
export type ReleaseEvidence = {
  payloadSha256: string; validatedSha256?: string; routingVerified:boolean; recipientRegistered:boolean;
  transportConfigured:boolean; certificateValidUntil?:string; virusScanSha256?:string;
  softwareApproval?:{prodModId:string;from:string;until:string}; proofCreationDates?:string[];
  e2eAccepted:boolean; sourceRevisionsCurrent:boolean; kimSignaturesVerified:boolean; kimSchemaValidated:boolean;
};
export function releaseIssues(draft:ExchangeDraft, evidence:ReleaseEvidence): Issue[] {
  const issues=validateDraft(draft); const add=(path:string,message:string)=>issues.push({path,message,severity:'error'});
  if (issues.some(issue => issue.severity === 'error')) return issues;
  const day=billingDay(draft.createdAt);
  if(!/^[a-f0-9]{64}$/.test(evidence.payloadSha256) || evidence.validatedSha256!==evidence.payloadSha256) add('validation','Serverseitiger Prüfbeleg für genau diese Datei fehlt.');
  if(!evidence.routingVerified) add('routing','Empfänger ist nicht anhand der gültigen Kostenträgerdatei bestätigt.');
  if(!evidence.recipientRegistered) add('registration','Teilnahme mit der zuständigen Annahmestelle ist noch nicht bestätigt.');
  if(!evidence.transportConfigured) add('transport','Ein betriebsbereiter Versandadapter fehlt.');
  if(!isDate(evidence.certificateValidUntil) || evidence.certificateValidUntil<day) add('certificate','Gültiger Verschlüsselungs-/Signaturnachweis fehlt.');
  if(evidence.virusScanSha256!==evidence.payloadSha256) add('malware','Virenschutzprüfung für genau diesen Dateiinhalt fehlt.');
  if(!evidence.sourceRevisionsCurrent) add('sources','Rechnungs- oder Nachweisstand hat sich geändert. Erneut prüfen.');
  if(draft.mode==='production' && !evidence.e2eAccepted) add('acceptance','Dokumentierte Abnahme mit der Annahmestelle fehlt.');
  if(draft.channel==='kim') {
    if(!evidence.kimSignaturesVerified) add('signature','Einzelsignaturen der Abrechnungsdaten und Leistungsnachweise fehlen.');
    if(!evidence.kimSchemaValidated) add('schema','Prüfung gegen die amtlichen XML-Schemata fehlt.');
    const a=evidence.softwareApproval;
    if(!a || !/^\d{12}$/.test(a.prodModId) || !isDate(a.from) || !isDate(a.until) || a.from>a.until || !evidence.proofCreationDates?.length || evidence.proofCreationDates.some(date=>!isDate(date) || date<a.from || date>a.until)) add('software','Gültige PROD-/MOD-ID passend zum Erstelldatum jedes Nachweises erforderlich.');
  }
  return issues;
}
export const LEGAL_TRANSITIONS: Record<BatchStatus,readonly BatchStatus[]> = {
  draft:['checked','blocked','cancelled'], checked:['draft','exported_test','queued','blocked','cancelled'],
  exported_test:['draft','checked','cancelled'], blocked:['draft','checked','cancelled'],
  queued:['sending','blocked','cancelled'], sending:['sent','delivery_unknown','blocked'],
  delivery_unknown:['sent','delivered','rejected'], sent:['delivered','rejected'],
  delivered:['accepted','rejected'], rejected:[], accepted:[], cancelled:[],
};
export function assertTransition(from:BatchStatus,to:BatchStatus):void {
  if(!LEGAL_TRANSITIONS[from]?.includes(to)) throw new Error(`Statuswechsel ${from} → ${to} ist nicht zulässig.`);
}
export type Receipt = { messageId:string; inReplyTo:string; payloadSha256:string; kind:'delivered'|'rejected'|'accepted'; code?:string; receivedAt:string };
export function applyReceipt(status:BatchStatus, expected:{messageId:string;payloadSha256:string}, receipt:Receipt):BatchStatus {
  if(!receipt.messageId || receipt.inReplyTo!==expected.messageId || receipt.payloadSha256!==expected.payloadSha256 || !Number.isFinite(Date.parse(receipt.receivedAt))) throw new Error('Rückmeldung gehört nicht eindeutig zu dieser Übermittlung.');
  if(status===receipt.kind) return status;
  assertTransition(status,receipt.kind); return receipt.kind;
}
export const READINESS_REQUIREMENTS = [
  {title:'Institutionskennzeichen & Vertrag',detail:'Eigenes IK, Abrechnungscode, Tarifkennzeichen, Vergütung und steuerliche Einordnung hinterlegen.'},
  {title:'Kostenträger & Teilnahme',detail:'Amtliche Kostenträgerdatei importieren. Teilnahme und Empfänger je Übermittlungsweg bestätigen.'},
  {title:'Nachweise aus dem Mitarbeiterportal',detail:'Leistungsdatum, tatsächliche Zeit, Beschäftigtennummer, Leistung und unterschriebener Nachweis müssen zur Rechnung passen.'},
  {title:'Übermittlung außerhalb der TI',detail:'Geprüfte PLGA-/PLAA-Datei, Auftragsdatei sowie ein funktionsfähiger Verschlüsselungs- und Versanddienst sind erforderlich.'},
  {title:'Vollelektronische KIM-Abrechnung',detail:'Zugelassene Leistungsart, KIM-Zugang, SMC-B, einzeln signierte XML-Nachweise, amtliche Schema-Prüfung und gültige PROD-/MOD-ID.'},
  {title:'Abnahme & Rückmeldungen',detail:'Annahmestellentest dokumentieren. Technische Zustellung, fachliche Annahme und Zahlung getrennt führen.'},
  {title:'Versionswechsel',detail:`TA ${GKV_SPEC.version} bis ${GKV_SPEC.validUntil}; TA ${GKV_SPEC.nextVersion} ab ${GKV_SPEC.nextValidFrom} gesondert prüfen und freigeben.`},
] as const;
