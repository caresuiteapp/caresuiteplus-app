import type { TenantCustomFieldDefinition } from '@/types/tenant/tenantCenter';
import type { SaveCustomFieldInput } from './tenantCustomFieldService';

export const CUSTOM_FIELD_TYPE_LABELS = {
  text: 'Kurzer Text',
  multiline: 'Längerer Text',
  number: 'Zahl',
  date: 'Datum',
  boolean: 'Ja / Nein',
  select: 'Auswahlliste',
} as const;

export const CUSTOM_FIELD_FUNCTION_LABELS: Record<string, string> = {
  documents: 'Dokumente',
  intake: 'Aufnahme',
  billing: 'Abrechnung',
};

export type CustomFieldEditorDraft = {
  definition: SaveCustomFieldInput;
  optionsText: string;
};

export function createCustomFieldKey(label: string): string {
  const normalized = label.toLocaleLowerCase('de-DE')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized && !/^[a-z]/.test(normalized) ? `feld_${normalized}` : normalized;
}

export function customFieldOptionsText(options: unknown): string {
  if (!Array.isArray(options)) return '';
  return options.map((option: unknown) => {
    if (typeof option === 'string' || typeof option === 'number') return String(option);
    if (option && typeof option === 'object') {
      const record = option as Record<string, unknown>;
      return typeof record.label === 'string' ? record.label : typeof record.value === 'string' ? record.value : '';
    }
    return '';
  }).filter(Boolean).join('\n');
}

export function createCustomFieldDraft(field?: TenantCustomFieldDefinition | null): CustomFieldEditorDraft {
  return {
    definition: field ? { ...field, validation: { ...field.validation }, visibility: { ...field.visibility } } : {
      groupId: null,
      fieldKey: '',
      label: '',
      dataType: 'text',
      moduleKey: null,
      functionKey: 'documents',
      visibility: { office: true, portal: false },
      validation: { required: false },
      isActive: true,
      sortOrder: 0,
    },
    optionsText: customFieldOptionsText(field?.validation.options),
  };
}

export function validateCustomFieldDraft(draft: CustomFieldEditorDraft, original?: TenantCustomFieldDefinition | null): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.definition.label.trim()) errors.label = 'Bitte geben Sie dem Feld eine Bezeichnung.';
  if (!draft.definition.fieldKey.trim()) errors.fieldKey = 'Bitte geben Sie einen Schlüssel für den Dokumentplatzhalter ein.';
  else if ((!original || draft.definition.fieldKey !== original.fieldKey) && !/^[a-z][a-z0-9_]*$/.test(draft.definition.fieldKey)) {
    errors.fieldKey = 'Beginnen Sie mit einem Kleinbuchstaben. Verwenden Sie nur a–z, Ziffern und Unterstriche.';
  }
  if (draft.definition.dataType === 'select') {
    const options = draft.optionsText.split('\n').map(value => value.trim()).filter(Boolean);
    if (options.length === 0) errors.options = 'Tragen Sie mindestens eine Auswahlmöglichkeit ein, jeweils in einer eigenen Zeile.';
    else if (new Set(options.map(value => value.toLocaleLowerCase('de-DE'))).size !== options.length) {
      errors.options = 'Jede Auswahlmöglichkeit darf nur einmal vorkommen.';
    }
  }
  return errors;
}

export function buildCustomFieldInput(draft: CustomFieldEditorDraft, original?: TenantCustomFieldDefinition | null): SaveCustomFieldInput {
  const validation = { ...draft.definition.validation };
  if (draft.definition.dataType === 'select' && (!original || draft.optionsText !== customFieldOptionsText(original.validation.options))) {
    validation.options = draft.optionsText.split('\n').map(value => value.trim()).filter(Boolean);
  }
  return {
    ...draft.definition,
    // References and stored values must keep pointing to the same existing field.
    ...(original ? { id: original.id, fieldKey: original.fieldKey, dataType: original.dataType } : {}),
    label: draft.definition.label.trim(),
    fieldKey: original?.fieldKey ?? draft.definition.fieldKey.trim(),
    validation,
    visibility: { ...draft.definition.visibility },
  };
}
