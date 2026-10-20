import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Gelöschte Einsätze werden nicht aus Legacy-Daten rekonstruiert', () => {
  it('behandelt eine erfolgreiche leere assist_visits-Liste als verbindlich', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/visitService.ts'),
      'utf8',
    );

    expect(source).toContain('if (visitResult.ok) {');
    expect(source).not.toContain('visitResult.ok && visitResult.data.length > 0');
    expect(source).toContain('resurrects an already deleted mirror');
  });

  it('entfernt die Karte sofort und blockiert identische Legacy-Spiegel', () => {
    const hook = fs.readFileSync(
      path.resolve(process.cwd(), 'src/hooks/useAssignmentList.ts'),
      'utf8',
    );
    const view = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/assist/AssignmentsListView.tsx'),
      'utf8',
    );

    expect(hook).toContain('hiddenDeletedKeys');
    expect(hook).toContain('dismissDeletedAssignment');
    expect(hook).toContain('deletionIdentity(item)');
    expect(view).toContain('dismissDeletedAssignment(id)');
  });
});
