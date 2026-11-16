// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { CarePlanCreateScreen } from '@/screens/pflege/CarePlanCreateScreen';
import type { PlanningTemplateTarget } from '@/components/pflege/CarePlanningTemplatePicker';

const save = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({ ok: true, data: { id: 'synthetic-plan' } })));
const loadPlan = vi.hoisted(() => vi.fn());
const subjects = [{ id: 'own-client', firstName: 'Nora', lastName: 'Beispiel' }];
const previousPlan = { id: 'previous-plan', tenantId: 'own-tenant', clientId: 'own-client', title: 'Mobilitätsplanung',
  validFrom: '2026-10-01', validUntil: '2026-10-30' };

vi.mock('@/lib/pflege/carePlanListService', () => ({ createCarePlan: save, fetchCarePlanList: vi.fn() }));
vi.mock('@/lib/pflege/carePlanDetailService', () => ({ fetchCarePlanDetail: loadPlan }));
vi.mock('@/components/pflege/CarePlanningTemplatePicker', () => ({
  CarePlanningTemplatePicker: ({ target, onClose }: { target: PlanningTemplateTarget; onClose: () => void }) => (
    <button onClick={() => {
      target.onInsert({ id: 'test', kind: 'goal', domain: 'movement', title: 'Fähigkeit erhalten', text: '{{person}} beteiligt sich am vereinbarten Ablauf.' });
      onClose();
    }}>Testtext übernehmen</button>
  ),
}));
vi.mock('@/lib/careAssessment', () => ({ fetchEligibleCareClients: vi.fn() }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { roleKey: 'nurse', displayName: 'Testprofil' } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => 'own-tenant' }));
vi.mock('@/hooks/useFlowRouter', () => ({ useFlowRouter: () => ({ back() {}, replace() {} }) }));
vi.mock('@/hooks/core', () => ({
  useAsyncQuery: (_request: unknown, _keys: unknown, options: { queryKey?: string; enabled: boolean }) => ({
    data: options.queryKey ? (options.enabled ? [previousPlan] : undefined) : subjects,
    loading: false,
  }),
}));
vi.mock('@/components/forms', () => ({ FormScreenHero: () => null }));
vi.mock('@/components/layout', () => ({ ScreenShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/inputs/CareDateInput', () => ({ CareDateInput: () => null }));
vi.mock('@/components/ui', () => ({
  SectionPanel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  PremiumButton: ({ title, onPress, disabled, accessibilityLabel }: { title: string; onPress: () => void; disabled?: boolean; accessibilityLabel?: string }) => (
    <button onClick={onPress} disabled={disabled} aria-label={accessibilityLabel}>{title}</button>
  ),
  PremiumInput: ({ label, value, onChangeText, labelAccessory, multiline }: {
    label: string; value: string; onChangeText: (value: string) => void; labelAccessory?: ReactNode; multiline?: boolean;
  }) => {
    const Input = multiline ? 'textarea' : 'input';
    return <><Input aria-label={label} value={value} onInput={event => onChangeText(event.currentTarget.value)} /><span>{labelAccessory}</span></>;
  },
  FilterChipGroup: ({ options, onChange }: { options: { key: string; label: string }[]; onChange?: (value: string) => void }) => (
    <>{options.map(option => <button key={option.key} onClick={() => onChange?.(option.key)}>{option.label}</button>)}</>
  ),
  ErrorState: ({ message }: { message: string }) => <div>{message}</div>,
  LoadingState: () => null,
  SuccessState: ({ message }: { message: string }) => <div>{message}</div>,
}));

it('sends all completed measures with their own care needs, goals and responsibilities in one request', async () => {
  save.mockClear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const button = (name: string) => [...host.querySelectorAll('button')].find(node => node.textContent === name)!;
  const write = (label: string, value: string, index = 0) => {
    const field = [...host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')].filter(input => input.getAttribute('aria-label') === label)[index];
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };
  try {
    await act(async () => root.render(<CarePlanCreateScreen />));
    await act(async () => {
      button('Beispiel, Nora').click();
      button('Weitere Maßnahme hinzufügen').click();
      write('Bezeichnung *', 'Morgendliche Versorgung');
      write('Pflegeprobleme und Unterstützungsbedarf *', 'Unterstützung beim Aufstehen');
      write('Fähigkeiten und Ressourcen', 'Die Person kann selbstständig sitzen');
      write('Übergreifende Pflegeziele *', 'Gewohnte Abläufe erhalten');
      button('ATL (Juchli)').click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[aria-label="Textbausteine für Übergreifende Pflegeziele *"]')!.click();
    });
    await act(async () => button('Testtext übernehmen').click());
    expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Übergreifende Pflegeziele *"]')!.value).toBe(
      'Gewohnte Abläufe erhalten\n\nNora Beispiel beteiligt sich am vereinbarten Ablauf.',
    );
    await act(async () => button('Pflegeplan speichern').click());
    expect(save).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Maßnahme 1 braucht');
    await act(async () => {
      for (const [index, title, goal] of [[0, 'Aufstehen begleiten', 'Transfer mit Unterstützung'], [1, 'Trinken unterstützen', 'Getränk erreichbar']] as const) {
        write('Maßnahme *', title, index);
        write('Pflegeziel für diese Maßnahme *', goal, index);
        write('Wie wird die Maßnahme durchgeführt? *', 'Unterstützung wie vereinbart', index);
        write('Wann und wie oft? *', 'Morgens', index);
      }
      write('Pflegeproblem oder konkreter Unterstützungsbedarf', 'Erreicht das Glas schlecht', 1);
      write('Was kann die Person selbst beitragen?', 'Kann aus dem Becher trinken', 1);
      write('Zuständige Person oder Rolle', 'Pflegekraft', 1);
    });
    await act(async () => button('Pflegeplan speichern').click());
    expect(save).toHaveBeenCalledExactlyOnceWith('own-tenant', 'nurse', expect.objectContaining({
      clientId: 'own-client',
      items: [
        expect.objectContaining({ title: 'Aufstehen begleiten', goal: 'Transfer mit Unterstützung', category: 'ATL (Juchli)', sortOrder: 0 }),
        expect.objectContaining({
          title: 'Trinken unterstützen', goal: 'Getränk erreichbar', sortOrder: 1,
          description: 'Erreicht das Glas schlecht', personContribution: 'Kann aus dem Becher trinken', responsibleRole: 'Pflegekraft',
        }),
      ],
    }));
    expect(host.textContent).toContain('Der Pflegeplan und seine Maßnahmen wurden als Entwurf gespeichert.');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it('copies the selected case plan into a new draft with fresh evaluation dates', async () => {
  save.mockClear();
  loadPlan.mockResolvedValueOnce({ ok: true, data: { ...previousPlan,
    summary: 'Begleitung beim Gehen', goals: 'Gewohnte Wege erhalten', resources: 'Nutzt den eigenen Rollator',
    tasks: [{ label: 'Weg zur Küche begleiten', category: 'Roper · Bewegung', goal: 'Sicher zur Küche gelangen',
      intervention: 'Vereinbarte Unterstützung anbieten', frequency: 'Morgens', notes: 'Den gewohnten Weg wählen',
      nextEvaluationAt: '2026-10-15', status: 'abgeschlossen' }],
  } });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const click = async (name: string) => {
    const control = [...host.querySelectorAll('button')].find(node => node.textContent === name);
    expect(control).toBeDefined();
    await act(async () => control!.click());
  };
  try {
    await act(async () => root.render(<CarePlanCreateScreen />));
    await click('Beispiel, Nora');
    await click('Vorhandene Planung übernehmen');
    await click('Mobilitätsplanung · 2026-10-01');
    await click('In neuen Entwurf übernehmen');
    expect(loadPlan).toHaveBeenCalledWith('previous-plan', 'own-tenant', 'nurse');
    expect(host.textContent).toContain('Übernommen aus „Mobilitätsplanung“.');
    await click('Pflegeplan speichern');
    expect(save).toHaveBeenCalledOnce();
    const data = save.mock.calls[0][2] as { id?: string; validUntil?: string; items: { nextEvaluationAt?: string }[] };
    expect(data.id).toBeUndefined();
    expect(data.validUntil).toBeNull();
    expect(data.items).toMatchObject([{ title: 'Weg zur Küche begleiten', category: 'Roper · Bewegung',
      notes: 'Den gewohnten Weg wählen', status: 'active' }]);
    expect(data.items[0].nextEvaluationAt).toBeUndefined();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
