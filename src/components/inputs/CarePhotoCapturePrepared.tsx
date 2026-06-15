import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { colors, spacing, typography } from '@/theme';

type Props = {
  title?: string;
};

export function CarePhotoCapturePrepared({ title = 'Foto / Scan' }: Props) {
  return (
    <PremiumCard>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.banner}>
        Foto- und Scan-Funktion ist vorbereitet. Je nach Gerät und Anbindung können Dokumente künftig
        direkt erfasst werden. Aktuell bitte Upload nutzen — kein simulierter Erfolg.
      </Text>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.label, marginBottom: spacing.xs },
  banner: {
    ...typography.caption,
    color: colors.textMuted,
    backgroundColor: colors.bgPanel,
    padding: spacing.sm,
    borderRadius: 8,
  },
});
