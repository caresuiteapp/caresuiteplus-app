import type { CarePlanDetail } from '@/types/modules/pflege';
import type { CareAssessment } from '@/types/modules/careAssessment';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { carePlanningModels, type CarePlanningModel } from './carePlanningModels';
import { CARE_ASSESSMENT_TOPIC_LABELS } from '../careAssessment/catalog';

type Field = readonly [label: string, content: string | null | undefined];
type PageSection = { title: string; fields: Field[] };
type DocumentPlan = {
  title: string; subject: string; setting: string; version: number; status: string;
  header: Field[]; sections: PageSection[];
};

function escape(value: string) {
  const replacements: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, character => replacements[character]);
}

function date(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = new Date(value);
  return Number.isFinite(time.getTime()) ? time.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }) : value;
}

function fields(rows: Field[]) {
  return rows.filter(([, body]) => body?.trim()).map(([name, body]) => `<div class="field"><dt>${escape(name)}</dt><dd>${escape(body!)}</dd></div>`).join('');
}

function makeDocument(plan: DocumentPlan): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Pflegeplanung · ${escape(plan.title)}</title>
  <style>
    @page{size:A4;margin:16mm} *{box-sizing:border-box} body{font:11pt/1.42 Arial,sans-serif;color:#16334c;margin:0;overflow-wrap:anywhere}
    header{border-bottom:2px solid #245b91;padding-bottom:5mm;margin-bottom:5mm} h1{font-size:21pt;margin:0 0 2mm} h2{font-size:13pt;margin:0 0 2mm;break-after:avoid} p{margin:0 0 2mm}
    dl{margin:0}.field{break-inside:avoid;display:grid;grid-template-columns:48mm minmax(0,1fr);gap:4mm;padding:2mm 0;border-bottom:1px solid #d9e3ec}
    dt{font-weight:bold}dd{margin:0;white-space:pre-wrap}section{margin-top:5mm} .signatures{break-inside:avoid;margin-top:7mm}
    .signature{display:grid;grid-template-columns:55mm 35mm 1fr;gap:5mm;margin-top:6mm}.signature span{border-top:1px solid #355570;padding-top:2mm;font-size:9pt}
  </style></head><body>
    <header><p>CareSuite HealthOS · ${escape(plan.setting)}</p><h1>${escape(plan.title)}</h1>
      <p>${escape(plan.subject)} · Version ${plan.version} · ${escape(plan.status)}</p></header>
    <dl>${fields(plan.header)}</dl>
    ${plan.sections.map(section => `<section><h2>${escape(section.title)}</h2><dl>${fields(section.fields)}</dl></section>`).join('')}
    <section class="signatures"><h2>Abzeichnung</h2>
      <div class="signature"><span>Plan erstellt durch</span><span>Datum</span><span>Handzeichen oder Unterschrift</span></div>
      <div class="signature"><span>Fachlich geprüft durch</span><span>Datum</span><span>Handzeichen oder Unterschrift</span></div>
      <div class="signature"><span>Mit der betreuten Person besprochen</span><span>Datum</span><span>Handzeichen oder Unterschrift</span></div>
    </section>
  </body></html>`;
}

export function buildCarePlanDocument(plan: CarePlanDetail): string {
  return makeDocument({
    title: plan.title, subject: plan.clientName, setting: 'Ambulante Pflege', version: plan.version ?? 1,
    status: WORKFLOW_STATUS_LABELS[plan.status],
    header: [['Pflegegrad', plan.careLevel], ['Wohnort', plan.city], ['Zuständige Pflegekraft', plan.employeeName],
      ['Gültig ab', date(plan.validFrom)], ['Gültig bis', date(plan.validUntil)], ['Nächste Planprüfung', date(plan.reviewDueAt)],
      ['Freigabe am', date(plan.approvedAt)], ['Freigegeben durch', plan.approvedByName]],
    sections: [
      { title: 'Pflegebedarf und Ziele', fields: [['Pflegeprobleme', plan.summary], ['Ressourcen', plan.resources],
        ['Risiken und Einflussfaktoren', plan.risks], ['Pflegeziele', plan.goals]] },
      ...plan.tasks.map((task, index) => ({ title: `${index + 1}. ${task.label}`, fields: [
        ['Pflegemodell und Bereich', task.category], ['Pflegeproblem', task.description], ['Eigenbeitrag', task.personContribution],
        ['Pflegeziel', task.goal], ['Durchführung', task.intervention], ['Zeitpunkt', task.timing], ['Häufigkeit', task.frequency],
        ['Zuständigkeit', task.responsibleRole], ['Beiträge der Angehörigen', task.relativesContribution], ['Warn- und Abbruchkriterien', task.warningSigns],
        ['Eskalationsweg', task.escalationPath], ['Evaluationskriterium', task.evaluationCriteria], ['Nächste Evaluation', date(task.nextEvaluationAt)],
        ['Individuelle Bemerkungen', task.notes], ['Status', WORKFLOW_STATUS_LABELS[task.status]],
      ] satisfies Field[] })),
    ],
  });
}

const assessmentStatus: Record<CareAssessment['status'], string> = {
  draft: 'Entwurf', in_progress: 'In Bearbeitung', professional_review: 'Fachliche Prüfung', approved: 'Freigegeben',
  superseded: 'Abgelöst', archived: 'Archiviert',
};

export function buildAssessmentPlanDocument(assessment: CareAssessment & { planningModel?: CarePlanningModel | null }): string {
  return makeDocument({
    title: 'Individuelle Maßnahmenplanung', subject: assessment.subjectName,
    setting: assessment.subjectType === 'resident' ? 'Stationäre Pflege' : 'Ambulante Pflege', version: assessment.version,
    status: assessmentStatus[assessment.status],
    header: [['Pflegemodell', carePlanningModels.find(model => model.key === assessment.planningModel)?.label], ['Verantwortliche Fachperson', assessment.assessorName], ['Einschätzung begonnen', date(assessment.startedAt)],
      ['Nächste Prüfung', date(assessment.nextReviewAt)], ['Freigabe am', date(assessment.approvedAt)], ['Freigegeben durch', assessment.approverName]],
    sections: [
      { title: 'Sicht der Person und fachliche Einschätzung', fields: [['Sicht der Person', assessment.personStatement], ['Fachliche Einschätzung', assessment.professionalSummary]] },
      ...assessment.measures.map((measure, index) => {
        const topic = assessment.topics.find(item => item.topicKey === measure.relatedTopicKey);
        const label = topic?.topicKey === 'living_environment' && assessment.subjectType === 'client'
          ? 'Haushaltsführung' : topic ? CARE_ASSESSMENT_TOPIC_LABELS[topic.topicKey] : undefined;
        return { title: `${index + 1}. ${measure.title}`, fields: [
          ['Themenfeld', label], ['Pflegeprobleme', topic?.impairments], ['Ressourcen', topic?.resources],
          ['Pflegeziel', measure.personalGoal], ['Durchführung', measure.intervention], ['Zeitpunkt', measure.timing],
          ['Häufigkeit', measure.frequency], ['Zuständigkeit', measure.responsibleRole], ['Eigenbeitrag', measure.personContribution],
          ['Beiträge der Angehörigen', measure.relativesContribution], ['Warn- und Abbruchkriterien', measure.warningSigns],
          ['Eskalationsweg', measure.escalationPath], ['Evaluationskriterium', measure.evaluationCriteria], ['Nächste Evaluation', date(measure.nextEvaluationAt)],
        ] satisfies Field[] };
      }),
    ],
  });
}
