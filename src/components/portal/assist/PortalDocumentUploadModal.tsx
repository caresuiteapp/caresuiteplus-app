import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { uploadPortalDocument } from '@/lib/portal/assist/portalDocumentUploadService';
import { isDemoMode } from '@/lib/supabase/config';

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/*',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

type PickedPortalFile = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  contentBase64: string;
};

type PortalDocumentUploadModalProps = {
  visible: boolean;
  tenantId: string;
  clientId: string;
  portalUserId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
};

async function readPickedFile(asset: DocumentPicker.DocumentPickerAsset): Promise<PickedPortalFile | null> {
  const fileName = asset.name ?? 'dokument';
  const mimeType = asset.mimeType ?? 'application/octet-stream';

  if (isDemoMode()) {
    return {
      name: fileName,
      mimeType,
      sizeBytes: asset.size ?? 0,
      contentBase64: 'demo',
    };
  }

  try {
    const response = await fetch(asset.uri);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i] ?? 0);
    }
    return {
      name: fileName,
      mimeType,
      sizeBytes: asset.size ?? bytes.length,
      contentBase64: btoa(binary),
    };
  } catch {
    return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Glass modal with file picker for client portal document upload. */
export function PortalDocumentUploadModal({
  visible,
  tenantId,
  clientId,
  portalUserId,
  onClose,
  onSuccess,
}: PortalDocumentUploadModalProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const isLive = !isDemoMode();

  const [pickedFile, setPickedFile] = useState<PickedPortalFile | null>(null);
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setPickedFile(null);
    setCategory('');
    setMessage('');
    setError(null);
    setProgressLabel(null);
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePickFile = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ACCEPTED_MIME_TYPES,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const file = await readPickedFile(result.assets[0]);
    if (!file) {
      setError('Datei konnte nicht gelesen werden.');
      return;
    }
    setPickedFile(file);
  };

  const handleSubmit = async () => {
    if (!pickedFile) {
      setError('Bitte wählen Sie eine Datei aus.');
      return;
    }
    if (isLive && (!pickedFile.contentBase64 || pickedFile.sizeBytes <= 0)) {
      setError('Datei ist leer — bitte erneut auswählen.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setProgressLabel('Datei wird hochgeladen…');

    const result = await uploadPortalDocument({
      tenantId,
      clientId,
      portalUserId,
      fileName: pickedFile.name,
      mimeType: pickedFile.mimeType,
      sizeBytes: pickedFile.sizeBytes,
      contentBase64: pickedFile.contentBase64,
      message,
      category: category.trim() || null,
    });

    setSubmitting(false);
    setProgressLabel(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    resetForm();
    onSuccess?.();
    onClose();
  };

  return (
    <PortalGlassModal
      visible={visible}
      title="Dokument-Upload"
      onClose={handleClose}
      primaryLabel="Hochladen"
      primaryLoading={submitting}
      onPrimary={() => void handleSubmit()}
    >
      <PremiumButton
        title={pickedFile ? `Datei: ${pickedFile.name}` : 'Datei auswählen'}
        variant="secondary"
        onPress={() => void handlePickFile()}
        disabled={submitting}
      />
      {pickedFile ? (
        <View style={styles.preview}>
          <Text style={[type.caption, { color: text.secondary }]}>
            {pickedFile.name} · {formatFileSize(pickedFile.sizeBytes)}
          </Text>
        </View>
      ) : null}
      <PremiumInput
        label="Kategorie (optional)"
        value={category}
        onChangeText={setCategory}
        placeholder="z. B. Rechnung, Arztbrief"
        editable={!submitting}
      />
      <PremiumInput
        label="Nachricht (optional)"
        value={message}
        onChangeText={setMessage}
        placeholder="Was möchten Sie mitteilen?"
        multiline
        editable={!submitting}
      />
      {progressLabel ? (
        <Text style={[type.caption, { color: text.muted }]}>{progressLabel}</Text>
      ) : null}
      {error ? (
        <Text style={[type.caption, styles.error, { color: text.secondary }]}>{error}</Text>
      ) : null}
    </PortalGlassModal>
  );
}

const styles = StyleSheet.create({
  preview: {
    marginTop: -careSpacing.xs,
  },
  error: {
    color: '#c0392b',
  },
});
