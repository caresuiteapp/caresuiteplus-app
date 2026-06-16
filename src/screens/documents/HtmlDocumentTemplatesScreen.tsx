import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { PreparedTemplateBanner } from '@/components/templates';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { listDocumentTemplates } from '@/lib/documents';
import { colors, spacing, typography } from '@/theme';

export function HtmlDocumentTemplatesScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listDocumentTemplates(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (!can('office.catalogs.view')) {
    return (
      <CareLightPageShell title="HTML-Dokumentvorlagen" subtitle={roleLabel ?? ''}>
        <LockedActionBanner message={check('office.catalogs.view').reason ?? 'Keine Berechtigung.'} />
      </CareLightPageShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="HTML-Dokumentvorlagen" subtitle="Wird geladen…">
        <LoadingState message="Vorlagen werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="HTML-Dokumentvorlagen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  const templates = query.data ?? [];

  return (
    <CareLightPageShell title="HTML-Dokumentvorlagen" subtitle="Vorlagen & Dokumente">
      <PreparedTemplateBanner />
      <View style={styles.actions}>
        <PremiumButton title="Live-Vorschau" variant="secondary" onPress={() => router.push('/business/templates/live-preview' as never)} />
      </View>
      {templates.length === 0 ? (
        <EmptyState title="Keine Vorlagen" message="Keine HTML-Dokumentvorlagen vorhanden." />
      ) : (
        templates.map((t) => (
          <PremiumCard key={t.id} style={styles.card}>
            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.meta}>{t.templateType} · {t.templateStatus}</Text>
            <PremiumButton
              title="Im Editor öffnen"
              variant="secondary"
              onPress={() => router.push(`/business/templates/document-editor/${t.id}` as never)}
            />
          </PremiumCard>
        ))
      )}
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  actions: { marginBottom: spacing.md },
  card: { gap: spacing.sm, marginBottom: spacing.sm },
  title: { ...typography.h3 },
  meta: { ...typography.caption, color: colors.textMuted },
});
