import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { SignatureDisplay } from '@/components/signatures';
import {
  InfoBanner,
  PremiumBadge,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { requestLandscapeLock } from '@/lib/orientation/requestLandscapeLock';
import type {
  PortalSignatureDocumentDetail,
  PortalSignatureSignerRole,
} from '@/types/portal/documentSignatures';
import {
  PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS,
  PORTAL_SIGNATURE_PRIORITY_LABELS,
  PORTAL_SIGNATURE_STATUS_LABELS,
} from '@/types/portal/documentSignatures';
import { spacing, typography } from '@/theme';

type PortalSignatureCapturePanelProps = {
  detail: PortalSignatureDocumentDetail;
  disabled?: boolean;
  loading?: boolean;
  onSign: (input: {
    signerRole: PortalSignatureSignerRole;
    signerName: string;
    signatureDataUrl: string;
  }) => Promise<{ ok: boolean; error?: string }>;
};

export function PortalSignatureCapturePanel({
  detail,
  disabled = false,
  loading = false,
  onSign,
}: PortalSignatureCapturePanelProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [signerName, setSignerName] = useState(
    detail.nextSignerRole === 'client' ? detail.clientName ?? '' : '',
  );
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const nextRole = detail.nextSignerRole;
  const canSign = !disabled && nextRole != null && detail.status !== 'completed';

  const openModal = useCallback(() => {
    if (Platform.OS === 'web') {
      void requestLandscapeLock({ tryFullscreen: true });
    }
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => setModalVisible(false), []);

  const handleConfirm = async (dataUrl: string) => {
    if (!nextRole) return;
    setCaptureError(null);
    setSuccessMessage(null);
    const result = await onSign({
      signerRole: nextRole,
      signerName: signerName.trim(),
      signatureDataUrl: dataUrl,
    });
    if (result.ok) {
      setSuccessMessage('Unterschrift gespeichert — Dokument wird finalisiert.');
      closeModal();
    } else {
      setCaptureError(result.error ?? 'Unterschrift konnte nicht gespeichert werden.');
    }
  };

  const roleLabel =
    nextRole === 'employee'
      ? 'Mitarbeiter-Unterschrift'
      : nextRole === 'client'
        ? 'Klient:innen-Unterschrift'
        : 'Unterschrift';

  return (
    <>
      <SectionPanel title="Dokumentvorschau" subtitle="Vollständig lesen vor der Unterschrift">
        <DocumentHtmlPreview
          title={detail.title}
          previewHtml={detail.previewHtml ?? '<p>Keine Vorschau verfügbar.</p>'}
        />
      </SectionPanel>

      <SectionPanel title="Unterschriften" subtitle={PORTAL_SIGNATURE_STATUS_LABELS[detail.status]}>
        {detail.captures.map((capture) => (
          <View key={capture.id} style={styles.captureRow}>
            <SignatureDisplay
              signerName={capture.signerName}
              signedAt={capture.signedAt}
              signatureType={capture.signerRole === 'employee' ? 'Mitarbeiter' : 'Klient'}
              label={
                capture.signerRole === 'employee'
                  ? 'Mitarbeiter-Unterschrift'
                  : 'Klient:innen-Unterschrift'
              }
            />
            <Text style={styles.auditLine}>Audit-ID: {capture.auditId}</Text>
          </View>
        ))}

        {canSign ? (
          <View style={styles.signBlock}>
            <PremiumInput
              label="Unterzeichner:in"
              value={signerName}
              onChangeText={setSignerName}
              editable={!loading}
            />
            {nextRole === 'client' ? (
              <InfoBanner
                variant="info"
                message="Legen Sie das Gerät der Klient:in vor — Unterschrift direkt im Portal."
              />
            ) : null}
            {captureError ? <InfoBanner variant="error" message={captureError} /> : null}
            {successMessage ? <InfoBanner variant="success" message={successMessage} /> : null}
            <PremiumButton
              title={`${roleLabel} erfassen`}
              fullWidth
              loading={loading}
              onPress={openModal}
            />
          </View>
        ) : detail.status === 'completed' ? (
          <InfoBanner variant="success" message="Dokument vollständig unterschrieben und archiviert." />
        ) : null}
      </SectionPanel>

      {modalVisible && nextRole ? (
        <CareSignatureModal
          visible
          label={roleLabel}
          dismissScope={detail.id}
          onClose={closeModal}
          onConfirm={(dataUrl) => {
            void handleConfirm(dataUrl);
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  captureRow: { marginBottom: spacing.md },
  signBlock: { gap: spacing.sm, marginTop: spacing.sm },
  metaLine: { ...typography.body, marginBottom: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  auditLine: { ...typography.caption, marginTop: spacing.xs },
});

type PortalSignatureMetaPanelProps = {
  detail: PortalSignatureDocumentDetail;
};

export function PortalSignatureMetaPanel({ detail }: PortalSignatureMetaPanelProps) {
  return (
    <SectionPanel title="Metadaten">
      <Text style={styles.metaLine}>
        Typ: {PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS[detail.documentType]}
      </Text>
      {detail.clientName ? (
        <Text style={styles.metaLine}>Klient: {detail.clientName}</Text>
      ) : null}
      <Text style={styles.metaLine}>Ersteller: {detail.creatorName}</Text>
      <Text style={styles.metaLine}>
        Priorität: {PORTAL_SIGNATURE_PRIORITY_LABELS[detail.priority]}
      </Text>
      <View style={styles.badges}>
        <PremiumBadge label={PORTAL_SIGNATURE_STATUS_LABELS[detail.status]} variant="cyan" />
        {detail.requiredBeforeAssignment ? (
          <PremiumBadge label="Pflicht vor Einsatz" variant="red" />
        ) : null}
      </View>
    </SectionPanel>
  );
}
