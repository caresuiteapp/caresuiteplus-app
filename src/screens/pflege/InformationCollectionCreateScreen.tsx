import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createInformationCollection } from '@/lib/pflege/informationCollectionService';
import { demoClients } from '@/data/demo/clients';
import { colors, spacing, typography } from '@/theme';

const COLLECTION_TYPES = [
  { value: 'Erstaufnahme', label: 'Erstaufnahme' },
  { value: 'Pflegeplanung', label: 'Pflegeplanung' },
  { value: 'Verlauf', label: 'Verlauf' },
  { value: 'Übergabe', label: 'Übergabe' },
  { value: 'Evaluation', label: 'Evaluation' },
];

export function InformationCollectionCreateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const [clientId, setClientId] = useState(demoClients[0]?.id ?? '');
  const [collectionType, setCollectionType] = useState(COLLECTION_TYPES[0]!.value);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const client = demoClients.find((c) => c.id === clientId);
  const clientName = client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';

  async function handleSubmit() {
    if (!tenantId || isReadOnly) return;
    setLoading(true);
    setError(null);
    const result = await createInformationCollection(
      tenantId,
      { clientId, clientName, collectionType },
      profile?.roleKey,
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace(`/pflege/informationssammlung/${result.data.id}` as never);
  }

  return (
    <ScreenShell title="Informationssammlung" subtitle={roleLabel ?? 'Neu anlegen'}>
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
        <Text style={styles.fieldLabel}>Sammlungstyp</Text>
        <FilterChipGroup
          options={COLLECTION_TYPES.map((o) => ({ key: o.value, label: o.label }))}
          value={collectionType}
          onChange={setCollectionType}
        />
        <PremiumInput label="Bearbeitende Person" value="Pflegekraft Demo" editable={false} />
        {error ? <ErrorState message={error} /> : null}
        <PremiumButton
          title={loading ? 'Wird gespeichert…' : 'Sammlung starten'}
          onPress={handleSubmit}
          disabled={loading || isReadOnly}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, padding: spacing.md },
  fieldLabel: { ...typography.label, color: colors.textMuted },
});
