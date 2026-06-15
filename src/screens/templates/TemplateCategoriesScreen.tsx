import { StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { PreparedTemplateBanner } from '@/components/templates';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchTemplateCategories } from '@/lib/templates/templateCategoriesService';
import { colors, spacing, typography } from '@/theme';

export function TemplateCategoriesScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const [search, setSearch] = useState('');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchTemplateCategories(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = query.data ?? [];
    if (!q) return rows;
    return rows.filter(
      (cat) =>
        cat.label.toLowerCase().includes(q) ||
        cat.key.toLowerCase().includes(q) ||
        cat.moduleKey.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="Vorlagen-Kategorien" subtitle="Wird geladen…">
        <LoadingState message="Kategorien werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="Vorlagen-Kategorien" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title="Vorlagen-Kategorien" subtitle={`Modulbezogen · ${roleLabel ?? 'Demo'}`}>
      <PreparedTemplateBanner />
      <SectionPanel title="Kategorien">
        <PremiumInput label="Suche" value={search} onChangeText={setSearch} placeholder="Label oder Modul…" />
        {items.length === 0 ? (
          <EmptyState title="Keine Kategorien" message="Passen Sie die Suche an." />
        ) : (
          <View style={styles.list}>
            {items.map((cat) => (
              <PremiumCard key={cat.id} style={styles.card}>
                <Text style={styles.title}>{cat.label}</Text>
                <Text style={styles.meta}>Schlüssel: {cat.key}</Text>
                <PremiumBadge label={cat.moduleKey} variant="cyan" />
              </PremiumCard>
            ))}
          </View>
        )}
      </SectionPanel>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { marginBottom: spacing.xs },
  title: { ...typography.h3, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
});
