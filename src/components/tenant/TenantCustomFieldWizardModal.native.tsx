import type { PermissionKey } from '@/types';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { MobileButton, MobileField, MobileSheet, m } from '@/components/mobile/MobileWorkspace';
import { MobileSelect } from '@/components/mobile/MobileSelect';
import { usePermissions } from '@/hooks/usePermissions';
import { TENANT_SETTINGS_PERMISSION } from '@/lib/tenant/tenantSettingsRoute';
import { resolveCustomFieldPlaceholder, saveTenantCustomFieldDefinition } from '@/lib/tenant/tenantCustomFieldService';
import {
  buildCustomFieldInput, createCustomFieldDraft, createCustomFieldKey, CUSTOM_FIELD_FUNCTION_LABELS,
  CUSTOM_FIELD_TYPE_LABELS, validateCustomFieldDraft,
} from '@/lib/tenant/tenantCustomFieldEditor';
import type { CustomFieldDataType, TenantCustomFieldDefinition, TenantModuleKey } from '@/types/tenant/tenantCenter';

export type TenantCustomFieldWizardModalProps = {
  visible: boolean;
  tenantId: string;
  effectivePermissions?: readonly PermissionKey[];
  field?: TenantCustomFieldDefinition | null;
  onClose: () => void;
  onSaved: (fields?: TenantCustomFieldDefinition[]) => void;
};

const MODULE_LABELS: Record<TenantModuleKey, string> = { assist: 'Assist', pflege: 'Pflege', stationaer: 'Stationär', beratung: 'Beratung' };

export function TenantCustomFieldWizardModal(props: TenantCustomFieldWizardModalProps) {
  if (!props.visible) return null;
  return <CustomFieldEditor key={`${props.tenantId}:${props.field?.id ?? props.field?.fieldKey ?? 'new'}`} {...props} />;
}

function CustomFieldEditor({ tenantId, field, onClose, onSaved, effectivePermissions }: TenantCustomFieldWizardModalProps) {
  const { roleKey, can } = usePermissions();
  const canEdit = effectivePermissions ? effectivePermissions.includes(TENANT_SETTINGS_PERMISSION) : can(TENANT_SETTINGS_PERMISSION);
  const [initial, setInitial] = useState(() => createCustomFieldDraft(field));
  const [persistedField, setPersistedField] = useState(field);
  const [refreshPending, setRefreshPending] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [keyEdited, setKeyEdited] = useState(Boolean(field));
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  const errors = validateCustomFieldDraft(draft, persistedField);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const definition = draft.definition;
  const placeholder = resolveCustomFieldPlaceholder(definition.fieldKey || 'feldname');
  const existingModule = field?.moduleKey && field.moduleKey !== 'assist' ? field.moduleKey : null;
  const existingFunction = field?.functionKey && !CUSTOM_FIELD_FUNCTION_LABELS[field.functionKey] ? field.functionKey : null;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);


  function patch(key: keyof typeof definition, value: unknown) {
    setDraft(current => ({ ...current, definition: { ...current.definition, [key]: value } }));
    setSaveError(null);
  }

  function close() {
    if (savingRef.current) return;
    if (dirty) Alert.alert('Änderungen verwerfen?', 'Das Feld wurde noch nicht gespeichert.', [{ text: 'Weiter bearbeiten', style: 'cancel' }, { text: 'Verwerfen', style: 'destructive', onPress: onClose }]);
    else onClose();
  }

  async function save() {
    if (savingRef.current || !canEdit) return;
    setSubmitted(true);
    setSaveError(null);
    if (Object.keys(errors).length) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await saveTenantCustomFieldDefinition(tenantId, buildCustomFieldInput(draft, persistedField), roleKey);
      if (!mounted.current) return;
      if (!result.ok) {
        setSaveError(result.error);
        if (result.savedId) {
          const confirmed = { ...buildCustomFieldInput(draft, persistedField), id: result.savedId };
          const confirmedDraft = createCustomFieldDraft(confirmed);
          setPersistedField(confirmed); setInitial(confirmedDraft); setDraft(confirmedDraft); setKeyEdited(true); setRefreshPending(true);
        }
        return;
      }
      onSaved(result.data);
      onClose();
    } catch {
      if (mounted.current) setSaveError('Das Feld konnte nicht gespeichert werden. Bitte versuchen Sie es erneut. Ihre Eingaben bleiben erhalten.');
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const disabled = saving || !canEdit;
  return <MobileSheet visible title={persistedField ? 'Eigenes Feld bearbeiten' : 'Eigenes Feld anlegen'} onClose={close} footer={<>
    {saveError ? <Text accessibilityRole="alert" style={m.error}>{saveError}</Text> : null}
    {submitted ? Object.entries(errors).map(([key, message]) => <Text key={key} style={m.error}>{message}</Text>) : null}
    <View style={m.wrap}><MobileButton primary label={refreshPending ? 'Speicherstand erneut prüfen' : 'Feld speichern'} busy={saving} disabled={!canEdit || !!persistedField && !dirty && !refreshPending} onPress={() => void save()} /><MobileButton label="Abbrechen" disabled={saving} onPress={close} /></View>
  </>}>
    <MobileField label="Bezeichnung *" value={definition.label} editable={!disabled} onChangeText={label => { patch('label', label); if (!keyEdited && !persistedField) patch('fieldKey', createCustomFieldKey(label)); }} />
    <MobileField label="Feldschlüssel *" value={definition.fieldKey} editable={!disabled && !persistedField} autoCapitalize="none" onChangeText={value => { setKeyEdited(true); patch('fieldKey', value); }} />
    <Text selectable style={m.muted}>{placeholder}</Text>
    <MobileSelect label="Eingabeart" value={definition.dataType} options={CUSTOM_FIELD_TYPE_LABELS} disabled={disabled || !!persistedField} onChange={value => { if (value) patch('dataType', value as CustomFieldDataType); }} />
    {definition.dataType === 'select' ? <MobileField label="Auswahlmöglichkeiten · eine je Zeile" multiline value={draft.optionsText} editable={!disabled} onChangeText={optionsText => setDraft(current => ({ ...current, optionsText }))} /> : null}
    <MobileSelect label="Fachbereich" value={definition.moduleKey ?? ''} options={{ assist: 'Assist', ...(existingModule ? { [existingModule]: MODULE_LABELS[existingModule] } : {}) }} disabled={disabled} empty="Unternehmensweit" onChange={value => patch('moduleKey', value || null)} />
    <MobileSelect label="Verwendungszweck" value={definition.functionKey ?? ''} options={{ ...CUSTOM_FIELD_FUNCTION_LABELS, ...(existingFunction ? { [existingFunction]: existingFunction } : {}) }} disabled={disabled} onChange={value => patch('functionKey', value || null)} />
    <View style={m.wrap}>{[{ key: 'office', label: 'In der Verwaltung' }, { key: 'portal', label: 'Im Portal' }].map(item => <MobileButton key={item.key} label={item.label} selected={definition.visibility[item.key] === true} disabled={disabled} onPress={() => patch('visibility', { ...definition.visibility, [item.key]: !definition.visibility[item.key] })} />)}</View>
    <View style={m.wrap}><MobileButton label="Pflichtfeld" selected={definition.validation.required === true} disabled={disabled} onPress={() => patch('validation', { ...definition.validation, required: !definition.validation.required })} /><MobileButton label="Aktives Feld" selected={definition.isActive} disabled={disabled} onPress={() => patch('isActive', !definition.isActive)} /></View>
    {persistedField ? <Text style={m.muted}>Schlüssel und Eingabeart bleiben für gespeicherte Werte und Dokumentvorlagen erhalten.</Text> : null}
  </MobileSheet>;
}
