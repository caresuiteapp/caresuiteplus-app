import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { PortalDocumentDetailHero } from '@/components/portal/PortalDocumentDetailHero';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useEmployeePortalClientDocument } from '@/hooks/useEmployeePortalClientDocument';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';
import { webSafeAreaPadding } from '@/lib/platform/webSafeArea';
import { EmployeePortalAgendaAction } from './employee/EmployeePortalAgendaAction';
import { ClientRecordLoading } from './employee/EmployeePortalClientRecordLayout';
import { employeePortalDesign as c } from './employee/employeePortalDesign';

type EmployeePortalClientDocumentPreviewSheetProps = {
  clientId: string;
  documentId: string;
  visible: boolean;
  onClose: () => void;
};

export function EmployeePortalClientDocumentPreviewSheet({
  clientId,
  documentId,
  visible,
  onClose,
}: EmployeePortalClientDocumentPreviewSheetProps) {
  const insets = useSafeAreaInsets();
  const { width } = useHydrationSafeWindowDimensions();
  const wide = width >= 700;
  const { data, loading, error, refresh, download, downloadLoading, downloadError } =
    useEmployeePortalClientDocument(clientId, visible ? documentId : null);
  const hasPreview = Boolean(data?.viewReady && data.previewHtml);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}
      statusBarTranslucent testID="employee-client-document-preview-sheet">
      <View style={[styles.overlay, wide && styles.centered]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View style={[styles.sheet, wide && styles.wideSheet, {
          paddingBottom: webSafeAreaPadding('bottom', insets.bottom + 12) as number,
        }]} accessibilityViewIsModal>
          <View style={styles.heading}>
            <Text accessibilityRole="header" aria-level={2} style={styles.headingText}>Dokumentvorschau</Text>
            <EmployeePortalAgendaAction label="Schließen" icon="close-outline" onPress={onClose} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator>
            {loading && !data ? <ClientRecordLoading message="Dokument wird geladen …" /> : null}
            {error && !data ? (
              <InfoBanner variant="error" presentation="inline" onDarkSurface title="Dokument nicht verfügbar"
                message={error} actionLabel="Erneut versuchen" onAction={() => void refresh()} />
            ) : null}
            {!loading && !error && !data ? <Text style={styles.copy}>Das Dokument ist derzeit nicht verfügbar.</Text> : null}
            {data ? (
              <>
                <PortalDocumentDetailHero document={data} scope="employee" />
                {hasPreview && data.previewHtml ? (
                  <DocumentHtmlPreview title={data.title} previewHtml={data.previewHtml} />
                ) : (
                  <Text style={styles.copy}>
                    {data.downloadReady ? 'Die Datei kann direkt geöffnet werden.' : 'Dieses Dokument steht derzeit nicht zur Vorschau bereit.'}
                  </Text>
                )}
                {downloadError ? <InfoBanner variant="error" presentation="inline" onDarkSurface message={downloadError} /> : null}
                {data.downloadReady ? (
                  <View style={styles.actions}>
                    <EmployeePortalAgendaAction label={hasPreview ? 'Herunterladen' : 'Datei öffnen'} icon="download-outline"
                      primary busy={downloadLoading} onPress={() => void download()} />
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(8,24,42,.75)' },
  centered: { justifyContent: 'center', padding: 12 },
  sheet: {
    width: '100%', maxWidth: 930, maxHeight: '95%', flexShrink: 1, padding: 12, gap: 10,
    borderTopLeftRadius: 21, borderTopRightRadius: 21, borderWidth: 1, borderColor: c.line, backgroundColor: c.dialog,
  },
  wideSheet: { borderRadius: 21 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  headingText: { flexShrink: 1, color: c.text, fontSize: font(17), lineHeight: font(23), fontWeight: '800' },
  scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  content: { gap: 10, paddingBottom: 4 },
  copy: { color: c.muted, fontSize: font(13), lineHeight: font(19) },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
}));
