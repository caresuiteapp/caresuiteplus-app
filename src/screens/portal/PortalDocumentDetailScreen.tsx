import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { LockedActionBanner } from '@/components/permissions';
import { PortalDocumentDetailHero } from '@/components/portal';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  SuccessState,
} from '@/components/ui';
import { usePortalDocumentDetail } from '@/hooks/usePortalDocumentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

export function PortalDocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canView = can('portal.employee.documents.view');
  const canDownload = can('portal.employee.documents.download');

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

  if (!canView) {
    return (
      <ScreenShell title="Dokument" subtitle={roleLabel ?? 'Portal'}>
        <LockedActionBanner
          message={check('portal.employee.documents.view').reason ?? 'Keine Berechtigung.'}
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
    <C14vSubpageShell
      title={data.title}
      eyebrow="PORTAL · DOKUMENT"
      subtitle={data.displayFileName ?? undefined}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {successMessage ? <SuccessState message={successMessage} /> : null}

        <PortalDocumentDetailHero document={data} scope="employee" />

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
            message={check('portal.employee.documents.download').reason ?? 'Keine Berechtigung.'}
            roleLabel={roleLabel}
          />
        ) : (
          <Text style={styles.hint}>
            {data.viewReady
              ? 'Dieses Dokument können Sie oben im Portal lesen.'
              : 'Download derzeit nicht verfügbar.'}
          </Text>
        )}
      </ScrollView>
    </C14vSubpageShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
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
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
