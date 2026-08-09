import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('budget visuals are mounted on the routes users actually open', () => {
  it('renders both budget cards directly on the client portal budget route', () => {
    const route = source('app/portal/client/budget/index.tsx');

    expect(route).toContain('fetchPortalBudgetVisuals');
    expect(route).toContain('<ClientBudgetVisualCards models={visuals} />');
    expect(route).not.toContain('buildClientBudgetVisualPlaceholders');
    expect(route).toContain('Es werden keine Ersatzbeträge angezeigt');
    expect(route).not.toContain('PortalSectionGate');
    expect(route).not.toContain('Kein Budget freigegeben');
  });

  it('uses the real budget workspace instead of the generic billing assignment list', () => {
    const route = source('app/assist/abrechnungsquellen.tsx');
    const screen = source('src/screens/assist/AssistBudgetOverviewScreen.tsx');

    expect(route).toContain('<AssistBudgetOverviewScreen />');
    expect(route).not.toContain('OfficeModuleAssignmentListScreen');
    expect(screen).toContain('fetchClientList');
    expect(screen).toContain('<ClientCareGradeBudgetsPanel clientId={selectedClientId}');
    expect(screen).toContain('assist-budget-live-panel');
  });
});
