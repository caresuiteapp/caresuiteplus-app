import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Personalbereich Lesbarkeit und Struktur R1', () => {
  it('bindet Personalansichten an eine eindeutige helle Kontrastfläche', () => {
    const list = readSrc('src/screens/office/EmployeesListScreen.tsx');
    const personnel = readSrc('src/screens/office/EmployeePersonnelRecordScreen.tsx');
    const create = readSrc('src/screens/office/EmployeeCreateScreen.tsx');

    expect(list).toContain('SurfaceContrastProvider tone="light"');
    expect(personnel).toContain('SurfaceContrastProvider tone="light"');
    expect(create).toContain('SurfaceContrastProvider tone="light"');
  });

  it('zeigt eine informative Personaltabelle mit eindeutiger Aktion', () => {
    const table = readSrc('src/components/office/EmployeesListTable.tsx');

    expect(table).toContain("label: 'Kontakt'");
    expect(table).toContain('Keine E-Mail hinterlegt');
    expect(table).toContain('Akte öffnen');
    expect(table).toContain('fixedLayout');
  });

  it('gliedert Anlage und Personalakte ohne abgeschnittene Auswahlwerte', () => {
    const createForm = readSrc('src/components/office/employeecreateform.tsx');
    const personnel = readSrc('src/components/office/EmployeePersonnelFilePanel.tsx');

    expect(createForm).toContain('Persönliche Angaben');
    expect(createForm).toContain('Organisation');
    expect(createForm.match(/ wrap \/>/g)?.length).toBeGreaterThanOrEqual(3);
    expect(personnel).toContain('DIGITALE PERSONALAKTE');
    expect(personnel).toContain('rows={2}');
    expect(personnel).toContain('overviewGrid');
  });
});
