import {continenceProfileIssue,continenceProfileKey} from './continenceProfileDomain.ts';
import type {CareAssessment,CareAssessmentCompleteness} from '@/types/modules/careAssessment';
type Input=Pick<CareAssessment,'personStatement'|'statementSource'|'statementSourceName'|'communicationSupport'|'professionalSummary'|'topics'|'risks'|'measures'|'nextReviewAt'>&{subjectType?:'client'|'resident'};
const coreRisks=['fall','pressure_injury','nutrition','pain','continence'];
const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const future=(v:unknown,now:number)=>{
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v)||!Number.isFinite(Date.parse(v))||Date.parse(v)<=now)return false;
  const date=v.slice(0,10),[y,m,d]=date.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)===date;
};
/** Completeness of CareSuite's own assessment. No SIS conformity or clinical approval is inferred. */
export function assessCareAssessmentCompleteness(assessment:Input,topics:readonly string[],labels:Record<string,string>,now=Date.now()):CareAssessmentCompleteness{
  const blocking:string[]=[],warnings:string[]=[];let achieved=0,possible=0;
  const check=(condition:boolean,message:string)=>{possible++;if(condition)achieved++;else blocking.push(message);};
  check(['person','relative','representative','professional','not_possible'].includes(assessment.statementSource),'Aussagequelle ausdrücklich auswählen.');
  check(assessment.statementSource==='not_possible'?text(assessment.communicationSupport):text(assessment.personStatement),'Originalaussage oder Begründung, warum sie nicht erhoben werden konnte, fehlt.');
  check(['relative','representative','professional'].includes(assessment.statementSource)?text(assessment.statementSourceName):true,'Quelle der stellvertretenden Aussage fehlt.');
  check(text(assessment.professionalSummary),'Pflegefachliche Gesamteinschätzung fehlt.');
  const topicKeys=assessment.topics.map(t=>t.topicKey);
  check(new Set(topicKeys).size===topicKeys.length&&topicKeys.every(k=>topics.includes(k)),'Themenfelder sind doppelt oder unbekannt.');
  for(const key of topics){const topic=assessment.topics.find(t=>t.topicKey===key);check(!!topic&&text(topic.professionalAssessment),`${labels[key]??key}: eigene fachliche Einschätzung fehlt.`);if(!topic||(!text(topic.personPerspective)&&!text(topic.wishes)))warnings.push(`${labels[key]??key}: Perspektive und Wünsche prüfen; keine Ersatzantwort erfinden.`);}
  const riskKeys=assessment.risks.map(r=>r.riskKey);
  check(new Set(riskKeys).size===riskKeys.length,'Risikoeinträge sind doppelt.');
  for(const key of coreRisks)check(riskKeys.includes(key),`Risikoeinschätzung ${key} fehlt; fehlende Erhebung bedeutet nicht „kein Risiko“.`);
  for(const risk of assessment.risks){
    if(assessment.subjectType!=='resident'&&risk.riskKey==='continence'&&(risk.state!=='none'||risk.focusedAssessmentKey===continenceProfileKey)){const issue=continenceProfileIssue(risk.focusedAssessmentKey,risk.focusedAssessmentResult,true,now);check(!issue,issue??'Kontinenzprofil vollständig.');}
    check(['none','unclear','present','controlled'].includes(risk.state),`${risk.riskKey}: Einschätzungsstatus fehlt.`);
    check(text(risk.professionalRationale)&&text(risk.evidence),`${risk.riskKey}: Befundgrundlage und fachliche Begründung fehlen.`);
    if(['unclear','present','controlled'].includes(risk.state)){
      check(text(risk.counselingProvided)||(risk.refusalDocumented&&text(risk.personDecision)),`${risk.riskKey}: erfolgte Beratung oder begründete Ablehnung dokumentieren.`);
      check(assessment.measures.some(m=>m.relatedRiskKey===risk.riskKey&&['planned','active'].includes(m.status)),`${risk.riskKey}: keine aktuell geplante/aktive verknüpfte Maßnahme.`);
      check(future(risk.nextReviewAt,now),`${risk.riskKey}: nächster Kontroll-/Vertiefungstermin fehlt oder ist überfällig.`);
      if(risk.state==='unclear'&&!Object.keys(risk.focusedAssessmentResult??{}).length)warnings.push(`${risk.riskKey}: Vertiefung ist noch offen; mit zuständiger fachlicher Person klären.`);
    }
  }
  check(assessment.measures.length>0,'Individuelle Maßnahmenplanung fehlt.');
  for(const [index,measure] of assessment.measures.entries()){
    const prefix=`Maßnahme ${index+1}`;
    check(['planned','active','paused','completed','cancelled'].includes(measure.status),`${prefix}: Maßnahmenstatus ist ungültig.`);
    check(text(measure.title)&&text(measure.personalGoal)&&text(measure.intervention)&&text(measure.timing)&&text(measure.frequency)&&text(measure.responsibleRole)&&text(measure.evaluationCriteria),`${prefix}: Ziel, Durchführung, Zeitpunkt, Häufigkeit, Zuständigkeit oder Evaluationskriterium fehlen.`);
    check(!measure.relatedRiskKey||riskKeys.includes(measure.relatedRiskKey),`${prefix}: verknüpftes Risiko ist nicht vorhanden.`);
    check(!measure.relatedTopicKey||topics.includes(measure.relatedTopicKey),`${prefix}: verknüpftes Themenfeld ist unbekannt.`);
    if(['planned','active'].includes(measure.status))check(future(measure.nextEvaluationAt,now),`${prefix}: Evaluationszeitpunkt fehlt oder ist überfällig.`);
  }
  check(future(assessment.nextReviewAt,now),'Nächster fachlicher Prüftermin fehlt oder ist überfällig.');
  const percent=Math.round(achieved/possible*100);
  // 100% is technical completeness only. Authentication/qualification and server validation remain separate.
  return {percent,blocking,warnings,canSubmitForReview:blocking.length===0,canApprove:blocking.length===0&&warnings.length===0};
}
