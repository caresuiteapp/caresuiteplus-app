import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import { getServiceMode } from '@/lib/services/mode';
import { colors, spacing, typography } from '@/theme';

type Props = {
  hint?: string;
};

export function PreparedTemplateBanner({ hint }: Props) {
  const mode = getServiceMode();
  const label = mode === 'demo' ? 'D-DEMO · Vorlagen' : mode === 'supabase' ? 'P-PROD · Live' : 'P-READY · Vorbereitet';
  const variant = mode === 'demo' ? 'cyan' : mode === 'supabase' ? 'green' : 'orange';

  return (
    <View style={styles.wrap}>
      <PremiumBadge label={label} variant={variant} dot />
      <Text style={styles.hint}>
        {hint ??
          (mode === 'demo'
            ? 'Vorlagen und Kataloge werden im Demo-Mandanten persistiert.'
            : 'Live-Supabase-Anbindung aktiv — System- und Mandantenvorlagen aus der Datenbank.')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, marginBottom: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted },
});
