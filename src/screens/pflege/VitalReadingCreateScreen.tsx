import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { VitalReadingCreateHero } from '@/components/pflege/VitalReadingCreateHero';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SegmentedTabs } from '@/components/ui';
import { demoClients } from '@/data/demo/clients';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { isVitalWriteReady } from '@/lib/pflege/pflegeModuleConfig';
import { createVitalReading } from '@/lib/pflege/vitalService';
import { colors, spacing, typography } from '@/theme';

const TYPE_MAP: Record<string, 'blood_pressure' | 'pulse' | 'temperature' | 'weight' | 'oxygen'> = {
  blutdruck: 'blood_pressure',
  puls: 'pulse',
  temperatur: 'temperature',
  gewicht: 'weight',
  sauerstoff: 'oxygen',
};

const VITAL_TYPE_OPTIONS = [
  { key: 'blood_pressure', label: 'Blutdruck', unit: 'mmHg', placeholder: '128/82', extraLabel: 'Lage', extraPlaceholder: 'sitzend' },
  { key: 'pulse', label: 'Puls', unit: 'bpm', placeholder: '72', extraLabel: 'Rhythmus', extraPlaceholder: 'regelmäßig' },
  { key: 'temperature', label: 'Temperatur', unit: '°C', placeholder: '36.8', extraLabel: 'Messort', extraPlaceholder: 'Ohr' },
  { key: 'weight', label: 'Gewicht', unit: 'kg', placeholder: '68.5', extraLabel: 'Kleidung', extraPlaceholder: 'leicht bekleidet' },
  { key: 'oxygen', label: 'Sauerstoff', unit: '%', placeholder: '96', extraLabel: 'Atemfrequenz', extraPlaceholder: '16/min' },
] as const;

function resolveVitalTypeKey(label: string): (typeof VITAL_TYPE_OPTIONS)[number]['key'] {
  const key = label.trim().toLowerCase();
  return TYPE_MAP[key] ?? 'blood_pressure';
}

export function VitalReadingCreateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { isReadOnly, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const writeReady = isVitalWriteReady();
  const preparedOnly = !writeReady;

  const [clientId, setClientId] = useState(demoClients[0]?.id ?? 'client-001');
  const [value, setValue] = useState('');
  const [typeKey, setTypeKey] = useState<(typeof VITAL_TYPE_OPTIONS)[number]['key']>('blood_pressure');
  const [extraField, setExtraField] = useState('');
  const fieldConfig = useMemo(
    () => VITAL_TYPE_OPTIONS.find((opt) => opt.key === typeKey) ?? VITAL_TYPE_OPTIONS[0],
    [typeKey],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!writeReady || isReadOnly || !value.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createVitalReading(
      profile?.tenantId ?? DEMO_TENANT_ID,
      {
        clientId,
        type: typeKey,
        value: extraField.trim() ? `${value.trim()} (${fieldConfig.unit}; ${fieldConfig.extraLabel}: ${extraField.trim()})` : `${value.trim()} ${fieldConfig.unit}`,
      },
      roleKey,
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace(`/pflege/vitalwerte/${result.data.id}` as never);
  }

  return (
    <ScreenShell
      title="Vitalwert erfassen"
      subtitle={`Demo-funktional · ${roleLabel ?? 'Demo'}${isReadOnly ? ' · Lesemodus' : ''}`}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <VitalReadingCreateHero roleKey={roleKey} isReadOnly={isReadOnly} />
        {error ? <InfoBanner variant="danger" title="Speichern fehlgeschlagen" message={error} /> : null}

        <SectionPanel title="Messung" subtitle="Pflichtfelder">
          <Text style={styles.fieldLabel}>Klient:in</Text>
          <FilterChipGroup
            options={demoClients.slice(0, 8).map((c) => ({
              key: c.id,
              label: `${c.firstName} ${c.lastName}`,
            }))}
            value={clientId}
            onChange={setClientId}
          />
          <SegmentedTabs
            tabs={VITAL_TYPE_OPTIONS.map((opt) => ({ key: opt.key, label: opt.label }))}
            activeKey={typeKey}
            onSelect={(k) => setTypeKey(k as typeof typeKey)}
          />
          <PremiumInput
            label={`Wert (${fieldConfig.unit}) *`}
            placeholder={fieldConfig.placeholder}
            value={value}
            onChangeText={setValue}
            editable={!isReadOnly && writeReady}
          />
          <PremiumInput
            label={fieldConfig.extraLabel}
            placeholder={fieldConfig.extraPlaceholder}
            value={extraField}
            onChangeText={setExtraField}
            editable={!isReadOnly && writeReady}
          />
          <PremiumButton
            title={
              preparedOnly
                ? 'Speichern nur im Demo-Modus'
                : isReadOnly
                  ? 'Lesemodus — Speichern gesperrt'
                  : saving
                    ? 'Speichern…'
                    : 'Messung speichern'
            }
            fullWidth
            disabled={preparedOnly || isReadOnly || saving || !value.trim()}
            onPress={handleSave}
          />
          <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
        </SectionPanel>

        <PflegeCrossModuleLinksPanel context="vital-create" />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  fieldLabel: { ...typography.label, color: colors.textMuted },
});
