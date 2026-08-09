import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Business-Dashboard Tour UI wiring', () => {
  it('BusinessDashboardScreen enthält keinen verwaisten Tour-Auslöser', () => {
    const screen = readSrc('src/screens/BusinessDashboardScreen.tsx');
    expect(screen).not.toContain('useBusinessDashboardTour');
    expect(screen).not.toContain('Tour starten');
    expect(screen).toContain('ModuleOverviewDashboard');
  });

  it('GuidedTourOverlay bietet Weiter und Fertig Aktionen', () => {
    const overlay = readSrc('src/components/onboarding/GuidedTourOverlay.tsx');
    expect(overlay).toContain('Überspringen');
    expect(overlay).toContain('Weiter');
    expect(overlay).toContain('Fertig');
  });
});
