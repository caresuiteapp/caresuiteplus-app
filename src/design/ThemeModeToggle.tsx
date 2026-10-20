import { Pressable, StyleSheet, Text } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { resolveCareSuitePalette } from '@/design/tokens/colors';
import { useThemeMode } from './ThemeModeProvider';

type ThemeModeToggleProps = {
  compact?: boolean;
};

/** Runtime light/dark toggle — affects token-aware surfaces; legacy @/theme screens stay dark. */
export function ThemeModeToggle({ compact = false }: ThemeModeToggleProps) {
  const { mode, toggleMode, isPartialLightMode } = useThemeMode();
  const palette = resolveCareSuitePalette(mode);
  const nextLabel = mode === 'dark' ? 'Hell' : 'Dunkel';

  return (
    <Pressable
      onPress={toggleMode}
      style={[
        styles.root,
        compact && styles.compact,
        {
          borderColor: `${palette.brand.cyan}44`,
          backgroundColor: palette.background.elevated,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Designmodus wechseln, aktuell ${mode === 'dark' ? 'dunkel' : 'hell'}`}
    >
      <Text style={[styles.label, { color: palette.text.primary }]}>
        {mode === 'dark' ? '🌙' : '☀️'} {nextLabel}
      </Text>
      {isPartialLightMode && !compact ? (
        <Text style={[styles.hint, { color: palette.text.muted }]}>
          Teilweise — viele Screens noch Dark-Premium
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: careSpacing.xs,
    gap: 2,
  },
  compact: {
    paddingHorizontal: careSpacing.xs,
  },
  label: {
    ...careTypography.label,
    fontSize: 12,
  },
  hint: {
    ...careTypography.caption,
    fontSize: 10,
  },
});
