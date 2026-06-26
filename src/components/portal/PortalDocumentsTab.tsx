import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
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
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { useAuth } from '@/lib/auth/context';
import { resolvePortalScope } from '@/lib/portal/portalVisibility';
import { formatOfficeDocumentSizeDisplay } from '@/lib/office/officeDocumentDisplay';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import {
  PORTAL_DOCUMENT_CATEGORY_LABELS,
} from '@/types/portal/documents';
import { SENSITIVITY_LABELS, VISIBILITY_LABELS } from '@/types/portal/visibility';
import { colors, spacing } from '@/theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatPortalDocumentMeta(doc: PortalDocumentListItem): string {
  const sizeLabel = formatOfficeDocumentSizeDisplay(doc.sizeLabel, doc.fileSizeBytes);
  const updatedAtLabel = formatDate(doc.updatedAt);
  return sizeLabel ? `${sizeLabel} · ${updatedAtLabel}` : updatedAtLabel;
}

type PortalDocumentsTabProps = {
  detailBasePath?: string;
};

export function PortalDocumentsTab({ detailBasePath }: PortalDocumentsTabProps = {}) {
  const router = useRouter();
  const { profile } = useAuth();
  const content = useAdaptiveContentStyles();
  const insets = useSafeAreaInsets();
  const { isPhone } = useDeviceClass();
  const { showBottomTabs } = usePlatformLayout();
  const scope = resolvePortalScope(profile?.roleKey ?? null);
  const contentPadding = useMemo(
    () => ({
      paddingHorizontal: isPhone ? careSpacing.sm : 0,
      paddingBottom: showBottomTabs
        ? PORTAL_MOBILE_NAV_HEIGHT + Math.max(insets.bottom, careSpacing.sm)
        : spacing.xxl,
    }),
    [insets.bottom, isPhone, showBottomTabs],
  );
  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          gap: spacing.md,
          width: '100%',
          maxWidth: '100%',
          alignSelf: 'stretch',
        },
        cardHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: spacing.sm,
          marginBottom: spacing.xs,
        },
        title: {
          ...content.title,
          flex: 1,
          minWidth: 0,
        },
        fileName: content.secondary,
        meta: {
          ...content.caption,
          marginTop: spacing.xs,
        },
        badges: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          marginTop: spacing.sm,
        },
        card: {
          width: '100%',
          alignSelf: 'stretch',
        },
      }),
    [content],
  );
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
      contentContainerStyle={[styles.scroll, contentPadding]}
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
            style={styles.card}
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
            {doc.displayFileName ? (
              <Text style={styles.fileName}>{doc.displayFileName}</Text>
            ) : null}
            <Text style={styles.meta}>{formatPortalDocumentMeta(doc)}</Text>
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
