import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import { PremiumButton, PremiumInput, InfoBanner } from '@/components/ui';
import { EmployeePortalVisitCompactCard } from '@/components/portal/EmployeePortalVisitCompactCard';
import { releaseSignatureCaptureEnvironment } from '@/lib/dom/releaseSignatureCaptureEnvironment';
import type { EmployeePortalSignatureCaptureInput } from '@/types/modules/employeePortalExecution';
import { spacing, typography } from '@/theme';

type EmployeePortalVisitSignaturePanelProps = {
  clientName: string;
  disabled?: boolean;
  loading?: boolean;
  capturedPreview?: string | null;
  compact?: boolean;
  /** Only render capture modal — no visible card (used when dashboard opens signature). */
  modalOnly?: boolean;
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
  compact = true,
  modalOnly = false,
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
    setModalVisible(true);
    onModalOpenChangeRef.current?.(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    onModalOpenChangeRef.current?.(false);
    releaseSignatureCaptureEnvironment();
  }, []);

  useEffect(() => {
    if (openCaptureRequest <= lastCaptureRequest.current || disabled) return;
    lastCaptureRequest.current = openCaptureRequest;
    openSignatureModal();
  }, [openCaptureRequest, disabled, openSignatureModal]);

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
      setCaptureError(
        result.error ?? 'Die Unterschrift konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.',
      );
    }
  };

  if (modalOnly) {
    return modalVisible ? (
      <CareSignatureModal
        visible
        label="Klient:innen-Unterschrift"
        dismissScope={visitId ?? 'signature'}
        onClose={closeModal}
        onConfirm={(dataUrl) => {
          void handleConfirm(dataUrl);
        }}
      />
    ) : null;
  }

  if (compact) {
    return (
      <>
        <EmployeePortalVisitCompactCard
          title="Unterschrift"
          status={preview ? 'Gespeichert' : 'Noch offen'}
          subtitle={preview ? 'Unterschrift erfasst' : 'Nach Dokumentation erfassen'}
          onPress={!disabled ? openSignatureModal : undefined}
        />
        {captureError ? <InfoBanner variant="danger" message={captureError} /> : null}
        {preview ? (
          <>
            <Image source={{ uri: preview }} style={styles.preview} resizeMode="contain" />
            {!disabled ? (
              <PremiumButton
                title="Neu erfassen"
                variant="secondary"
                loading={loading}
                onPress={openSignatureModal}
              />
            ) : null}
          </>
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
      </>
    );
  }

  return (
    <View style={styles.wrap}>
      <PremiumInput
        label="Unterzeichner:in"
        value={signerName}
        onChangeText={setSignerName}
        editable={!disabled}
      />
      {preview ? (
        <Image source={{ uri: preview }} style={styles.preview} resizeMode="contain" />
      ) : null}
      {captureError ? <InfoBanner variant="error" message={captureError} /> : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  preview: { width: '100%', height: 120, borderRadius: 8 },
  saved: { ...typography.caption, marginTop: spacing.xs },
});
