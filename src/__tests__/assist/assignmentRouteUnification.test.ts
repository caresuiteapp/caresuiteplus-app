import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Assist assignment route unification', () => {
  it('uses one canonical assignment list without a second modal-list route', () => {
    const canonical = read('app/assist/(tabs)/assignments.tsx');
    const alias = read('app/assist/einsaetze/index.tsx');
    expect(canonical).toContain('AssignmentsListScreen');
    expect(canonical).not.toContain('AssignmentsAdaptiveScreen');
    expect(alias).toContain('<Redirect href="/assist/assignments"');
  });

  it('routes edit, execution, documentation and proof to their deliberate targets', () => {
    const list = read('src/components/assist/AssignmentsListView.tsx');
    expect(list).toContain('/assist/assignments/${assignment.id}/edit');
    expect(list).toContain('/assist/assignments/${assignment.id}/execute');
    expect(list).toContain('?tab=execution');
    expect(list).toContain('?tab=proof');
    expect(list).not.toContain("label: 'Navigation'");
    expect(list).not.toContain("label: 'Anrufen'");
    expect(list).not.toContain("label: 'Route'");
  });

  it('does not load assignment, execution or office master lists twice', () => {
    const screens = [
      'src/screens/assist/AssignmentsListScreen.tsx',
      'src/screens/assist/ExecutionsListScreen.tsx',
      'src/screens/assist/TripsListScreen.tsx',
      'src/screens/office/ClientsListScreen.tsx',
      'src/screens/office/EmployeesListScreen.tsx',
      'src/screens/office/InvoicesListScreen.tsx',
    ];
    for (const file of screens) {
      expect(read(file)).not.toMatch(/use(?:Assignment|Execution|Trip|Client|Employee|Invoice)List\(/);
    }
  });
});
