import { StyleSheet, Text, View } from 'react-native';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

/** Section title block for forms and module lists. */
export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <View style={styles.root}>
      <Text style={[type.h2, styles.title]} numberOfLines={2} {...noBreakTextProps}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[type.body, styles.subtitle]} numberOfLines={3} {...noBreakTextProps}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: careSpacing.xs,
    minWidth: 0,
    marginBottom: careSpacing.sm,
  },
  title: {
    flexShrink: 1,
    minWidth: 0,
  },
  subtitle: {
    flexShrink: 1,
    minWidth: 0,
    color: galaxyPalette.textSecondary,
  },
});
