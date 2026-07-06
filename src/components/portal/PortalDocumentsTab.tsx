import { RefreshControl, ScrollView, StyleSheet, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { careSpacing } from '@/design/tokens/spacing';
import { PORTAL_LIGHT_LINK_ORANGE } from '@/design/tokens/auroraGlass';
import { PortalTabHero } from '@/components/portal/PortalTabHero';
import { PortalDocumentListCard } from '@/components/portal/PortalDocumentListCard';
import {
  EmptyState,
  ErrorState,
  LoadingState,
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
import { moduleColor } from '@/design/tokens/modules';
import { spacing } from '@/theme';

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
  const insets = useSafeAreaInsets();
  const { isPhone } = useDeviceClass();
  const { showBottomTabs } = usePlatformLayout();
  const scope = resolvePortalScope(profile?.roleKey ?? null);
  const accent = moduleColor('assist');
  const contentPadding = {
    paddingHorizontal: isPhone ? careSpacing.sm : 0,
    paddingBottom: showBottomTabs
      ? PORTAL_MOBILE_NAV_HEIGHT + Math.max(insets.bottom, careSpacing.sm)
      : spacing.xxl,
  };

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

  const listBody = (
    <>
      <PortalTabHero
        tab="documents"
        scope={scope}
        totalCount={items.length}
        restrictedCount={items.filter((d) => d.sensitivity === 'restricted').length}
      />

      {showSuccess ? <SuccessState message="Dokumente aktualisiert." /> : null}

      {scope === 'portal_client' || scope === 'portal_family' ? (
        <Pressable
          onPress={() => router.push('/portal/client/documents/signatures' as never)}
          style={styles.signaturesLink}
          accessibilityRole="button"
        >
          <Text style={styles.signaturesLinkText}>Offene Unterschriften anzeigen →</Text>
        </Pressable>
      ) : null}

      {isEmpty ? (
        <EmptyState
          title="Keine Dokumente"
          message="Es sind keine Dokumente für Sie freigegeben."
          actionLabel="Erneut laden"
          onAction={refresh}
        />
      ) : (
        items.map((doc) => (
          <PortalDocumentListCard
            key={doc.id}
            document={doc}
            metaLine={formatPortalDocumentMeta(doc)}
            onPress={
              detailBasePath
                ? () => router.push(`${detailBasePath}/${doc.id}` as never)
                : undefined
            }
          />
        ))
      )}
    </>
  );

  if (isPhone) {
    return <View style={[styles.scroll, contentPadding]}>{listBody}</View>;
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={accent} />
      }
      contentContainerStyle={[styles.scroll, contentPadding]}
    >
      {listBody}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  signaturesLink: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: careSpacing.xs,
  },
  signaturesLinkText: {
    color: PORTAL_LIGHT_LINK_ORANGE,
    fontWeight: '700',
    fontSize: 14,
  },
});
