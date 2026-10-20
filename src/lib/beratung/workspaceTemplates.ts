import type { ConsultationAnswers, ConsultationGoal, ConsultationKind, ConsultationMeasure, ConsultationQualification } from './workspaceModel';

/** Planning aids only. Never create findings, consent, completed exercises or signatures. */
export type ConsultationTemplate = {
  id: string;
  kind: ConsultationKind;
  category: string;
  title: string;
  description: string;
  preparation: string;
  prompts: string[];
  goal?: string;
};

export const CONSULTATION_TEMPLATES: readonly ConsultationTemplate[] = [
  { id: '37-first', kind: '37_3', category: 'Einstieg', title: 'Erstbesuch & Orientierung', description: 'Versorgung kennenlernen und gemeinsame Anliegen sammeln.', preparation: 'Anliegen der pflegebedürftigen Person und der Pflegeperson erfragen. Vorhandene Unterstützung, Hilfsmittel und offene Fragen gemeinsam sichten.', prompts: ['Wie ist der Alltag organisiert?', 'Was gelingt gut, wo wird Unterstützung gewünscht?', 'Welche nächsten Schritte sind gemeinsam sinnvoll?'] },
  { id: '37-followup', kind: '37_3', category: 'Verlauf', title: 'Folgebesuch & Veränderungen', description: 'An vorherige Empfehlungen anknüpfen.', preparation: 'Vorherige Empfehlungen bereithalten. Veränderungen seit dem letzten Besuch sowie offene Vereinbarungen und Unterstützungsbedarf besprechen.', prompts: ['Was hat sich seit dem letzten Besuch verändert?', 'Welche Empfehlungen wurden umgesetzt?', 'Was soll angepasst oder erneut aufgegriffen werden?'] },
  { id: '37-relief', kind: '37_3', category: 'Entlastung', title: 'Pflegeperson entlasten', description: 'Belastungen, Ressourcen und erreichbare Unterstützung besprechen.', preparation: 'Zeit für die Perspektive der Pflegeperson einplanen. Belastungen, verfügbare Unterstützung und gewünschte Entlastung gemeinsam besprechen.', prompts: ['Welche Situationen kosten besonders viel Kraft?', 'Welche Unterstützung steht tatsächlich zur Verfügung?', 'Welche Entlastung ist gewünscht und erreichbar?'] },
  { id: '37-mobility', kind: '37_3', category: 'Alltag', title: 'Mobilität & Wohnumgebung', description: 'Bewegung im Alltag und häusliche Bedingungen gemeinsam betrachten.', preparation: 'Mobilität, Transfers und Wohnumgebung mit den Beteiligten besprechen. Vorhandene Hilfsmittel und gewünschte Unterstützung vor Ort sichten.', prompts: ['Welche Wege und Bewegungen sind im Alltag wichtig?', 'Wo bestehen Unsicherheiten oder Hindernisse?', 'Welche individuelle Unterstützung kommt infrage?'] },
  { id: '37-dementia', kind: '37_3', category: 'Kommunikation', title: 'Demenz & Zusammenleben', description: 'Kommunikation, Orientierung und belastende Situationen aufgreifen.', preparation: 'Gewohnheiten, Kommunikation und herausfordernde Alltagssituationen erfragen. Wünsche und Entlastungsbedarf der Beteiligten berücksichtigen.', prompts: ['Welche Situationen gelingen gut?', 'Was hilft bei Orientierung und Verständigung?', 'Wo wünschen die Beteiligten weitere Unterstützung?'] },
  { id: '37-support', kind: '37_3', category: 'Versorgung', title: 'Unterstützung & Hilfsmittel', description: 'Offene Versorgungsfragen und Ansprechstellen ordnen.', preparation: 'Vorhandene Unterstützung und Hilfsmittel zusammentragen. Offene Versorgungsfragen und geeignete Ansprechstellen gemeinsam klären.', prompts: ['Welche Unterstützung wird bereits genutzt?', 'Welche Bedarfe sind noch offen?', 'Wer klärt die nächsten Schritte mit welcher Ansprechstelle?'] },
  { id: '45-transfer', kind: '45', category: 'Mobilität', title: 'Transfers im Alltag', description: 'Ein individuelles Lernziel für einen benötigten Transfer vorbereiten.', preparation: 'Gewünschten Transfer, räumliche Bedingungen, vorhandene Hilfsmittel und Voraussetzungen der Beteiligten vorab klären. Individuell geeignete Anleitung planen.', prompts: ['Welcher Transfer wird im Alltag benötigt?', 'Welche Unterstützung und Hilfsmittel sind geeignet?', 'Was konnte die Pflegeperson tatsächlich zeigen?'], goal: 'Einen individuell geeigneten Transfer unter Berücksichtigung der vorhandenen Ressourcen und Hilfsmittel durchführen können.' },
  { id: '45-position', kind: '45', category: 'Mobilität', title: 'Bewegen & Positionieren', description: 'Ressourcenorientiertes Unterstützen im Bett oder im Sitzen.', preparation: 'Benötigte Bewegungsunterstützung, Komfort, vorhandene Ressourcen und Hilfsmittel erfragen. Passendes Lernziel gemeinsam festlegen.', prompts: ['Welche Bewegung soll erleichtert werden?', 'Welche Eigenaktivität ist möglich?', 'Welche Anpassung und weitere Übung werden benötigt?'], goal: 'Eine individuell geeignete Bewegungsunterstützung oder Positionsveränderung nachvollziehen und anwenden können.' },
  { id: '45-bodycare', kind: '45', category: 'Alltag', title: 'Körperpflege & Selbstständigkeit', description: 'Gewohnheiten, Intimsphäre und vorhandene Fähigkeiten einbeziehen.', preparation: 'Gewohnheiten, Wünsche und Unterstützungsbedarf bei der Körperpflege klären. Einen konkreten Teilbereich für die Anleitung vereinbaren.', prompts: ['Welche Tätigkeit möchte die Person selbst übernehmen?', 'Welche Unterstützung wird gewünscht?', 'Wie wurden Wünsche und Intimsphäre berücksichtigt?'], goal: 'Bei einer vereinbarten Tätigkeit der Körperpflege bedarfsgerecht unterstützen und die Selbstständigkeit berücksichtigen können.' },
  { id: '45-food', kind: '45', category: 'Alltag', title: 'Essen & Trinken begleiten', description: 'Unterstützung bei einer konkret vereinbarten Alltagssituation.', preparation: 'Gewohnheiten, Wünsche und bekannte Einschränkungen beim Essen und Trinken erfragen. Geeignete Hilfsmittel und zusätzlichen fachlichen Klärungsbedarf berücksichtigen.', prompts: ['Welche Alltagssituation soll erleichtert werden?', 'Welche Voraussetzungen müssen fachlich geklärt werden?', 'Welche Unterstützung wurde tatsächlich geübt?'], goal: 'Eine individuell abgestimmte Unterstützung beim Essen oder Trinken nachvollziehen und anwenden können.' },
  { id: '45-continence', kind: '45', category: 'Alltag', title: 'Kontinenz & Intimpflege', description: 'Eine sensible Pflegesituation gemeinsam vorbereiten.', preparation: 'Individuellen Unterstützungsbedarf, Wünsche und vorhandene Materialien besprechen. Intimsphäre und vereinbarte Vorgehensweise berücksichtigen.', prompts: ['Welche konkrete Situation steht im Mittelpunkt?', 'Welche Materialien sind vorhanden und geeignet?', 'Welche Rückfragen oder weiterer Übungsbedarf bestehen?'], goal: 'Eine vereinbarte Unterstützung bei Kontinenzversorgung oder Intimpflege bedarfsgerecht durchführen können.' },
  { id: '45-communication', kind: '45', category: 'Kommunikation', title: 'Verständigung bei Demenz', description: 'Eine hilfreiche Gesprächssituation praktisch erproben.', preparation: 'Typische Kommunikationssituationen und vertraute Gewohnheiten erfragen. Eine alltagsnahe Situation für die gemeinsame Übung auswählen.', prompts: ['Welche Situation ist für die Beteiligten wichtig?', 'Welche Form der Ansprache wurde erprobt?', 'Was hat geholfen und was soll weiter geübt werden?'], goal: 'Eine individuell geeignete Form der Ansprache in einer vereinbarten Alltagssituation anwenden können.' },
  { id: '45-hygiene', kind: '45', category: 'Umgebung', title: 'Hygiene im Pflegealltag', description: 'Eine konkrete Hygienemaßnahme nachvollziehbar anleiten.', preparation: 'Konkrete Pflegesituation, vorhandene Materialien und individuelle Anforderungen klären. Passenden Übungsschwerpunkt gemeinsam auswählen.', prompts: ['Welche Tätigkeit wird angeleitet?', 'Welche Materialien und Voraussetzungen werden benötigt?', 'Welche Schritte konnte die Pflegeperson nachvollziehen?'], goal: 'Eine für die vereinbarte Pflegesituation geeignete Hygienemaßnahme erklären und anwenden können.' },
  { id: '45-aids', kind: '45', category: 'Umgebung', title: 'Vorhandene Hilfsmittel nutzen', description: 'Ein geeignetes Hilfsmittel im tatsächlichen Umfeld kennenlernen.', preparation: 'Hilfsmittel, Gebrauchsanleitung und individuelle Eignung vorab sichten. Zuständigkeit für Einweisung, Anpassung und offene Rückfragen klären.', prompts: ['Für welche Tätigkeit wird das Hilfsmittel benötigt?', 'Sind Eignung und erforderliche Einweisung geklärt?', 'Welche Anwendung konnte tatsächlich geübt werden?'], goal: 'Die vereinbarte Anwendung eines geeigneten Hilfsmittels im häuslichen Alltag nachvollziehen können.' },
];

export const PARTICIPANT_ROLES = ['Pflegebedürftige Person', 'Pflegende Person', 'Partnerin / Partner', 'Tochter / Sohn', 'Weitere angehörige Person', 'Rechtliche Vertretung', 'Sprachmittlung', 'Weitere Vertrauensperson'];
export const TEACHING_METHODS = ['Schrittweise demonstriert und erläutert', 'Gemeinsam unter Anleitung geübt', 'In eigenen Worten wiedergeben lassen', 'Selbstständige Durchführung beobachtet', 'Alltagssituation im Rollenspiel erprobt', 'Bild- oder schriftliche Anleitung gemeinsam besprochen'];
export const MATERIAL_OPTIONS = ['Individuelle Übungsanleitung', 'Kontaktübersicht', 'Gebrauchsanleitung des Hilfsmittels', 'Informationsblatt zur Entlastung', 'Merkblatt zur vereinbarten Pflegesituation'];
export const MEASURE_TEMPLATES = [
  { id: 'relief', title: 'Passende Entlastungsangebote erfragen und Rückmeldung vereinbaren.' },
  { id: 'aids', title: 'Beratungsbedarf zu geeigneten Hilfsmitteln mit der zuständigen Stelle klären.' },
  { id: 'housing', title: 'Möglichkeiten zur Anpassung der Wohnumgebung mit einer Beratungsstelle besprechen.' },
  { id: 'advice', title: 'Weiterführende individuelle Pflegeberatung anfragen.' },
  { id: 'training', title: 'Bedarf für eine individuelle häusliche Schulung und deren Voraussetzungen klären.' },
  { id: 'medical', title: 'Die dokumentierte Fragestellung mit der zuständigen behandelnden Stelle klären.' },
  { id: 'practice', title: 'Vereinbarte Übung im passenden Rahmen fortsetzen und Rückmeldung zum Unterstützungsbedarf geben.' },
  { id: 'followup', title: 'Umsetzung der vereinbarten Schritte beim nächsten Kontakt gemeinsam besprechen.' },
] as const;
export const MEASURE_OWNERS = ['Pflegebedürftige Person', 'Pflegende Person', 'Angehörige Person', 'Beratungsperson', 'Verwaltung'];
export const EVIDENCE_TYPES = ['Berufsqualifikation', 'Beratungskompetenz / Fortbildung', 'Schulungsqualifikation', 'Leistungserbringerberechtigung', 'Vertrag / Kassenvereinbarung', 'Weitere fachliche Voraussetzung'];

export function appendDistinctText(current: string, addition: string): string {
  const text = addition.trim();
  if (!text || current.split('\n').some(line => line.trim() === text) || current.trim() === text) return current;
  return [current.trimEnd(), text].filter(Boolean).join('\n');
}

export function goalFromTemplate(template: ConsultationTemplate, id: string): ConsultationGoal | null {
  return template.kind === '45' && template.goal
    ? { id, title: template.goal, method: '', practice: '', result: '', nextStep: '' }
    : null;
}

export function measureFromTemplate(title: string, id: string): ConsultationMeasure {
  return { id, title, owner: '', due: '', status: 'open', outcome: '' };
}

export function addTemplateGoal(answers: ConsultationAnswers, template: ConsultationTemplate, id: string): ConsultationAnswers {
  const goal = goalFromTemplate(template, id);
  if (!goal || answers.goals.some(g => g.title === goal.title)) return answers;
  return { ...answers, goals: [...answers.goals, goal] };
}

export function careGradeLabel(value: string | null): string {
  const grade = value?.trim();
  return grade && /^[1-5]$/.test(grade) ? `Pflegegrad ${grade}` : 'Pflegegrad nicht hinterlegt';
}

export function berlinDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(date);
}

export function dateAfterDays(days: number, today = berlinDate()): string {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function qualificationCovers(q: ConsultationQualification, kind: ConsultationKind, start: string, end = start): boolean {
  return q.active && q.service_kind === kind && q.valid_from <= start && (!q.valid_until || q.valid_until >= end);
}
