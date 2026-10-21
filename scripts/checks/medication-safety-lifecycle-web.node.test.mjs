import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  blankMedicationSafetyEntry,
  makeMedicationSafetyPacket,
  medicationSafetyEntryIssue,
  medicationSafetyOriginalIssue,
  medicationSafetyPacketIssue,
  medicationSafetySourcesIssue,
} from '../../src/lib/pflege/medicationSafetyPacket.web.ts';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const at='2026-10-15T12:13:14.123456Z';
const later='2026-10-15T13:14:15.654321Z';
const before='2026-10-15T09:14:15.654321Z';
const sha=n=>`sha256:${String(n).repeat(64).slice(0,64)}`;
const kinds=['reconciliation','order_capture','schedule_version','administration','late_administration','non_administration','prn_administration','effect_review','safety_signal','controlled_witness','preparation_stock','order_pause_stop','prn_interval_check','maximum_dose_check','controlled_ledger','correction'];

function sources(){return {
 order:{id:id(1),revision:1,recordedAt:at,fingerprint:sha(1),medicationId:id(1),clientId:id(2),status:'active',updatedAt:at,payload:{name:'Metamizol'}},
 allergies:{id:id(2),revision:1,recordedAt:at,fingerprint:sha(2),state:'documented',text:'Latex dokumentiert'},
 documents:[{id:id(3),revision:1,recordedAt:at,fingerprint:sha(3),title:'Ärztliche Verordnung',version:'2026-10-15'}],
 administrations:[{id:id(4),revision:1,recordedAt:at,fingerprint:sha(4),status:'administered',occurredAt:before,dose:'1',unit:'Tablette',route:'oral'}],
 statusEvents:[{id:id(5),revision:1,recordedAt:at,fingerprint:sha(5),previousStatus:'active',nextStatus:'paused'}],
 witnesses:[{id:id(6),revision:1,recordedAt:at,fingerprint:sha(6),profileId:id(7),active:true,qualificationState:'current_documented'},{id:id(12),revision:1,recordedAt:at,fingerprint:sha(7),profileId:id(12),active:true,qualificationState:'registered_nurse_current'}],
 stockMovements:[{id:id(8),revision:1,recordedAt:at,fingerprint:sha(8),packageId:id(9),operation:'receipt',quantity:'10',unit:'Tablette',balanceAfter:'10'}],
};}

function entry(kind='reconciliation'){
 const e=blankMedicationSafetyEntry(kind,id(1),id(2),at,at);
 e.title=`Vollständiger Vorgang ${kind}`;
 Object.assign(e.sourceReview,{planFingerprint:sha(1),documentIds:[id(3)],allergyState:'documented',allergyText:'Latex dokumentiert',decision:'confirmed'});
 Object.assign(e.order,{medicationName:'Metamizol',activeIngredient:'Metamizol-Natrium',strength:'500 mg',form:'Tablette',dose:'1',unit:'Tablette',route:'oral',prescriber:'Ärztliche Verordnung',validFrom:'2026-10-01',validUntil:null,indication:'Dokumentierte Schmerzindikation',isPrn:false,minimumIntervalMinutes:null,maximumDose:null,maximumDoseUnit:'',maximumPeriodHours:null});
 if(['prn_administration','prn_interval_check','maximum_dose_check'].includes(kind)){e.plannedAt=later;Object.assign(e.order,{isPrn:true,minimumIntervalMinutes:'240',maximumDose:'4',maximumDoseUnit:'Tablette',maximumPeriodHours:'24'});}
 if(kind==='schedule_version')Object.assign(e.schedule,{versionId:id(10),effectiveFrom:at,slots:[{id:id(11),plannedAt:later,dose:'1',unit:'Tablette',route:'oral'}],changeReason:'Ärztlich bestätigte Änderung des Zeitfensters'});
 if(['administration','late_administration','prn_administration'].includes(kind)){e.occurredAt=later;Object.assign(e.administration,{outcome:kind==='late_administration'?'late':'administered',actualAt:later,actualDose:'1',unit:'Tablette',route:'oral',performedBy:id(12),deviationReason:kind==='late_administration'?'Einsatz begann dokumentiert verspätet':'',prnIndication:kind==='prn_administration'?'Akuter dokumentierter Schmerz':'',precedingAdministrationIds:kind==='prn_administration'?[id(4)]:[],intervalMinutes:kind==='prn_administration'?'240':null,maximumPeriodDose:kind==='prn_administration'?'2':null});}
 if(kind==='non_administration'){e.occurredAt=later;Object.assign(e.administration,{outcome:'refused',actualAt:null,actualDose:null,unit:'',route:'',performedBy:null,deviationReason:'Klientin lehnte die angebotene Gabe ausdrücklich ab'});}
 if(kind==='prn_interval_check')Object.assign(e.administration,{precedingAdministrationIds:[id(4)],intervalMinutes:'300'});
 if(kind==='maximum_dose_check')Object.assign(e.administration,{precedingAdministrationIds:[id(4)],maximumPeriodDose:'1',unit:'Tablette'});
 if(kind==='effect_review')Object.assign(e.effect,{administrationId:id(4),observedAt:later,observation:'Wirkung getrennt nach der bestätigten Gabe beobachtet',action:'Erneute Kontrolle gemäß individuellem Plan',painScore:3});
 if(kind==='safety_signal')Object.assign(e.safety,{state:'suspected',observation:'Neue Hautrötung beobachtet',suspectedRelation:'Zeitlicher Zusammenhang wird nur vermutet',reaction:'Weitere Gabe zurückgestellt und Verlauf beobachtet',clinicianContact:'Ärztlichen Bereitschaftsdienst kontaktiert',followUp:'Übergabe und erneute Kontrolle dokumentiert'});
 if(kind==='controlled_witness'){e.administration.performedBy=id(19);Object.assign(e.witness,{required:true,profileId:id(12),assertion:'independently_authenticated',signedAt:later,signatureId:id(30),qualificationEvidence:'registered_nurse_current'});}
 if(['preparation_stock','controlled_ledger'].includes(kind))Object.assign(e.stock,{operation:'receipt',packageId:id(13),batch:'CHARGE-2026',expiry:'2027-12-31',quantity:'2',unit:'Tablette',balanceBefore:'10',balanceAfter:'12',reason:'Dokumentierter Zugang derselben Packung',responsibleBy:id(12)});
 if(kind==='order_pause_stop')Object.assign(e.orderStatus,{current:'active',next:'paused',effectiveAt:later,reason:'Ärztlich angeordnete Pause mit dokumentierter Rückprüfung',authorizationId:id(14),followUpPlanId:id(15)});
 if(kind==='correction')Object.assign(e.correction,{targetEventId:id(4),reason:'Begründeter append-only Nachtrag zum historischen Ereignis',replacementEventId:id(16),approvedBy:id(17),approvedAt:later});
 return e;
}

function original(kind='reconciliation'){
 const first=entry(kind),second=structuredClone(first);second.title+=' fortgeschrieben';
 return {id:id(22),tenantId:id(20),clientId:id(2),medicationId:id(1),rootId:id(21),headId:id(22),revision:2,kind,recordedAt:later,recordedBy:id(12),recordedByName:'Pflegefachperson',payload:second,contentFingerprint:sha(9),voided:false,history:[{id:id(21),revision:1,previousId:null,recordedAt:at,recordedBy:id(12),recordedByName:'Pflegefachperson',reason:'',payload:first,contentFingerprint:sha(8)},{id:id(22),revision:2,previousId:id(21),recordedAt:later,recordedBy:id(12),recordedByName:'Pflegefachperson',reason:'Konkrete fachliche Fortschreibung',payload:second,contentFingerprint:sha(9)}]};
}
function packet(e,o=null){return {schemaVersion:'1',action:o?'revise':'create',requestId:id(30),tenantId:id(20),clientId:id(2),medicationId:id(1),actorId:id(12),expectedHeadId:o?.headId??null,expectedRevision:o?.revision??0,entry:e,reason:o?'Konkrete fachliche Fortschreibung':'',original:o,sources:sources()};}

for(const kind of kinds)test(`${kind} verbindet Verordnung, Quellen, Entscheidung, Verlauf und Abschlusszustand`,()=>assert.equal(medicationSafetyEntryIssue(entry(kind)),null));
test('Verordnungserfassung bleibt bei ungeklärter Quelle offen',()=>{const e=entry('order_capture');e.sourceReview.decision='unresolved';e.lifecycle='open';assert.equal(medicationSafetyEntryIssue(e),null);});
test('ungeklärte Verordnung darf nicht abgeschlossen werden',()=>{const e=entry('order_capture');e.sourceReview.decision='unresolved';e.lifecycle='completed';assert.match(medicationSafetyEntryIssue(e),/Ungeklärte/);});
test('Regelmedikation darf keine stillen Bedarfsgrenzen tragen',()=>{const e=entry();e.order.maximumDose='4';assert.match(medicationSafetyEntryIssue(e),/Bedarfsgrenzen/);});
test('Bedarfsverordnung braucht alle Grenzen und Bezugszeitraum',()=>{const e=entry('prn_administration');e.order.maximumPeriodHours=null;assert.match(medicationSafetyEntryIssue(e),/Bedarfsmedikation/);});
test('Planversion benötigt eindeutige Slots und begründete Änderung',()=>{const e=entry('schedule_version');e.schedule.slots.push({...e.schedule.slots[0]});assert.match(medicationSafetyEntryIssue(e),/eindeutige Zeitfenster/);});
test('Planung wird nie als tatsächliche Gabe abgeleitet',()=>{const e=entry('reconciliation');e.administration.outcome='administered';assert.match(medicationSafetyEntryIssue(e),/Planung/);});
test('tatsächliche Gabe bindet Ereigniszeit und ausführende Person',()=>{const e=entry('administration');e.administration.performedBy=null;assert.match(medicationSafetyEntryIssue(e),/ausführende Person/);});
test('Paket- und tatsächliche Gabezeit bleiben identisch',()=>{const e=entry('administration');e.occurredAt=at;assert.match(medicationSafetyEntryIssue(e),/identisch/);});
test('Nichtgabe enthält keine Dosis, Gabezeit oder ausführende Person',()=>{const e=entry('non_administration');e.administration.actualDose='1';assert.match(medicationSafetyEntryIssue(e),/keine tatsächliche Dosis/);});
test('verspätete Gabe braucht konkreten Abweichungsgrund',()=>{const e=entry('late_administration');e.administration.deviationReason='';assert.match(medicationSafetyEntryIssue(e),/Tatsächliche Gabe/);});
test('Bedarfsgabe sperrt unterschrittenen Mindestabstand',()=>{const e=entry('prn_administration');e.administration.intervalMinutes='239.999';assert.match(medicationSafetyEntryIssue(e),/Mindestabstand/);});
test('Bedarfsgabe sperrt überschrittene Höchstmenge',()=>{const e=entry('prn_administration');e.administration.maximumPeriodDose='4.001';assert.match(medicationSafetyEntryIssue(e),/Höchstmenge/);});
test('Abstandsprüfung bindet mindestens eine tatsächliche vorherige Gabe',()=>{const e=entry('prn_interval_check');e.administration.precedingAdministrationIds=[];assert.match(medicationSafetyEntryIssue(e),/vorherige/);});
test('Höchstmengenprüfung bindet Originaleinheit und tatsächliche Gaben',()=>{const e=entry('maximum_dose_check');e.administration.unit='mg';assert.match(medicationSafetyEntryIssue(e),/Originaleinheit/);});
test('Wirkungskontrolle ist ein eigener Nachtrag mit Beobachtung und Maßnahme',()=>{const e=entry('effect_review');e.effect.action='';assert.match(medicationSafetyEntryIssue(e),/Maßnahme/);});
test('Sicherheitsverdacht bleibt ohne automatische Diagnose',()=>{const e=entry('safety_signal');e.safety.suspectedRelation='';assert.match(medicationSafetyEntryIssue(e),/nur vermuteten Bezug/);});
test('Personenauswahl allein darf Zweitsignatur nicht abschließen',()=>{const e=entry('controlled_witness');Object.assign(e.witness,{assertion:'selection_only',signedAt:null,signatureId:null});e.lifecycle='completed';assert.match(medicationSafetyEntryIssue(e),/Abschluss/);});
test('unabhängige Zweitsignatur braucht Zeit, ID und Qualifikationsbeleg',()=>{const e=entry('controlled_witness');e.witness.signedAt=null;e.lifecycle='completed';assert.match(medicationSafetyEntryIssue(e),/Gegenkontrolle/);});
test('vollständige unabhängige Zweitsignatur kann abgeschlossen werden',()=>{const e=entry('controlled_witness');e.lifecycle='completed';assert.equal(medicationSafetyEntryIssue(e),null);});
test('Gegenkontrolle braucht eine getrennte ausführende Person',()=>{const e=entry('controlled_witness');e.administration.performedBy=id(12);assert.match(medicationSafetyEntryIssue(e),/andere aktuelle Person/);});
test('Zugang rechnet Packungsbestand exakt fort',()=>{const e=entry('preparation_stock');e.stock.balanceAfter='11.999';assert.match(medicationSafetyEntryIssue(e),/rechnerisch/);});
test('Abgang rechnet Packungsbestand exakt in derselben Einheit fort',()=>{const e=entry('controlled_ledger');Object.assign(e.stock,{operation:'consumption',packageId:id(9),quantity:'2',balanceBefore:'10',balanceAfter:'8'});assert.equal(medicationSafetyEntryIssue(e),null);});
test('BtM-Bestandsbuch braucht Charge und Haltbarkeit',()=>{const e=entry('controlled_ledger');e.stock.batch='';assert.match(medicationSafetyEntryIssue(e),/Charge/);});
test('Pausieren und Beenden benötigen Freigabe und Folgeplan',()=>{const e=entry('order_pause_stop');e.orderStatus.followUpPlanId=null;assert.match(medicationSafetyEntryIssue(e),/Folgeplan/);});
test('Korrektur erhält Original und benötigt neue Identität',()=>{const e=entry('correction');e.correction.replacementEventId=e.correction.targetEventId;assert.match(medicationSafetyEntryIssue(e),/neue Ereignisidentität/);});
test('vollständige Quellen mit Mikrosekundenrevision werden akzeptiert',()=>assert.equal(medicationSafetySourcesIssue(sources()),null));
test('fehlende Quellgruppe wird abgewiesen',()=>{const s=sources();delete s.documents;assert.match(medicationSafetySourcesIssue(s),/Quelloriginale/);});
test('doppelte Quellidentität wird abgewiesen',()=>{const s=sources();s.documents.push({...s.documents[0]});assert.match(medicationSafetySourcesIssue(s),/doppelt/);});
test('beschädigte Quellfingerprints werden abgewiesen',()=>{const s=sources();s.order.fingerprint='sha256:kaputt';assert.match(medicationSafetySourcesIssue(s),/Verordnungsoriginal/);});
test('vollständige append-only Historie wird akzeptiert',()=>assert.equal(medicationSafetyOriginalIssue(original(),{tenantId:id(20),clientId:id(2),medicationId:id(1)}),null));
test('Revisionslücke wird abgewiesen',()=>{const o=original();o.history[1].revision=3;assert.match(medicationSafetyOriginalIssue(o,{tenantId:id(20),clientId:id(2),medicationId:id(1)}),/historie/i);});
test('Originalkopf muss exakt dem letzten Historieneintrag entsprechen',()=>{const o=original();o.recordedByName='Andere Person';assert.match(medicationSafetyOriginalIssue(o,{tenantId:id(20),clientId:id(2),medicationId:id(1)}),/originalkopf/i);});
test('Neuanlage kopiert Paket und Quellen vor späterer Mutation tief',()=>{const e=entry(),s=sources(),p=makeMedicationSafetyPacket({...packet(e),sources:s});e.title='später verändert';s.documents[0].title='später verändert';assert.notEqual(p.entry.title,e.title);assert.notEqual(p.sources.documents[0].title,s.documents[0].title);});
test('bestätigtes Paket ist bis in verschachtelte Originale unveränderlich',()=>{const p=makeMedicationSafetyPacket(packet(entry()));assert.equal(Object.isFrozen(p.entry.order),true);assert.equal(Object.isFrozen(p.sources.documents[0]),true);assert.throws(()=>{p.entry.order.dose='9';},TypeError);});
test('Paket bindet Verordnungsrevision und Fingerprint',()=>{const p=packet(entry());p.sources.order.updatedAt=later;assert.match(medicationSafetyPacketIssue(p),/aktuelle Verordnung/);});
test('Paket bindet Allergiefassung unverändert',()=>{const p=packet(entry());p.sources.allergies.text='Andere Fassung';assert.match(medicationSafetyPacketIssue(p),/Allergien/);});
test('Wirkungskontrolle bindet bestätigte tatsächliche Gabe im Vollbestand',()=>{const p=packet(entry('effect_review'));p.sources.administrations[0].status='omitted';assert.match(medicationSafetyPacketIssue(p),/bestätigte tatsächliche Gabe/);});
test('Bedarfsprüfung bindet jede verwendete vorherige Gabe im Vollbestand',()=>{const p=packet(entry('prn_interval_check'));p.entry.administration.precedingAdministrationIds=[id(99)];assert.match(medicationSafetyPacketIssue(p),/passende tatsächliche Gabe/);});
test('Abstandsprüfung wird aus den nativen Originalzeiten nachgerechnet',()=>{const p=packet(entry('prn_interval_check'));p.entry.administration.intervalMinutes='240.001';assert.match(medicationSafetyPacketIssue(p),/Abstandsminuten/);});
test('Bedarfsgabe rechnet vorherige und neue Dosis zur Zeitraumssumme zusammen',()=>{const p=packet(entry('prn_administration'));p.entry.administration.maximumPeriodDose='3';assert.match(medicationSafetyPacketIssue(p),/Zeitraumssumme/);});
test('Legacy-Dosis ohne Struktur wird nicht für Höchstmengen geschätzt',()=>{const p=packet(entry('maximum_dose_check'));p.sources.administrations[0].dose='1 Tablette';assert.match(medicationSafetyPacketIssue(p),/strukturierte tatsächliche Originaldosen/);});
test('Gegenkontrolle bindet eine aktive aktuelle andere Person',()=>{const p=packet(entry('controlled_witness'));p.sources.witnesses.find(x=>x.profileId===id(12)).active=false;assert.match(medicationSafetyPacketIssue(p),/Personenbestand/);});
test('Zweitsignatur bindet die eigene aktuelle Sitzung',()=>{const p=packet(entry('controlled_witness'));p.actorId=id(18);assert.match(medicationSafetyPacketIssue(p),/eigene aktuelle Sitzung/);});
test('Zweitsignatur bindet dieselbe Anfrageidentität',()=>{const p=packet(entry('controlled_witness'));p.entry.witness.signatureId=id(31);assert.match(medicationSafetyPacketIssue(p),/Anfrage/);});
test('Zweitsignatur übernimmt Qualifikation nur aus aktuellem vollständigem Personenbestand',()=>{const p=packet(entry('controlled_witness'));p.entry.witness.qualificationEvidence='Selbsteingabe';assert.match(medicationSafetyPacketIssue(p),/Qualifikationsfassung/);});
test('Zugang darf eine neue Packung anlegen',()=>assert.equal(medicationSafetyPacketIssue(packet(entry('controlled_ledger'))),null));
test('Abgang wird ohne vollständig gelesenen Packungsbestand verweigert',()=>{const p=packet(entry('controlled_ledger'));Object.assign(p.entry.stock,{operation:'consumption',packageId:id(13),quantity:'2',balanceBefore:'10',balanceAfter:'8'});assert.match(medicationSafetyPacketIssue(p),/Packungsbestand/);});
test('Abgang mit passendem Packungsoriginal ist zulässig',()=>{const p=packet(entry('controlled_ledger'));Object.assign(p.entry.stock,{operation:'consumption',packageId:id(9),quantity:'2',balanceBefore:'10',balanceAfter:'8'});assert.equal(medicationSafetyPacketIssue(p),null);});
test('Fortschreibung bindet vollständiges Original, CAS, Grund und echte Änderung',()=>{const o=original(),e=structuredClone(o.payload);e.title+=' erneut';assert.equal(medicationSafetyPacketIssue(packet(e,o)),null);});
test('identische Fortschreibung wird abgewiesen',()=>{const o=original();assert.match(medicationSafetyPacketIssue(packet(o.payload,o)),/echte Änderung/);});
test('falscher CAS-Kopf wird abgewiesen',()=>{const o=original(),e=structuredClone(o.payload);e.title+=' erneut';const p=packet(e,o);p.expectedHeadId=id(99);assert.match(medicationSafetyPacketIssue(p),/CAS/);});
test('Gesamtweg verbindet private Originale, Seitenlesen, Rechtewechsel, Journal, Quittung und aktive Weboberfläche',()=>{
 const sql=fs.readFileSync(new URL('../../supabase/patches/ambulatory_medication_safety_packet.sql',import.meta.url),'utf8');
 const repo=fs.readFileSync(new URL('../../src/lib/pflege/medicationSafetyRepository.supabase.web.ts',import.meta.url),'utf8');
 const workflow=fs.readFileSync(new URL('../../src/lib/pflege/medicationSafetyWorkflow.web.ts',import.meta.url),'utf8');
 const panel=fs.readFileSync(new URL('../../src/components/pflege/MedicationSafetyWorkspacePanel.web.tsx',import.meta.url),'utf8');
 const screen=fs.readFileSync(new URL('../../src/screens/pflege/MedicationDetailScreen.web.tsx',import.meta.url),'utf8');
 for(const token of ['medication_safety_events','medication_safety_requests','enable row level security','revoke all','auth.sessions','current_tenant_id()','medication_client_is_active','pflege.medications.view','pflege.medications.manage','pflege.medications.administer','pg_advisory_xact_lock','expectedHeadId','expectedRevision',"security invoker set search_path=''","security definer set search_path=''",'web_read_medication_safety_context','web_read_medication_safety_page','web_commit_medication_safety_packet','web_confirm_medication_safety_packet'])assert(sql.includes(token),token);
 for(const token of ['for(let page=0;page<100;page++)','response.data.rows.length===0','response.data.nextCursorRecordedAt','response.data.nextCursorId','medicationSafetySourcesIssue'])assert(repo.includes(token),token);
 for(const token of ["phase:'prepared'","phase:'dispatched'",'const captured=structuredClone(p);return locked','confirmMedicationSafetyPacket','navigator','locks','uncertain'])assert(workflow.includes(token),token);
 for(const token of ['readMedicationSafetyPrerequisites','readMedicationSafetyPage','recoverMedicationSafety','saveMedicationSafetyDurably','Strukturierte Verordnungsfassung','aktuell angemeldeten Gegenkontrollperson','native Quittung erneut prüfen'])assert(panel.includes(token),token);
 assert(screen.includes('MedicationSafetyWorkspacePanel'));
 assert(!fs.readFileSync(new URL('../../src/screens/pflege/MedicationDetailScreen.tsx',import.meta.url),'utf8').includes('MedicationSafetyWorkspacePanel'));
});
