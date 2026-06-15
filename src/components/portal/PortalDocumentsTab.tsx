import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PortalTabHero } from '@/components/portal/PortalTabHero';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SuccessState,
} from '@/components/ui';
import { usePortalDocuments } from '@/hooks/usePortalDocuments';
import { useAuth } from '@/lib/auth/context';
import { resolvePortalScope } from '@/lib/portal/portalVisibility';
import { formatFileSize } from '@/lib/portal';
import {
  PORTAL_DOCUMENT_CATEGORY_LABELS,
} from '@/types/portal/documents';
import { SENSITIVITY_LABELS, VISIBILITY_LABELS } from '@/types/portal/visibility';
import { colors, spacing, typography } from '@/theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

type PortalDocumentsTabProps = {
  detailBasePath?: string;
};

export function PortalDocumentsTab({ detailBasePath }: PortalDocumentsTabProps = {}) {
  const router = useRouter();
  const { profile } = useAuth();
  const scope = resolvePortalScope(profile?.roleKey ?? null);
  const {
    items,
    loading,
    error,
    refreshing,
    showSuccess,
    refresh,
    isEmpty,
  } = usePortalDocuments();

  if (loading && items.length === 0) {
    return <LoadingState message="Dokumente werden geladen…" />;
  }

  if (error && items.length === 0) {
    return (
      <ErrorState
        title="Dokumente nicht verfügbar"
        message={error}
        onRetry={refresh}
      />
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
      contentContainerStyle={styles.scroll}
    >
      <PortalTabHero
        tab="documents"
        scope={scope}
        totalCount={items.length}
        restrictedCount={items.filter((d) => d.sensitivity === 'restricted').length}
      />

      {showSuccess ? <SuccessState message="Dokumente aktualisiert." /> : null}

      {isEmpty ? (
        <EmptyState
          title="Keine Dokumente"
          message="Es sind keine Dokumente für Sie freigegeben."
          actionLabel="Erneut laden"
          onAction={refresh}
        />
      ) : (
        items.map((doc) => (
          <PremiumCard
            key={doc.id}
            accentColor={colors.primary}
            onPress={
              detailBasePath
                ? () => router.push(`${detailBasePath}/${doc.id}` as never)
                : undefined
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.title}>{doc.title}</Text>
              <PremiumBadge
                label={PORTAL_DOCUMENT_CATEGORY_LABELS[doc.category]}
                variant="muted"
              />
            </View>
            <Text style={styles.fileName}>{doc.fileName}</Text>
            <Text style={styles.meta}>
              {formatFileSize(doc.fileSizeBytes)} · {formatDate(doc.updatedAt)}
            </Text>
            <View style={styles.badges}>
              <PremiumBadge label={VISIBILITY_LABELS[doc.visibility]} variant="cyan" />
              <PremiumBadge
                label={SENSITIVITY_LABELS[doc.sensitivity]}
                variant={doc.sensitivity === 'restricted' ? 'red' : 'muted'}
              />
            </View>
          </PremiumCard>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.bodyStrong,
    flex: 1,
  },
  fileName: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
