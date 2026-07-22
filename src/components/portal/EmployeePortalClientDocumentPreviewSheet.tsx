import { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { PortalDocumentDetailHero } from '@/components/portal/PortalDocumentDetailHero';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { darkGlassSurfaceText } from '@/design/tokens/auroraGlass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useEmployeePortalClientDocument } from '@/hooks/useEmployeePortalClientDocument';
import { webSafeAreaPadding } from '@/lib/platform/webSafeArea';

type EmployeePortalClientDocumentPreviewSheetProps = {
  clientId: string;
  documentId: string | null;
  visible: boolean;
  onClose: () => void;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

export function EmployeePortalClientDocumentPreviewSheet({
  clientId,
  documentId,
  visible,
  onClose,
}: EmployeePortalClientDocumentPreviewSheetProps) {
  const insets = useSafeAreaInsets();
  const text = darkGlassSurfaceText;
  const { data, loading, error, refresh, download, downloadLoading, downloadError } =
    useEmployeePortalClientDocument(clientId, visible ? documentId : null);

  const panelStyle = useMemo(
    () => ({
      paddingBottom: webSafeAreaPadding('bottom', insets.bottom + careSpacing.md) as number,
    }),
    [insets.bottom],
  );

  const openExternal = () => {
    if (!data?.previewHtml && data?.downloadReady) {
      void download();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      testID="employee-client-document-preview-sheet"
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Vorschau schließen" />
        <View
          style={[
            styles.sheet,
            panelStyle,
            { backgroundColor: careLightColors.surface, borderColor: careLightColors.borderStrong },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={styles.handle} />
            <Pressable onPress={onClose} style={[styles.closeBtn, webCursor]} accessibilityLabel="Schließen">
              <Text style={[styles.closeText, { color: text.muted }]}>✕</Text>
            </Pressable>
          </View>

          {loading && !data ? (
            <LoadingState message="Dokument wird geladen…" />
          ) : error && !data ? (
            <ErrorState title="Dokument" message={error} onRetry={refresh} />
          ) : data ? (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <PortalDocumentDetailHero document={data} scope="employee" />

              {data.viewReady && data.previewHtml ? (
                <DocumentHtmlPreview title={data.title} previewHtml={data.previewHtml} />
              ) : data.downloadReady ? (
                <View style={styles.fallbackBox}>
                  <Text style={[styles.fallbackText, { color: text.secondary }]}>
                    Vorschau als HTML nicht verfügbar — PDF/Datei öffnen oder herunterladen.
                  </Text>
                  <PremiumButton
                    title="Datei öffnen"
                    onPress={() => void download()}
                    loading={downloadLoading}
                  />
                </View>
              ) : (
                <Text style={[styles.fallbackText, { color: text.muted }]}>
                  Dieses Dokument steht derzeit nicht zur Vorschau bereit.
                </Text>
              )}

              {downloadError ? (
                <Text style={styles.errorText}>{downloadError}</Text>
              ) : null}

              {data.downloadReady ? (
                <PremiumButton
                  title="Herunterladen"
                  variant="secondary"
                  onPress={() => void download()}
                  loading={downloadLoading}
                />
              ) : null}

              {Platform.OS === 'web' && data.previewHtml ? (
                <PremiumButton
                  title="In neuem Tab öffnen"
                  variant="ghost"
                  onPress={openExternal}
                />
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingTop: careSpacing.sm,
    paddingHorizontal: careSpacing.md,
  },
  handleRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: careSpacing.sm,
    minHeight: 28,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: careLightColors.borderStrong,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: careSpacing.xs,
  },
  closeText: { ...careTypography.h3, lineHeight: 22 },
  content: { gap: careSpacing.md, paddingBottom: careSpacing.lg },
  fallbackBox: { gap: careSpacing.sm },
  fallbackText: { ...careTypography.body },
  errorText: { ...careTypography.caption, color: '#DC2626' },
});
