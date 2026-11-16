import { describe, expect, it } from 'vitest';
import { carePlanningModels, planningDomains, planningGroups } from '@/lib/pflege/carePlanningModels';
import { appendPlanningText, carePlanningStarterTemplates, searchPlanningTemplates } from '@/lib/pflege/carePlanningTemplates';
import { buildCarePlanDocument } from '@/lib/pflege/carePlanDocument';
import { buildPflegeCrossModuleLinks } from '@/lib/pflege/pflegeCrossModuleLinks';
import type { CarePlanDetail } from '@/types/modules/pflege';

describe('Pflegeplanungskatalog', () => {
  it('gives every model a distinct, complete domain structure with the requested catalogue counts', () => {
    const expected = Object.keys(planningDomains).sort();
    const structures = carePlanningModels.map(({ key }) => {
      const groups = planningGroups[key];
      expect(groups.flatMap(group => [...group.domains]).sort()).toEqual(expected);
      return groups.map(group => group.label).join('|');
    });
    expect(new Set(structures).size).toBe(6);

    expect(new Set(carePlanningStarterTemplates.map(item => item.id)).size).toBe(carePlanningStarterTemplates.length);
    expect(carePlanningStarterTemplates.filter(item => item.kind === 'problem')).toHaveLength(500);
    expect(carePlanningStarterTemplates.filter(item => item.kind === 'resource')).toHaveLength(200);
    expect(carePlanningStarterTemplates.filter(item => ['goal', 'measure'].includes(item.kind))).toHaveLength(1500);
    expect(carePlanningStarterTemplates.filter(item => item.kind === 'cause')).toHaveLength(100);
  });

  it('filters to the chosen model, care setting and kind, then adds texts without overwriting edits', () => {
    const builtIn = carePlanningStarterTemplates.find(item => item.title.startsWith('Toilette erreichen') && item.kind === 'problem')!;
    const custom = { ...builtIn, id: 'user-template', title: 'Toilette erreichen im eigenen Standard', model: 'atl' as const, setting: 'stationaer' as const };
    const filters = { model: 'atl' as const, setting: 'stationaer' as const, kinds: ['problem'] as const, query: 'TOILETTE erreichen' };
    expect(searchPlanningTemplates([custom, builtIn], filters).map(item => item.id)).toEqual([custom.id, builtIn.id]);
    expect(searchPlanningTemplates([custom, builtIn], { ...filters, setting: 'ambulant' }).map(item => item.id)).toEqual([builtIn.id]);
    expect(searchPlanningTemplates([custom, builtIn], { ...filters, model: 'orem' }).map(item => item.id)).toEqual([builtIn.id]);
    const customized = appendPlanningText('Individuell vereinbarter Ablauf.', builtIn, 'Nora Beispiel');
    expect(customized).toContain('Individuell vereinbarter Ablauf.\n\nNora Beispiel');
    expect(customized).not.toContain('{{person}}');
  });

  it('prints the saved plan, individual notes and blank sign-off fields using escaped text', () => {
    const plan = {
      title: 'Pflegeplan <Nord>', clientName: 'Nora Beispiel', version: 4, status: 'entwurf',
      validFrom: '2026-11-16', notes: '', summary: 'Unterstützungsbedarf', goals: 'Selbstständigkeit',
      tasks: [{ label: 'Maßnahme', category: 'FEDL (Messer) · Wohlbefinden', status: 'aktiv',
        description: 'Individueller Pflegebedarf', personContribution: 'Eigener Beitrag', nextEvaluationAt: '2026-11-23',
        notes: '<script>synthetic()</script>',
      }],
    } as unknown as CarePlanDetail;
    const html = buildCarePlanDocument(plan);
    for (const value of ['size:A4', 'Version 4', 'Pflegeplan &lt;Nord&gt;', 'FEDL (Messer)', 'Eigener Beitrag', '23.11.2026', 'Handzeichen oder Unterschrift', '&lt;script&gt;synthetic()']) {
      expect(html).toContain(value);
    }
    expect(html).not.toContain('<script>');
  });

  it('requires the linked workspace rights and sends the selected plan or client as context', () => {
    const scope = {
      clientId: 'client-id',
      carePlanId: 'plan-id',
      can: (key: string) => ['pflege.plans.view', 'inventory.view', 'office.documents.view'].includes(key),
    };
    expect(buildPflegeCrossModuleLinks('care-plan', scope).map(link => link.id)).toEqual(['sis']);
    const links = buildPflegeCrossModuleLinks('care-plan', { ...scope, can: () => true });
    expect(links.find(link => link.id === 'evaluation')?.href).toBe('/pflege/evaluation?carePlanId=plan-id');
    expect(links.find(link => link.id === 'supplies')?.href).toBe('/pflege/inventar?clientId=client-id');
  });
});
