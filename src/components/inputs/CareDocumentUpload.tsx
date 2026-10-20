import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { colors, spacing, typography } from '@/theme';

type Props = {
  label?: string;
  onPicked: (file: { name: string; mimeType: string; size?: number }) => void;
  error?: string;
};

export function CareDocumentUpload({ label, onPicked, error }: Props) {
  const [lastFile, setLastFile] = useState<string | null>(null);

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setLastFile(asset.name);
    onPicked({
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size,
    });
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <PremiumButton title="Dokument auswählen" variant="secondary" onPress={pick} />
      {lastFile ? <Text style={styles.file}>Ausgewählt: {lastFile}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.label, marginBottom: spacing.xs },
  file: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
});
