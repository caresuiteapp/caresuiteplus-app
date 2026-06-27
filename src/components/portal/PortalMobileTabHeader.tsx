import { StyleSheet, Text, View } from 'react-native';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type PortalMobileTabHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
};

/** Centered page title for portal tabs on phone — avoids asymmetric ScreenHeader offset. */
export function PortalMobileTabHeader({ title, subtitle, eyebrow }: PortalMobileTabHeaderProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <View style={styles.root} testID="portal-mobile-tab-header">
      {eyebrow ? (
        <Text style={[type.eyebrow, styles.eyebrow, { color: text.muted }]} {...noBreakTextProps}>
          {eyebrow}
        </Text>
      ) : null}
      <Text style={[type.h2, styles.title, { color: text.primary }]} {...noBreakTextProps}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[type.body, styles.subtitle, { color: text.secondary }]} {...noBreakTextProps}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignItems: 'center',
    gap: careSpacing.xs,
    paddingBottom: careSpacing.sm,
  },
  eyebrow: {
    textAlign: 'center',
  },
  title: {
    textAlign: 'center',
    fontWeight: '800',
  },
  subtitle: {
    textAlign: 'center',
    fontWeight: '600',
    maxWidth: 320,
  },
});
