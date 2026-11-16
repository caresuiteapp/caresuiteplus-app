// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { CarePlanCreateScreen } from '@/screens/pflege/CarePlanCreateScreen';

const save = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({ ok: true, data: { id: 'synthetic-plan' } })));
const subjects = [{ id: 'own-client', firstName: 'Nora', lastName: 'Beispiel' }];

vi.mock('@/lib/pflege/carePlanListService', () => ({ createCarePlan: save }));
vi.mock('@/lib/careAssessment', () => ({ fetchEligibleCareClients: vi.fn() }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { roleKey: 'nurse', displayName: 'Testprofil' } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => 'own-tenant' }));
vi.mock('@/hooks/useFlowRouter', () => ({ useFlowRouter: () => ({ back() {}, replace() {} }) }));
vi.mock('@/hooks/core', () => ({ useAsyncQuery: () => ({ data: subjects, loading: false }) }));
vi.mock('@/components/forms', () => ({ FormScreenHero: () => null }));
vi.mock('@/components/layout', () => ({ ScreenShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/inputs/CareDateInput', () => ({ CareDateInput: () => null }));
vi.mock('@/components/ui', () => ({
  SectionPanel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  PremiumButton: ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) => (
    <button onClick={onPress} disabled={disabled}>{title}</button>
  ),
  PremiumInput: ({ label, onChangeText }: { label: string; onChangeText: (value: string) => void }) => (
    <input aria-label={label} onInput={event => onChangeText(event.currentTarget.value)} />
  ),
  FilterChipGroup: ({ options, onChange }: { options: { key: string; label: string }[]; onChange?: (value: string) => void }) => (
    <>{options.map(option => <button key={option.key} onClick={() => onChange?.(option.key)}>{option.label}</button>)}</>
  ),
  ErrorState: ({ message }: { message: string }) => <div>{message}</div>,
  LoadingState: () => null,
  SuccessState: ({ message }: { message: string }) => <div>{message}</div>,
}));

it('sends all completed measures with their own care needs, goals and responsibilities in one request', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const button = (name: string) => [...host.querySelectorAll('button')].find(node => node.textContent === name)!;
  const write = (label: string, value: string, index = 0) => {
    const field = [...host.querySelectorAll('input')].filter(input => input.getAttribute('aria-label') === label)[index];
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
    });
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
        expect.objectContaining({ title: 'Aufstehen begleiten', goal: 'Transfer mit Unterstützung', sortOrder: 0 }),
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
