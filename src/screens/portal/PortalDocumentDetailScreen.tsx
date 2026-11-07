import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter as useRouter } from '@/hooks/useFlowRouter';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { LockedActionBanner } from '@/components/permissions';
import { PortalDocumentDetailHero } from '@/components/portal';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  SuccessState,
} from '@/components/ui';
import { usePortalDocumentDetail } from '@/hooks/usePortalDocumentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { colors, spacing, typography } from '@/theme';
import { portalPremium } from '@/design/tokens/portalPremium';

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
  } = usePortalDocumentDetail(id, 'employee');

  if (!canView) {
    return (
      <PortalTabScreen title="Dokument" subtitle={resolvePortalScreenSubtitle(roleLabel, 'employee')}>
        <LockedActionBanner
          message={check('portal.employee.documents.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </PortalTabScreen>
    );
  }

  if (loading) {
    return (
      <PortalTabScreen title="Dokument" subtitle="Wird geladen…">
        <LoadingState message="Dokument wird geladen…" />
      </PortalTabScreen>
    );
  }

  if (notFound || error) {
    return (
      <PortalTabScreen title="Dokument" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Das Dokument existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </PortalTabScreen>
    );
  }

  if (!data) return null;

  return (
    <PortalTabScreen title={data.title} contentOwnsHero
      actionsSlot={<PremiumButton title="Zu den Dokumenten" size="sm" variant="secondary"
        onPress={() => router.replace('/portal/employee/documents' as never)} />}>
      <View style={styles.content}>
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
      </View>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.md },
  previewSection: {
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
    color: portalPremium.text.secondary,
    textAlign: 'center',
  },
});
