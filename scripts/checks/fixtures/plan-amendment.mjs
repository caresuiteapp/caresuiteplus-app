import {evaluationMeasureFields,emptyEvaluationEntry,planEvaluationVersion} from '../../../src/lib/careAssessment/planEvaluationDomain.ts';
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`,tenant=id(1),client=id(2),assessment=id(3),actor=id(4),now=Date.parse('2026-10-10T06:00:00Z'),time=h=>`2026-10-09T${String(h).padStart(2,'0')}:00:00.000001Z`;
const measure=(n=50)=>Object.fromEntries(evaluationMeasureFields.map(k=>[k,['relatedRiskKey','relatedTopicKey','nextEvaluationAt'].includes(k)?null:k==='id'?id(n):k==='status'?'active':`Ursprünglich ${k} ${n}`]));
const plan=()=>({assessmentId:assessment,tenantId:tenant,clientId:client,version:2,draftRevision:3,updatedAt:time(5),status:'draft',measures:[measure(),measure(51)]});
function entry(detailed=true){const e={...emptyEvaluationEntry(),evaluatedAt:time(8),periodStartAt:time(7),periodEndAt:time(8),source:'observed',outcome:'partly_effective',observedEffect:'Tatsächliche Gesamtbeobachtung',feedbackState:'given',personFeedback:'Tatsächliche Rückmeldung',professionalConclusion:'Individuelle Gesamtschlussfolgerung',nextAction:'reassess',nextActionReason:'Tatsächlicher weiterer Bedarf',reviewState:'scheduled',reviewAt:time(10),reviewReason:'Vereinbarte Prüfung'};if(detailed){const {evaluatedAt,...r}=e;e.measureReviews=[50,51].map(n=>({...r,measureId:id(n),observedEffect:`Einzelbefund ${n}`,nextActionReason:`Individuelle Folgeentscheidung ${n}`}));}return e;}
const draft=(e=entry())=>({action:'record',entry:e,reason:''});
const payload=(e=entry())=>({version:planEvaluationVersion,assessmentId:assessment,rootId:id(100),expectedHeadId:'',expectedSequence:0,snapshot:plan(),draft:draft(e)});
const record=(e=entry(),n=0)=>({root:{id:id(100+n),tenantId:tenant,assessmentId:assessment,snapshot:plan(),createdAt:time(9)},events:[{id:id(1000+n),rootId:id(100+n),sequence:1,previousId:'',requestId:id(2000+n),recordedAt:time(9),actorId:actor,actorName:'Tatsächliche Fachperson',draft:draft(e)}],headId:id(1000+n),eventCount:1});
const envelope=records=>({version:planEvaluationVersion,tenantId:tenant,assessmentId:assessment,count:records.length,records});
const decode=e=>decodeEvaluationDraft(draft(e),plan(),now);
const receipt=p=>({id:id(3000),tenantId:tenant,assessmentId:assessment,rootId:p.rootId,requestId:id(2000),previousId:p.expectedHeadId,sequence:p.expectedSequence+1});

export {id,tenant,client,assessment,actor,now,time,measure,plan,entry,record};

import {planAmendmentVersion} from '../../../src/lib/careAssessment/planAmendmentDomain.ts';
export function proposal(){const e=entry();e.measureReviews[0].nextAction='adjust';const source=record(e),target={...structuredClone(source.root.snapshot),measures:[structuredClone(source.root.snapshot.measures[0])]},proposed={...target.measures[0],intervention:'Ausdrücklich geänderte individuelle Handlung',nextEvaluationAt:'2026-10-11T10:00:00Z'};return {version:planAmendmentVersion,source,target,measureId:id(50),preparedAt:time(10),proposed,reason:'Konkreter Anlass aus der Einzelbewertung',personDecision:'Tatsächliche Entscheidung und Abstimmungsgrenze'};}
