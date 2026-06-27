import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { LockedActionBanner } from '@/components/permissions';
import { PortalDocumentDetailHero } from '@/components/portal';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  SuccessState,
} from '@/components/ui';
import { usePortalDocumentDetail } from '@/hooks/usePortalDocumentDetail';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import { careSpacing } from '@/design/tokens/spacing';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { colors, spacing, typography } from '@/theme';

export function PortalClientDocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useLegacyTheme();
  const { isPhone } = useDeviceClass();
  const { showBottomTabs } = usePlatformLayout();
  const { can, check, roleLabel } = usePermissions();
  const canView = can('portal.client.documents.view');
  const canDownload = can('portal.client.documents.download');

  const {
    data,
    loading,
    error,
    refresh,
    download,
    downloadLoading,
    downloadError,
    successMessage,
    notFound,
  } = usePortalDocumentDetail(id);

  const scrollPadding = useMemo(
    () => ({
      paddingBottom: showBottomTabs
        ? PORTAL_MOBILE_NAV_HEIGHT + Math.max(insets.bottom, careSpacing.sm)
        : spacing.xxl,
    }),
    [insets.bottom, showBottomTabs],
  );
  const mobileNavPadding =
    PORTAL_MOBILE_NAV_HEIGHT + Math.max(insets.bottom, careSpacing.sm);

  if (!canView) {
    return (
      <ScreenShell title="Dokument" subtitle={resolvePortalScreenSubtitle(roleLabel, 'client')}>
        <LockedActionBanner
          message={check('portal.client.documents.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading) {
    return (
      <ScreenShell title="Dokument" subtitle="Wird geladen…">
        <LoadingState message="Dokument wird geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Dokument" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Das Dokument existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!data) return null;

  return (
    <ScreenShell
      title={isPhone ? 'Dokument' : data.title}
      subtitle={isPhone ? data.title : data.displayFileName ?? undefined}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
      mobileContentPaddingBottom={showBottomTabs ? mobileNavPadding : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, scrollPadding]}
      >
        {successMessage ? <SuccessState message={successMessage} /> : null}

        <PortalDocumentDetailHero document={data} scope="client" />

        {data.viewReady && data.previewHtml ? (
          <View style={styles.previewSection}>
            <DocumentHtmlPreview
              title={data.title}
              previewHtml={data.previewHtml}
            />
          </View>
        ) : null}

        {downloadError ? <Text style={styles.error}>{downloadError}</Text> : null}

        {data.downloadReady && canDownload ? (
          <PremiumButton
            title="Herunterladen"
            onPress={() => download()}
            loading={downloadLoading}
          />
        ) : data.downloadReady ? (
          <LockedActionBanner
            message={check('portal.client.documents.download').reason ?? 'Keine Berechtigung.'}
            roleLabel={roleLabel}
          />
        ) : (
          <Text style={[styles.hint, { color: themeColors.textPrimary }]}>
            {data.viewReady
              ? 'Dieses Dokument können Sie oben im Portal lesen.'
              : 'Download derzeit nicht verfügbar.'}
          </Text>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    width: '100%',
    maxWidth: '100%',
    flexGrow: 1,
  },
  previewSection: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    minWidth: 0,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  hint: {
    ...typography.caption,
    opacity: 0.82,
    textAlign: 'center',
  },
});
