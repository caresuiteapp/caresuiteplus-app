import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';

type Props = {
  visible: boolean;
  pending?: boolean;
  error?: string | null;
  onActivateLandscape: () => void;
};

export function LandscapeRequiredOverlay({
  visible,
  pending = false,
  error = null,
  onActivateLandscape,
}: Props) {
  const { colors, typography } = useLegacyTheme();

  if (!visible) return null;

  return (
    <View
      style={styles.root}
      accessibilityRole="alert"
      accessibilityLabel="Querformat erforderlich"
      pointerEvents="auto"
    >
      <View style={[styles.card, { backgroundColor: colors?.surface ?? '#fff' }]}>
        <Text style={[styles.title, typography?.h3, { color: colors?.textPrimary ?? '#111' }]}>
          Querformat erforderlich
        </Text>
        <Text style={[styles.message, typography?.body, { color: colors?.textMuted ?? '#666' }]}>
          Bitte Gerät ins Querformat drehen, um fortzufahren.
        </Text>
        <PremiumButton
          title="Querformat aktivieren"
          variant="primary"
          fullWidth
          loading={pending}
          onPress={onActivateLandscape}
        />
        {error ? (
          <Text style={[styles.error, typography?.caption, { color: colors?.danger ?? '#c0392b' }]}>
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: 'rgba(7, 11, 18, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
  },
  message: {
    textAlign: 'center',
  },
  error: {
    textAlign: 'center',
  },
});
