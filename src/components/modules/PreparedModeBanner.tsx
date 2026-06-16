import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type Props = {
  mode?: 'demo' | 'prepared';
  hint?: string;
};

export function PreparedModeBanner({ mode = 'prepared', hint }: Props) {
  const label = mode === 'demo' ? 'Demo-Daten' : 'P-READY · Vorbereitet';
  const variant = mode === 'demo' ? 'cyan' : 'orange';

  return (
    <View style={styles.wrap}>
      <PremiumBadge label={label} variant={variant} dot />
      <Text style={styles.hint}>
        {hint ?? 'Live-Anbindung folgt — Funktionen sind mit Demo-Daten nutzbar.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, marginBottom: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted },
});
