import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('client budget UI rebuild', () => {
  const office = source('src/components/office/ClientCareGradeBudgetsPanel.tsx');
  const visuals = source('src/components/office/ClientBudgetVisualCards.tsx');
  const portalDashboard = source('src/components/portal/assist/ClientPortalHomeDashboard.tsx');
  const portalDashboardService = source('src/lib/portal/assist/portalAssistDashboardService.ts');

  it('replaces the former technical section stack with one clear budget workspace', () => {
    expect(office).toContain('Budget auf einen Blick');
    expect(office).toContain('ClientBudgetVisualCards');
    expect(office).not.toContain('Abrechnungslogik');
    expect(office).not.toContain('Budgetmodus');
    expect(office).not.toContain('BudgetAccountsEditableGrid');
  });

  it('contains understandable money, hours, reservation, consumption and care allowance states', () => {
    expect(visuals).toContain('noch verfügbar');
    expect(visuals).toContain('Einsätze geplant');
    expect(visuals).toContain('Verbraucht');
    expect(visuals).toContain('Voraussichtliches Pflegegeld');
    expect(visuals).toContain('Stundensatz fehlt');
  });

  it('uses the same rebuilt visuals in the shared responsive client portal dashboard', () => {
    expect(portalDashboard).toContain('<ClientBudgetVisualCards models={data.budgetVisuals} />');
    expect(portalDashboard).not.toContain('data.budgetVisuals.length > 0');
    expect(portalDashboard).not.toContain('budgetReleased && data.budgetVisuals.length > 0');
    expect(visuals).not.toContain('buildClientBudgetVisualPlaceholders');
    expect(visuals).toContain('Es werden keine');
    expect(visuals).toContain('Ersatzbeträge oder Beispielwerte berechnet');
    expect(portalDashboardService).toContain('fetchPortalBudgetVisuals(tenantId, clientId)');
    expect(portalDashboardService).toContain('budgetVisuals,');
    expect(portalDashboardService).not.toContain('budgetVisuals: budgetReleased ? budgetVisuals : []');
    expect(portalDashboard).toContain('Entlastungsbetrag und 40-%-Umwandlung');
  });
});
