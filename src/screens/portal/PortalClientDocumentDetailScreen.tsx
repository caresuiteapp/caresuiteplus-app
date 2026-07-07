import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
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
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalActor } from '@/hooks/usePortalActor';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { saveClientPortalAssistProofSignature } from '@/lib/portal/clientPortalAssistProofSignatureService';
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
  const { tenantId, clientId, actorId } = usePortalActor();
  const canView = can('portal.client.documents.view');
  const canDownload = can('portal.client.documents.download');

  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signLoading, setSignLoading] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signSuccess, setSignSuccess] = useState<string | null>(null);

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

  const handleSignConfirm = useCallback(
    async (dataUrl: string) => {
      if (!tenantId || !clientId || !id) return;
      setSignLoading(true);
      setSignError(null);
      const result = await saveClientPortalAssistProofSignature({
        tenantId,
        clientId,
        proofId: id,
        profileId: actorId,
        signerName: data.clientName ?? 'Klient:in',
        signatureDataUrl: dataUrl,
      });
      setSignLoading(false);
      if (!result.ok) {
        setSignError(result.error ?? 'Unterschrift konnte nicht gespeichert werden.');
        return;
      }
      setSignatureOpen(false);
      setSignSuccess('Vielen Dank — Ihre Unterschrift wurde gespeichert.');
      await refresh();
    },
    [tenantId, clientId, id, actorId, data?.clientName, refresh],
  );

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
        {signSuccess ? <SuccessState message={signSuccess} /> : null}
        {successMessage ? <SuccessState message={successMessage} /> : null}

        <PortalDocumentDetailHero document={data} scope="client" />

        {data.description ? (
          <Text style={[styles.hint, { color: themeColors.textPrimary }]}>{data.description}</Text>
        ) : null}

        {data.viewReady && data.previewHtml ? (
          <View style={styles.previewSection}>
            <DocumentHtmlPreview
              title={data.title}
              previewHtml={data.previewHtml}
            />
          </View>
        ) : null}

        {signError ? <Text style={styles.error}>{signError}</Text> : null}
        {downloadError ? <Text style={styles.error}>{downloadError}</Text> : null}

        {data.canSign && data.signaturePending ? (
          <PremiumButton
            title="Unterschreiben"
            testID="client-portal-proof-sign-button"
            fullWidth
            loading={signLoading}
            onPress={() => setSignatureOpen(true)}
          />
        ) : data.signedViaClientPortal ? (
          <SuccessState message="Klient:in hat unterschrieben" />
        ) : null}

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

      <CareSignatureModal
        visible={signatureOpen}
        label="Unterschrift Leistungsnachweis"
        dismissScope={id}
        disabled={signLoading}
        onClose={() => setSignatureOpen(false)}
        onConfirm={handleSignConfirm}
      />
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
