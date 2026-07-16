import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Einsatz-Löschschutz', () => {
  it('zeigt endgültiges Löschen ausschließlich für Entwürfe', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/assist/AssignmentDetailTabsPanel.tsx'),
      'utf8',
    );
    expect(source).toContain("visit.planningStatus === 'draft'");
    expect(source).toContain('Entwurf löschen');
  });

  it('weist endgültiges Löschen geplanter Einsätze auch im Repository zurück', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/repositories/visitRepository.supabase.ts'),
      'utf8',
    );
    expect(source).toContain("planning_status !== 'draft'");
    expect(source).toContain('Geplante Einsätze bitte absagen');
  });
});
