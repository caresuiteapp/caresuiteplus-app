import { StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { listTenantClientServiceTypes, updateTenantClientServiceType } from '@/lib/client/clientServiceTypeService';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { useState } from 'react';
import { colors, spacing, typography } from '@/theme';

/** Mandanten-Leistungsarten — Core K.4 list/edit active types. */
export default function TenantClientServiceTypesScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { isReadOnly } = usePermissions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTenantClientServiceTypes(tenantId);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const types = query.data ?? [];

  async function handleSave(typeId: string) {
    if (!tenantId || isReadOnly || !editName.trim()) return;
    setSaving(true);
    const result = await updateTenantClientServiceType(tenantId, typeId, { name: editName.trim() });
    setSaving(false);
    if (result.ok) {
      setEditingId(null);
      await query.refresh();
    }
  }

  return (
    <ScreenShell
      title="Klient:innen-Leistungsarten"
      subtitle="Mandanten-Vorlagen für Leistungsbereiche"
      rightSlot={<PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />}
    >
      {query.loading && !query.data ? <LoadingState message="Leistungsarten werden geladen…" /> : null}
      {query.error ? <ErrorState message={query.error} onRetry={query.refresh} /> : null}

      {types.length === 0 && !query.loading ? (
        <EmptyState
          title="Leistungsarten-Vorlagen"
          message="Beim ersten Zugriff werden 6 Systemvorlagen angelegt."
        />
      ) : (
        <View style={styles.list}>
          {types.map((type) => (
            <PremiumCard key={type.id} style={styles.card}>
              {editingId === type.id ? (
                <>
                  <PremiumInput label="Name" value={editName} onChangeText={setEditName} />
                  <PremiumButton title="Speichern" loading={saving} onPress={() => handleSave(type.id)} />
                  <PremiumButton title="Abbrechen" variant="secondary" onPress={() => setEditingId(null)} />
                </>
              ) : (
                <>
                  <Text style={styles.primary}>{type.name}</Text>
                  <Text style={styles.secondary}>{type.description ?? type.serviceTypeKey}</Text>
                  {!isReadOnly ? (
                    <PremiumButton
                      title="Bearbeiten"
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        setEditingId(type.id);
                        setEditName(type.name);
                      }}
                    />
                  ) : null}
                </>
              )}
            </PremiumCard>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { marginBottom: spacing.sm },
  primary: { ...typography.label },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
