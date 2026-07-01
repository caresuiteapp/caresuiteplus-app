import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import { PremiumButton, PremiumInput, SectionPanel, InfoBanner } from '@/components/ui';
import { requestLandscapeLock } from '@/lib/orientation/requestLandscapeLock';
import type { EmployeePortalSignatureCaptureInput } from '@/types/modules/employeePortalExecution';
import { spacing, typography } from '@/theme';

type EmployeePortalVisitSignaturePanelProps = {
  clientName: string;
  disabled?: boolean;
  loading?: boolean;
  capturedPreview?: string | null;
  /** Increment to open the signature capture modal (explicit user/workflow action only). */
  openCaptureRequest?: number;
  /** Visit id for landscape dismiss scope and workflow persistence. */
  visitId?: string;
  onModalOpenChange?: (open: boolean) => void;
  onCapture: (input: EmployeePortalSignatureCaptureInput) => Promise<{ ok: boolean; error?: string }>;
};

export function EmployeePortalVisitSignaturePanel({
  clientName,
  disabled = false,
  loading = false,
  capturedPreview,
  openCaptureRequest = 0,
  visitId,
  onModalOpenChange,
  onCapture,
}: EmployeePortalVisitSignaturePanelProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [signerName, setSignerName] = useState(clientName);
  const [preview, setPreview] = useState<string | null>(capturedPreview ?? null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const lastCaptureRequest = useRef(0);
  const onModalOpenChangeRef = useRef(onModalOpenChange);

  useEffect(() => {
    onModalOpenChangeRef.current = onModalOpenChange;
  }, [onModalOpenChange]);

  useEffect(() => {
    setPreview(capturedPreview ?? null);
  }, [capturedPreview]);

  const openSignatureModal = useCallback(() => {
    if (Platform.OS === 'web') {
      void requestLandscapeLock({ tryFullscreen: true });
    }
    setModalVisible(true);
    onModalOpenChangeRef.current?.(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    onModalOpenChangeRef.current?.(false);
  }, []);

  useEffect(() => {
    if (openCaptureRequest <= lastCaptureRequest.current || disabled || preview) return;
    lastCaptureRequest.current = openCaptureRequest;
    openSignatureModal();
  }, [openCaptureRequest, disabled, preview, openSignatureModal]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        closeModal();
      };
    }, [closeModal]),
  );

  const handleConfirm = async (dataUrl: string) => {
    setCaptureError(null);
    const result = await onCapture({
      signatureType: 'service_proof',
      signerName: signerName.trim(),
      signatureDataUrl: dataUrl,
    });
    if (result.ok) {
      setPreview(dataUrl);
      closeModal();
    } else {
      setCaptureError(result.error ?? 'Unterschrift konnte nicht gespeichert werden.');
    }
  };

  return (
    <SectionPanel title="Unterschrift" subtitle="Klient:in / Angehörige:r">
      <View style={styles.fields}>
        <PremiumInput
          label="Unterzeichner:in"
          value={signerName}
          onChangeText={setSignerName}
          editable={!disabled}
        />
      </View>
      {preview ? (
        <Image source={{ uri: preview }} style={styles.preview} resizeMode="contain" />
      ) : null}
      {captureError ? (
        <InfoBanner variant="error" message={captureError} />
      ) : null}
      {!disabled ? (
        <PremiumButton
          title={preview ? 'Unterschrift erneut erfassen' : 'Unterschrift erfassen'}
          fullWidth
          loading={loading}
          onPress={openSignatureModal}
        />
      ) : preview ? (
        <Text style={styles.saved}>Unterschrift gespeichert.</Text>
      ) : null}
      {modalVisible ? (
        <CareSignatureModal
          visible
          label="Klient:innen-Unterschrift"
          dismissScope={visitId ?? 'signature'}
          onClose={closeModal}
          onConfirm={(dataUrl) => {
            void handleConfirm(dataUrl);
          }}
        />
      ) : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing.sm, marginBottom: spacing.sm },
  preview: { width: '100%', height: 120, borderRadius: 8, marginBottom: spacing.sm },
  saved: { ...typography.caption, marginTop: spacing.xs },
});
