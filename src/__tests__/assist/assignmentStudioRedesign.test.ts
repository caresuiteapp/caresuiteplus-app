import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const readSrc = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('Einsatzstudio redesign', () => {
  it('ersetzt Chip-Navigation und Endlosformular durch einen geführten Arbeitsbereich', () => {
    const scaffold = readSrc('src/components/assist/AssignmentStudioScaffold.tsx');
    const create = readSrc('src/components/assist/AssignmentCreateForm.tsx');
    const edit = readSrc('src/components/assist/AssignmentEditForm.tsx');

    expect(scaffold).toContain('EINSATZSTUDIO');
    expect(scaffold).toContain('LIVE-ZUSAMMENFASSUNG');
    expect(scaffold).toContain('Bereich {activeIndex + 1} von {steps.length}');
    expect(create).toContain('CREATE_STUDIO_STEPS');
    expect(create).toContain('Einsatz verbindlich anlegen');
    expect(edit).toContain('EDIT_STUDIO_STEPS');
    expect(edit).toContain("section === 'tasks'");
    expect(edit).toContain("section === 'status'");
    expect(edit).toContain('Änderungen speichern');
  });

  it('zeigt die Einsatzliste als operative Lage mit kompakter Steuerleiste', () => {
    const list = readSrc('src/components/assist/AssignmentsListView.tsx');
    const hero = readSrc('src/components/assist/AssignmentsListHero.tsx');
    const table = readSrc('src/components/assist/AssignmentsListTable.tsx');

    expect(hero).toContain('Operative Einsatzlage');
    expect(list).toContain('Schnellsuche');
    expect(list).toContain('commandBar');
    expect(list).toContain('canManage && embedded');
    expect(table).toContain("label: 'Klient:in & Leistung'");
    expect(table).toContain("label: 'Zuständigkeit & Ort'");
    expect(table).toContain('Details →');
  });
});
