import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumInput } from '@/components/ui';
import { TenantCenterGlassModal } from '@/components/tenant/TenantCenterGlassModal';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import type { CustomFieldDataType, TenantCustomFieldDefinition, TenantModuleKey } from '@/types/tenant/tenantCenter';
import { resolveCustomFieldPlaceholder, saveTenantCustomFieldDefinition } from '@/lib/tenant/tenantCustomFieldService';
import { usePermissions } from '@/hooks/usePermissions';

const STEPS = [
  'Name & Schlüssel',
  'Datentyp',
  'Modul',
  'Funktion',
  'Sichtbarkeit',
  'Validierung',
  'Vorschau',
  'Bestätigen',
] as const;

type Props = {
  visible: boolean;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
};

const EMPTY: Omit<TenantCustomFieldDefinition, 'id'> = {
  groupId: null,
  fieldKey: '',
  label: '',
  dataType: 'text',
  moduleKey: 'assist',
  functionKey: 'documents',
  visibility: { office: true, portal: false },
  validation: { required: false },
  isActive: true,
  sortOrder: 0,
};

export function TenantCustomFieldWizardModal({ visible, tenantId, onClose, onSaved }: Props) {
  const text = useAuroraAdaptiveText();
  const { roleKey } = usePermissions();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholder = useMemo(
    () => (draft.fieldKey.trim() ? resolveCustomFieldPlaceholder(draft.fieldKey.trim()) : '{{tenant.custom.field_key}}'),
    [draft.fieldKey],
  );

  const patch = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setStep(0);
    setDraft(EMPTY);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await saveTenantCustomFieldDefinition(tenantId, draft, roleKey);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    reset();
    onSaved();
    onClose();
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <PremiumInput label="Bezeichnung" value={draft.label} onChangeText={(v) => patch('label', v)} />
            <PremiumInput
              label="Technischer Schlüssel"
              value={draft.fieldKey}
              onChangeText={(v) => patch('fieldKey', v.replace(/\s+/g, '_').toLowerCase())}
              placeholder="z. B. pflegedienst_nummer"
              autoCapitalize="none"
            />
          </>
        );
      case 1:
        return (
          <>
            {(['text', 'number', 'date', 'boolean', 'select', 'multiline'] as CustomFieldDataType[]).map((type) => (
              <Text
                key={type}
                onPress={() => patch('dataType', type)}
                style={{ color: draft.dataType === type ? text.primary : text.muted, fontWeight: draft.dataType === type ? '700' : '400' }}
              >
                {type}
              </Text>
            ))}
          </>
        );
      case 2:
        return (
          <>
            {(['assist', 'pflege', 'stationaer', 'beratung'] as TenantModuleKey[]).map((moduleKey) => (
              <Text
                key={moduleKey}
                onPress={() => patch('moduleKey', moduleKey)}
                style={{ color: draft.moduleKey === moduleKey ? text.primary : text.muted, fontWeight: draft.moduleKey === moduleKey ? '700' : '400' }}
              >
                {moduleKey}
              </Text>
            ))}
          </>
        );
      case 3:
        return (
          <PremiumInput
            label="Funktion / Einsatzbereich"
            value={draft.functionKey ?? ''}
            onChangeText={(v) => patch('functionKey', v)}
            placeholder="documents, intake, billing …"
          />
        );
      case 4:
        return (
          <>
            <Text style={{ color: text.secondary }}>Office sichtbar: {draft.visibility.office ? 'Ja' : 'Nein'}</Text>
            <Text style={{ color: text.secondary }}>Portal sichtbar: {draft.visibility.portal ? 'Ja' : 'Nein'}</Text>
          </>
        );
      case 5:
        return (
          <PremiumInput
            label="Validierung (JSON-light)"
            value={JSON.stringify(draft.validation)}
            onChangeText={(v) => {
              try {
                patch('validation', JSON.parse(v) as Record<string, unknown>);
              } catch {
                /* ignore while typing */
              }
            }}
            multiline
          />
        );
      case 6:
        return (
          <>
            <Text style={{ color: text.primary, fontWeight: '700' }}>Platzhalter</Text>
            <Text style={{ color: text.secondary }}>{placeholder}</Text>
            <Text style={{ color: text.muted, marginTop: 8 }}>
              {draft.label || 'Feld'} · {draft.dataType} · {draft.moduleKey}
            </Text>
          </>
        );
      default:
        return (
          <Text style={{ color: text.secondary }}>
            Feld „{draft.label}“ ({draft.fieldKey}) wird als {draft.dataType} für {draft.moduleKey} angelegt.
          </Text>
        );
    }
  };

  return (
    <TenantCenterGlassModal
      visible={visible}
      title="Individuelles Feld anlegen"
      subtitle={`Schritt ${step + 1} / ${STEPS.length}: ${STEPS[step]}`}
      onClose={handleClose}
      primaryLabel={step < STEPS.length - 1 ? 'Weiter' : 'Feld anlegen'}
      onPrimary={step < STEPS.length - 1 ? () => setStep((s) => s + 1) : handleSave}
      primaryLoading={saving}
    >
      <View style={styles.form}>
        {renderStep()}
        {error ? <Text style={{ color: '#F87171' }}>{error}</Text> : null}
        {step > 0 ? (
          <Text onPress={() => setStep((s) => s - 1)} style={{ color: text.muted, marginTop: 8 }}>
            ← Zurück
          </Text>
        ) : null}
      </View>
    </TenantCenterGlassModal>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
});
