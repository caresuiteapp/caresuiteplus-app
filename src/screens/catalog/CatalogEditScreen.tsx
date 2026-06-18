import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FormScreenHero } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import { ErrorState, PremiumButton, PremiumCard, PremiumInput, SuccessState } from '@/components/ui';
import { createCatalog, updateCatalog } from '@/lib/catalog/catalogMutations';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { spacing, typography, colors } from '@/theme';

/** WP446 — Katalog anlegen / bearbeiten */
export function CatalogEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const router = useRouter();
  const isCreate = !id;
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Name ist erforderlich.');
      return;
    }
    if (!tenantId) {
      setError('Kein Mandant am Profil hinterlegt.');
      return;
    }
    setLoading(true);
    const result = isCreate
      ? await createCatalog(tenantId, name, profile?.roleKey)
      : await updateCatalog(id ?? '', tenantId, name, profile?.roleKey);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCreatedId(result.data.id);
  };

  if (createdId) {
    return (
      <ScreenShell title={isCreate ? 'Katalog angelegt' : 'Katalog gespeichert'} subtitle="WP 446">
        <SuccessState message={`Katalog „${name.trim()}" wurde gespeichert.`} />
        <PremiumButton
          title="Zum Katalog"
          fullWidth
          onPress={() => router.back()}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={isCreate ? 'Katalog anlegen' : 'Katalog bearbeiten'}
      subtitle="Leistungskatalog · WP 446"
    >
      <View style={styles.content}>
        <FormScreenHero
          eyebrow="OFFICE · KATALOG"
          title={isCreate ? 'Katalog anlegen' : 'Katalog bearbeiten'}
          meta="Name und Demo-Persistenz — Live nach Migration 0025–0026"
          icon="📋"
          formMode={isCreate ? 'create' : 'edit'}
          wpNumber={446}
          accentColor={colors.cyan}
          preparedMessage="Katalog-Live-Listen und -Details benötigen Remote-Migrationen 0025–0026."
        />
      </View>
      <PremiumCard>
        <Text style={styles.hint}>
          {isCreate ? 'Neuen Katalog mit Name und Demo-Persistenz anlegen.' : 'Bestehenden Katalog aktualisieren.'}
        </Text>
        <PremiumInput label="Name" value={name} onChangeText={setName} />
        {error ? <ErrorState message={error} /> : null}
        <PremiumButton
          title={loading ? 'Speichern…' : isCreate ? 'Anlegen' : 'Speichern'}
          fullWidth
          disabled={loading}
          onPress={() => void handleSubmit()}
        />
      </PremiumCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { marginBottom: spacing.md },
  hint: { ...typography.caption, marginBottom: spacing.md },
});
