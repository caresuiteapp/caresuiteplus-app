import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  onDismiss?: () => void;
  onContinuePortrait?: () => void;
};

export function LandscapeRequiredOverlay({
  visible,
  variant,
  pending = false,
  lockFailed = false,
  onActivateLandscape,
  onDismiss,
  onContinuePortrait,
}: Props) {
  const { colors, typography } = useLegacyTheme();

  if (!visible) return null;

  const friendlyHint = lockFailed
    ? 'Querformat konnte hier nicht automatisch aktiviert werden. Bitte Gerät drehen oder im Hochformat fortfahren.'
    : 'Bitte Gerät ins Querformat drehen, um fortzufahren.';

  if (variant === 'banner') {
    return (
      <View style={styles.bannerHost} pointerEvents="box-none">
        <View
          style={[styles.banner, { backgroundColor: colors?.surface ?? '#fff' }]}
          accessibilityRole="text"
          accessibilityLabel="Querformat empfohlen"
        >
          <View style={styles.bannerText}>
            <Text style={[styles.bannerTitle, typography?.caption, { color: colors?.textPrimary ?? '#111' }]}>
              Querformat empfohlen
            </Text>
            <Text style={[styles.bannerMessage, typography?.caption, { color: colors?.textMuted ?? '#666' }]}>
              Drehen Sie Ihr Gerät für mehr Platz.
            </Text>
          </View>
          <PremiumButton
            title="Aktivieren"
            variant="secondary"
            onPress={onActivateLandscape}
            loading={pending}
          />
          {onDismiss ? (
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Hinweis schließen"
              hitSlop={8}
              style={styles.dismissButton}
            >
              <Text style={[styles.dismissLabel, typography?.caption, { color: colors?.textMuted ?? '#666' }]}>
                ✕
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  if (variant === 'hint') {
    return (
      <View style={styles.hintHost} pointerEvents="box-none">
        <View
          style={[styles.hintCard, { backgroundColor: colors?.surface ?? '#fff' }]}
          accessibilityRole="text"
          accessibilityLabel="Querformat empfohlen"
        >
          <Text style={[styles.hintTitle, typography?.caption, { color: colors?.textPrimary ?? '#111' }]}>
            Bitte Gerät drehen
          </Text>
          <Text style={[styles.hintMessage, typography?.caption, { color: colors?.textMuted ?? '#666' }]}>
            {friendlyHint}
          </Text>
          <View style={styles.hintActions}>
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
                <Text style={[styles.continueLabel, typography?.caption, { color: colors?.primary ?? '#6c5ce7' }]}>
                  Trotzdem fortfahren
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

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
  bannerHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bannerTitle: {
    fontWeight: '600',
  },
  bannerMessage: {
    fontSize: 12,
  },
  dismissButton: {
    padding: spacing.xs,
  },
  dismissLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  hintHost: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    pointerEvents: 'box-none',
  },
  hintCard: {
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  hintTitle: {
    fontWeight: '600',
  },
  hintMessage: {
    lineHeight: 18,
  },
  hintActions: {
    gap: spacing.xs,
    alignItems: 'stretch',
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
