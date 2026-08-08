import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('R15 fachliche Assist-Klientenansicht', () => {
  it('ersetzt die generische Datensatzansicht im Assist-Startbereich', () => {
    const workspace = source('src/liquid-command/screens/ModuleWorkspaceScreen.tsx');
    expect(workspace).toContain("moduleKey === 'assist' && activeArea.id === 'clients'");
    expect(workspace).toContain('<AssistClientsWorkspace');
  });

  it('verbindet Assist-Zuordnungen, Stammdaten und Einsatzplanung', () => {
    const workspace = source('src/liquid-command/screens/AssistClientsWorkspace.tsx');
    expect(workspace).toContain("fetchClientModuleAssignments(tenantId, roleKey, 'assist')");
    expect(workspace).toContain('Assist-Klient:innen');
    expect(workspace).toContain('Nächste 7 Tage');
    expect(workspace).toContain('Kommende Einsätze');
    expect(workspace).toContain('Pflegegrad');
    expect(workspace).toContain('Kostenträger');
    expect(workspace).toContain('Zuständig');
    expect(workspace).toContain('formatCareLevel(client?.careLevel)');
  });

  it('stellt direkte Assist-Fachaktionen bereit', () => {
    const workspace = source('src/liquid-command/screens/AssistClientsWorkspace.tsx');
    expect(workspace).toContain('Klientenakte öffnen');
    expect(workspace).toContain('Einsatz planen');
    expect(workspace).toContain('Budget öffnen');
    expect(workspace).toContain('Portal & Freigaben');
    expect(workspace).toContain('clientId=${clientId}');
  });

  it('führt die alte Zuordnungsroute in dieselbe fachliche Ansicht', () => {
    const route = source('app/assist/zugeordnete-klienten.tsx');
    expect(route).toContain('<Redirect href="/assist?area=clients" />');
    expect(route).not.toContain('ModuleAssignedClientsScreen');
  });

  it('übergibt die gewählte Person an die Budgetansicht', () => {
    const budget = source('src/screens/assist/AssistBudgetOverviewScreen.tsx');
    expect(budget).toContain("useLocalSearchParams<{ clientId?: string }>()");
    expect(budget).toContain('setSelectedClientId(params.clientId)');
  });

  it('übergibt die gewählte Person an die Einsatzanlage', () => {
    const screen = source('src/screens/assist/AssignmentsListScreen.tsx');
    const form = source('src/components/assist/AssignmentCreateForm.tsx');
    expect(screen).toContain('initialCreateClientId={initialCreateClientId}');
    expect(form).toContain("clientId: initialClientId ?? ''");
  });
});
