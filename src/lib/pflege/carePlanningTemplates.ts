import { carePlanningGroup, type CarePlanningDomain, type CarePlanningModel, type CarePlanningSetting } from './carePlanningModels';
import { carePlanningScenarios } from './carePlanningScenarios';

export const planningTemplateKinds = {
  problem: 'Pflegeprobleme',
  cause: 'Ursachen und Einflussfaktoren',
  resource: 'Ressourcen',
  goal: 'Pflegeziele',
  measure: 'Pflegemaßnahmen',
  standard: 'Eigene Pflegestandards',
} as const;

export type PlanningTemplateKind = keyof typeof planningTemplateKinds;
export type CarePlanningTemplate = {
  id: string;
  kind: PlanningTemplateKind;
  domain: CarePlanningDomain;
  title: string;
  text: string;
  model?: CarePlanningModel | null;
  setting?: CarePlanningSetting | null;
  updatedAt?: string;
};

const person = '{{person}}';
const uppercase = (text: string) => text.charAt(0).toLocaleUpperCase('de-DE') + text.slice(1);

export const carePlanningStarterTemplates: CarePlanningTemplate[] = (
  Object.entries(carePlanningScenarios) as [CarePlanningDomain, readonly (readonly [string, string, string, string, string?])[]][]
).flatMap(([domain, scenarios]) => scenarios.flatMap(([name, problem, resource, support, influence], index) => {
  const template = (kind: PlanningTemplateKind, key: string, detail: string, text: string): CarePlanningTemplate => ({
    id: `${domain}-${index + 1}-${key}`, kind, domain, title: `${name} · ${detail}`, text,
  });
  const situation = `„${name}“`;
  const items = [
    template('problem', 'observation', 'Beobachteter Pflegebedarf', `${person} ${problem}.`),
    template('problem', 'reported', 'Geäußerter Hilfebedarf', `${person} gibt an, bei ${situation} Unterstützung zu benötigen. Der gewünschte Umfang der Hilfe wird im Gespräch geklärt.`),
    template('resource', 'ability', 'Erhaltene Fähigkeit', `${person} ${resource}.`),
    template('goal', 'retain', 'Fähigkeit erhalten', `${person} ${resource} auch im vereinbarten Alltag.`),
    template('goal', 'choice', 'Hilfe mitbestimmen', `${person} entscheidet bei ${situation} selbst über die gewünschte Unterstützung, soweit dies möglich ist.`),
    template('goal', 'signal', 'Bedarf mitteilen', `${person} zeigt oder benennt bei ${situation}, wann eine Pause oder zusätzliche Hilfe nötig ist.`),
    template('goal', 'participate', 'Teilschritte übernehmen', `${person} übernimmt bei ${situation} die selbst gewählten und sicher möglichen Teilschritte.`),
    template('measure', 'support', 'Vereinbarte Unterstützung', `${uppercase(support)}. Anschließend die Rückmeldung von ${person} einholen.`),
    template('measure', 'prefer', 'Unterstützungsumfang abstimmen', `Vor ${situation} mit ${person} abstimmen, welche Hilfe heute gewünscht ist. Selbst mögliche Teilschritte der Person überlassen.`),
    template('measure', 'observe', 'Wirkung beobachten', `Bei ${situation} festhalten, welche Schritte ${person} selbst übernimmt und in welchen Situationen sich der Hilfebedarf verändert.`),
  ];
  if (influence) items.push(
    template('problem', 'barrier', 'Erschwerender Umstand', `Bei ${situation} kommt es für ${person} unter folgender beobachteter Bedingung zu zusätzlichem Hilfebedarf. Erfasster Umstand ist ${influence}.`),
    template('cause', 'influence', 'Möglicher Einfluss', `Bei ${situation} prüfen, ob ${influence} den Unterstützungsbedarf beeinflusst. Einschätzung mit ${person} besprechen.`),
    template('measure', 'environment', 'Umfeld prüfen', `Vor ${situation} gemeinsam mit ${person} prüfen, ob ${influence} die Tätigkeit erschwert. Die vereinbarte Anpassung dokumentieren und ihre Wirkung beobachten.`),
  );
  return items;
}));

export function personalizePlanningText(text: string, clientName: string): string {
  const name = clientName.trim() || 'die pflegebedürftige Person';
  return uppercase(text.split(person).join(name));
}

export function searchPlanningTemplates(
  catalog: readonly CarePlanningTemplate[],
  filter: { model: CarePlanningModel; setting: CarePlanningSetting; kinds: readonly PlanningTemplateKind[]; domain?: CarePlanningDomain; query: string },
): CarePlanningTemplate[] {
  const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('de-DE').replaceAll('ß', 'ss');
  const terms = normalize(filter.query).trim().split(/\s+/).filter(Boolean);
  return catalog.filter(item => {
    if (!filter.kinds.includes(item.kind) || (filter.domain && filter.domain !== item.domain) ||
        (item.model && item.model !== filter.model) || (item.setting && item.setting !== filter.setting)) return false;
    if (terms.length === 0) return true;
    const group = carePlanningGroup(filter.model, item.domain)?.label ?? '';
    const haystack = normalize(`${item.title} ${item.text} ${group}`);
    return terms.every(term => haystack.includes(term));
  });
}

export function appendPlanningText(current: string, template: CarePlanningTemplate, clientName: string): string {
  const addition = personalizePlanningText(template.text, clientName);
  return current.trim() ? `${current.trimEnd()}\n\n${addition}` : addition;
}
