import { StyleSheet, Text, View } from 'react-native';
import { InfoBanner } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { typography } from '@/theme';

type Props = {
  variant: 'import' | 'export';
};

export function CsvSecurityNotice({ variant }: Props) {
  const text = useAuroraAdaptiveText();
  const message =
    variant === 'import'
      ? 'Bitte importieren Sie nur Daten, für die eine rechtmäßige Grundlage zur Verarbeitung besteht. Die importierten Daten werden dem aktuellen Mandanten zugeordnet und im System protokolliert.'
      : 'Dieser Export enthält personenbezogene Daten. Bitte stellen Sie sicher, dass die Datei nur berechtigten Personen zugänglich gemacht und sicher gespeichert wird.';

  return (
    <View style={styles.wrap}>
      <InfoBanner variant="warning" message={message} />
      <Text style={[styles.hint, { color: text.muted }]}>Alle Importe und Exporte werden mandantenspezifisch protokolliert.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: careSpacing.sm },
  hint: { ...typography.caption },
});
