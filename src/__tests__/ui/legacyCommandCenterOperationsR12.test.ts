import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'src/liquid-command/screens/LegacyCommandCenterScreen.tsx'),
  'utf8',
);

describe('Command Center operative rechte Spalte R12', () => {
  it('entfernt die klinische Bodymap vollständig aus dem Command Center', () => {
    expect(source).not.toContain('ClinicalBodyMapPreview');
    expect(source).not.toContain('BodyMapPanel');
    expect(source).not.toContain('bodyMapPanel');
    expect(source).not.toContain("router.push('/pflege/bodymap'");
  });

  it('ersetzt Dekoration durch eine echte operative Tagessteuerung', () => {
    expect(source).toContain('function DailyOperationsPanel');
    expect(source).toContain('HEUTE · OPERATIVE STEUERUNG');
    expect(source).toContain('Offene Einsätze');
    expect(source).toContain('Schnellaktionen');
    expect(source).toContain('Einsatz planen');
    expect(source).toContain('Nachweise prüfen');
    expect(source).toContain('Personal disponieren');
  });

  it('macht jeden Hinweis und jede Schnellaktion direkt ausführbar', () => {
    expect(source).toContain("route: '/business/office/admin/operations-monitoring'");
    expect(source).toContain("route: '/assist/nachweise/review'");
    expect(source).toContain("route: '/business/office/documents'");
    expect(source).toContain("route: '/assist/einsaetze/new'");
    expect(source).toContain("route: '/business/office/employees'");
    expect(source).toContain('accessibilityRole="button"');
  });

  it('nutzt die rechte Spalte und den Desktop vertikal ausgewogen', () => {
    expect(source).toContain("alignItems: 'stretch'");
    expect(source).toContain("alignSelf: 'stretch'");
    expect(source).toContain('operationsPanel: {');
    expect(source).toContain('minHeight: 424');
  });
});
