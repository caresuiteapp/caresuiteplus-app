import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { typography } from '@/theme';

type Props = {
  onFileSelected: (file: { name: string; size: number; content: string }) => void;
  disabled?: boolean;
  selectedFileName?: string | null;
};

export function CsvUploadDropzone({ onFileSelected, disabled, selectedFileName }: Props) {
  const text = useAuroraAdaptiveText();

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: Platform.OS === 'web' ? ['text/csv', 'text/plain', 'application/vnd.ms-excel'] : '*/*',
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const response = await fetch(asset.uri);
    const content = await response.text();
    onFileSelected({
      name: asset.name ?? 'import.csv',
      size: asset.size ?? content.length,
      content,
    });
  }

  return (
    <SectionPanel title="CSV-Datei hochladen" subtitle="Schritt 2: Datei auswählen und prüfen">
      <Pressable
        style={[styles.dropzone, { borderColor: text.border }]}
        onPress={disabled ? undefined : pickFile}
        accessibilityRole="button"
      >
        <Text style={[styles.dropTitle, { color: text.primary }]}>
          {selectedFileName ? selectedFileName : 'Datei hier ablegen oder auswählen'}
        </Text>
        <Text style={[styles.dropMeta, { color: text.muted }]}>CSV · UTF-8 · max. 5.000 Zeilen</Text>
      </Pressable>
      <View style={styles.actions}>
        <PremiumButton title="CSV-Datei hochladen" onPress={pickFile} disabled={disabled} />
      </View>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  dropzone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: careSpacing.lg,
    alignItems: 'center',
    gap: careSpacing.xs,
  },
  dropTitle: { ...typography.bodyStrong, textAlign: 'center' },
  dropMeta: { ...typography.caption },
  actions: { marginTop: careSpacing.sm },
});
