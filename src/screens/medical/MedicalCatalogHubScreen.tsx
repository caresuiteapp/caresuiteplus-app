import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import {
  MedicalCatalogHubHero,
  MedicalCatalogSourceCard,
} from '@/components/medical/MedicalCatalogSourceCard';
import { MedicalDocumentationDisclaimer } from '@/components/medical/MedicalDocumentationDisclaimer';
import { InfoBanner, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  MEDICAL_CATALOG_SOURCE_REGISTRY,
  MEDICAL_PREPARED_MESSAGE,
  countProtectedMedicalCatalogSources,
  isMedicalCatalogLiveReady,
} from '@/lib/medicalCatalog';
import { searchIcdCodes } from '@/lib/medical/icdSearchService';
import { colors, spacing, typography } from '@/theme';

export function MedicalCatalogHubScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [icdQuery, setIcdQuery] = useState('');

  const icdSearch = useAsyncQuery(
    () => {
      if (!tenantId || !icdQuery.trim()) {
        return Promise.resolve({ ok: false as const, error: 'Suchbegriff eingeben.' });
      }
      return searchIcdCodes(tenantId, icdQuery, profile?.roleKey);
    },
    [tenantId, icdQuery, profile?.roleKey],
    { enabled: false },
  );

  const protectedCount = countProtectedMedicalCatalogSources();

  return (
    <CareLightPageShell
      title="Medizinische Stammdaten"
      subtitle="Dokumentations- und Kodierhilfe"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <MedicalCatalogHubHero
          preparedCount={MEDICAL_CATALOG_SOURCE_REGISTRY.length}
          protectedCount={protectedCount}
        />

        {!isMedicalCatalogLiveReady() ? (
          <InfoBanner title="Vorbereitet" message={MEDICAL_PREPARED_MESSAGE} />
        ) : null}

        <MedicalDocumentationDisclaimer />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ICD-10-GM Kodierhilfe</Text>
          <PremiumInput
            label="ICD suchen (Demo-Katalog)"
            value={icdQuery}
            onChangeText={setIcdQuery}
            placeholder="Code oder Bezeichnung"
          />
          <PremiumButton
            title="Suchen"
            onPress={() => icdSearch.refresh()}
            disabled={!icdQuery.trim()}
          />
          {icdSearch.loading ? <LoadingState message="ICD-Katalog wird durchsucht…" /> : null}
          {icdSearch.error ? <Text style={styles.error}>{icdSearch.error}</Text> : null}
          {icdSearch.data?.results.map((entry) => (
            <Pressable
              key={entry.id}
              style={styles.icdRow}
              onPress={() => router.push('/medical/icd' as never)}
            >
              <Text style={styles.icdCode}>{entry.code}</Text>
              <Text style={styles.icdTitle}>{entry.title}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Katalogquellen</Text>
          {MEDICAL_CATALOG_SOURCE_REGISTRY.map((entry) => (
            <MedicalCatalogSourceCard key={entry.sourceKey} entry={entry} />
          ))}
        </View>

        <PremiumButton
          title="Diagnose als ärztliche Angabe dokumentieren"
          onPress={() => router.push('/medical/icd' as never)}
        />
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  icdRow: {
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.bgPanel,
    marginTop: spacing.xs,
  },
  icdCode: { ...typography.bodyStrong, color: colors.textPrimary },
  icdTitle: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.danger },
});
