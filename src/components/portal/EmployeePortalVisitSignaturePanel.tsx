import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import { PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import type { EmployeePortalSignatureCaptureInput } from '@/types/modules/employeePortalExecution';
import { spacing, typography } from '@/theme';

type EmployeePortalVisitSignaturePanelProps = {
  clientName: string;
  disabled?: boolean;
  loading?: boolean;
  capturedPreview?: string | null;
  /** Increment to request opening the signature modal (e.g. after documentation save). */
  openRequest?: number;
  onCapture: (input: EmployeePortalSignatureCaptureInput) => Promise<{ ok: boolean; error?: string }>;
};

export function EmployeePortalVisitSignaturePanel({
  clientName,
  disabled = false,
  loading = false,
  capturedPreview,
  openRequest = 0,
  onCapture,
}: EmployeePortalVisitSignaturePanelProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [signerName, setSignerName] = useState(clientName);
  const [preview, setPreview] = useState<string | null>(capturedPreview ?? null);

  useEffect(() => {
    if (openRequest > 0 && !disabled && !preview) {
      setModalVisible(true);
    }
  }, [openRequest, disabled, preview]);

  const handleConfirm = async (dataUrl: string) => {
    const result = await onCapture({
      signatureType: 'service_proof',
      signerName: signerName.trim(),
      signatureDataUrl: dataUrl,
    });
    if (result.ok) {
      setPreview(dataUrl);
      setModalVisible(false);
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
      {!disabled ? (
        <PremiumButton
          title={preview ? 'Unterschrift erneut erfassen' : 'Unterschrift erfassen'}
          fullWidth
          loading={loading}
          onPress={() => setModalVisible(true)}
        />
      ) : preview ? (
        <Text style={styles.saved}>Unterschrift gespeichert.</Text>
      ) : null}
      <CareSignatureModal
        visible={modalVisible}
        label="Klient:innen-Unterschrift"
        onClose={() => setModalVisible(false)}
        onConfirm={(dataUrl) => {
          void handleConfirm(dataUrl);
        }}
      />
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing.sm, marginBottom: spacing.sm },
  preview: { width: '100%', height: 120, borderRadius: 8, marginBottom: spacing.sm },
  saved: { ...typography.caption, marginTop: spacing.xs },
});
