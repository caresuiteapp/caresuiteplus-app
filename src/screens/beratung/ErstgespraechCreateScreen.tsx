import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createDemoEntity } from '@/lib/create/demoCreateService';
import { demoClients } from '@/data/demo/clients';
import { colors, spacing, typography } from '@/theme';

const ANLASS_OPTIONS = [
  { value: 'pflegegrad', label: 'Pflegegrad / Leistungsbedarf' },
  { value: 'entlastung', label: 'Entlastung Angehörige' },
  { value: 'versorgung', label: 'Versorgungssituation' },
  { value: 'krise', label: 'Akute Krisensituation' },
];

export function ErstgespraechCreateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const [clientId, setClientId] = useState(demoClients[0]?.id ?? '');
  const [subject, setSubject] = useState('');
  const [anlass, setAnlass] = useState(ANLASS_OPTIONS[0]!.value);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!tenantId || isReadOnly) return;
    if (!subject.trim()) {
      setError('Bitte einen Gesprächsanlass eingeben.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await createDemoEntity('beratung.cases.view' as never, profile?.roleKey, 'case');
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace(`/beratung/cases/${result.data.id}` as never);
  }

  return (
    <CareLightPageShell title="Erstgespräch" subtitle={roleLabel ?? 'Beratung'}>
      <View style={styles.form}>
        <Text style={styles.fieldLabel}>Klient:in</Text>
        <FilterChipGroup
          options={demoClients.slice(0, 6).map((c) => ({
            key: c.id,
            label: `${c.firstName} ${c.lastName}`,
          }))}
          value={clientId}
          onChange={setClientId}
        />
        <Text style={styles.fieldLabel}>Anlass</Text>
        <FilterChipGroup
          options={ANLASS_OPTIONS.map((o) => ({ key: o.value, label: o.label }))}
          value={anlass}
          onChange={setAnlass}
        />
        <PremiumInput
          label="Gesprächsthema"
          placeholder="Kurzbeschreibung des Erstgesprächs"
          value={subject}
          onChangeText={setSubject}
        />
        <PremiumInput
          label="Notizen"
          placeholder="Erste Eindrücke, Ziele, nächste Schritte"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        {error ? <ErrorState message={error} /> : null}
        <PremiumButton
          title={loading ? 'Wird angelegt…' : 'Erstgespräch starten'}
          onPress={handleSubmit}
          disabled={loading || isReadOnly}
        />
      </View>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, padding: spacing.md },
  fieldLabel: { ...typography.label, color: colors.textMuted },
});
