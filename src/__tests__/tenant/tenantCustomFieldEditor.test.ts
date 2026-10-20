import { describe, expect, it } from 'vitest';
import { buildCustomFieldInput, createCustomFieldDraft, createCustomFieldKey, validateCustomFieldDraft } from '@/lib/tenant/tenantCustomFieldEditor';
import type { TenantCustomFieldDefinition } from '@/types/tenant/tenantCenter';

const existing: TenantCustomFieldDefinition = {
  id: 'field-1', fieldKey: 'historisch.schluessel', label: 'Fachbereich', groupId: 'group-1',
  dataType: 'select', moduleKey: 'pflege', functionKey: 'existing_function',
  visibility: { office: true, portal: false, customAudience: 'managers' },
  validation: { required: true, customRule: { code: 7 }, options: [{ value: 'a', label: 'Bereich A' }, { value: 'b', label: 'Bereich B' }] },
  isActive: true, sortOrder: 4,
};

describe('custom company field editor', () => {
  it('derives stable German document keys and starts company-wide without unlocking a module', () => {
    expect(createCustomFieldKey('Ärztliche Prüfung / Größe')).toBe('aerztliche_pruefung_groesse');
    expect(createCustomFieldKey('24-Stunden-Kontakt')).toBe('feld_24_stunden_kontakt');
    expect(createCustomFieldKey('   ')).toBe('');
    expect(createCustomFieldDraft().definition).toMatchObject({ moduleKey: null, visibility: { office: true, portal: false } });
  });

  it('validates names and new document keys before a write', () => {
    const draft = createCustomFieldDraft();
    expect(validateCustomFieldDraft(draft)).toHaveProperty('label');
    draft.definition.label = 'Kundennummer'; draft.definition.fieldKey = 'Not valid';
    expect(validateCustomFieldDraft(draft)).toHaveProperty('fieldKey');
    draft.definition.fieldKey = 'kundennummer';
    expect(validateCustomFieldDraft(draft)).toEqual({});
  });

  it('requires distinct nonempty choices and persists their entered order', () => {
    const draft = createCustomFieldDraft();
    Object.assign(draft.definition, { label: 'Kontaktweg', fieldKey: 'kontaktweg', dataType: 'select' });
    expect(validateCustomFieldDraft(draft)).toHaveProperty('options');
    draft.optionsText = 'Telefon\n telefon ';
    expect(validateCustomFieldDraft(draft)).toHaveProperty('options');
    draft.optionsText = ' Telefon\n\nE-Mail \nPersönlich';
    expect(validateCustomFieldDraft(draft)).toEqual({});
    expect(buildCustomFieldInput(draft).validation.options).toEqual(['Telefon', 'E-Mail', 'Persönlich']);
  });

  it('retains existing option values, unknown rules, historical assignments and references during label edits', () => {
    const draft = createCustomFieldDraft(existing);
    draft.definition.label = ' Neuer Fachbereich ';
    expect(validateCustomFieldDraft(draft, existing)).toEqual({});
    const result = buildCustomFieldInput(draft, existing);
    expect(result).toEqual({ ...existing, label: 'Neuer Fachbereich' });
    expect(existing.label).toBe('Fachbereich');
    expect(draft.definition.visibility).not.toBe(existing.visibility);
    expect(draft.definition.validation).not.toBe(existing.validation);
  });

  it('keeps an existing field identity and type even if a draft is changed programmatically', () => {
    const draft = createCustomFieldDraft(existing);
    Object.assign(draft.definition, { id: 'other', fieldKey: 'different', dataType: 'text' });
    expect(buildCustomFieldInput(draft, existing)).toMatchObject({ id: existing.id, fieldKey: existing.fieldKey, dataType: existing.dataType });
  });
});
