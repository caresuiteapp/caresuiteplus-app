import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumButton } from '@/components/ui';
import type { LandscapeOverlayVariant } from '@/config/landscapeRequiredScreens';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';

type Props = {
  visible: boolean;
  variant: LandscapeOverlayVariant;
  pending?: boolean;
  lockFailed?: boolean;
  onActivateLandscape: () => void;
  onContinuePortrait?: () => void;
};

/**
 * Dismissible landscape hint — rendered as a bottom sheet slot (flex sibling),
 * never as a floating banner over scrollable workflow content.
 */
export function LandscapePrompt({
  visible,
  variant,
  pending = false,
  lockFailed = false,
  onActivateLandscape,
  onContinuePortrait,
}: Props) {
  const { colors, typography } = useLegacyTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const friendlyHint = lockFailed
    ? 'Querformat konnte hier nicht automatisch aktiviert werden. Bitte Gerät drehen oder im Hochformat fortfahren.'
    : 'Bitte Gerät ins Querformat drehen für mehr Platz beim Unterschreiben.';

  const title =
    variant === 'sheet' && !lockFailed ? 'Querformat erforderlich' : 'Querformat empfohlen';

  return (
    <View
      style={[
        styles.host,
        {
          paddingBottom: Math.max(spacing.sm, insets.bottom),
          borderTopColor: colors?.borderSoft ?? 'rgba(0,0,0,0.08)',
          backgroundColor: colors?.surface ?? '#fff',
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={title}
      pointerEvents="auto"
    >
      <Text style={[styles.title, typography?.caption, { color: colors?.textPrimary ?? '#111' }]}>
        {title}
      </Text>
      <Text style={[styles.message, typography?.caption, { color: colors?.textMuted ?? '#666' }]}>
        {friendlyHint}
      </Text>
      <View style={styles.actions}>
        <PremiumButton
          title="Querformat aktivieren"
          variant="secondary"
          onPress={onActivateLandscape}
          loading={pending}
        />
        {onContinuePortrait ? (
          <Pressable
            onPress={onContinuePortrait}
            accessibilityRole="button"
            accessibilityLabel="Trotzdem fortfahren"
            style={styles.continueLink}
          >
            <Text
              style={[styles.continueLabel, typography?.caption, { color: colors?.primary ?? '#6c5ce7' }]}
            >
              Trotzdem fortfahren
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  title: {
    fontWeight: '600',
  },
  message: {
    lineHeight: 18,
  },
  actions: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  continueLink: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  continueLabel: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
