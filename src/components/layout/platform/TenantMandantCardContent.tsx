import { useState } from 'react';
import { Image, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { CareSuiteLogo } from '@/components/brand';
import { withAlpha } from '@/design/tokens/motion';
import { spacing, typography } from '@/theme';

const LOGO_MAX_HEIGHT = 96;

type TenantMandantCardContentProps = {
  logoUrl?: string;
  accentColor: string;
  labelStyle?: TextStyle;
  chipTextStyle?: TextStyle;
  style?: ViewStyle;
};

export function TenantMandantCardContent({
  logoUrl,
  accentColor,
  labelStyle,
  chipTextStyle,
  style,
}: TenantMandantCardContentProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const trimmedLogo = logoUrl?.trim() ?? '';
  const showRemoteLogo = trimmedLogo.length > 0 && !logoFailed;

  return (
    <View style={[styles.root, style]}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, labelStyle]}>MANDANT</Text>
        <View style={[styles.liveChip, { borderColor: withAlpha(accentColor, 0.45) }]}>
          <Text style={[styles.liveChipText, { color: accentColor }, chipTextStyle]}>● Live</Text>
        </View>
      </View>

      <View style={styles.logoWrap}>
        {showRemoteLogo ? (
          <Image
            source={{ uri: trimmedLogo }}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Mandant Logo"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <CareSuiteLogo size="xl" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  liveChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  liveChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoWrap: {
    width: '100%',
    height: LOGO_MAX_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '100%',
    height: LOGO_MAX_HEIGHT,
    backgroundColor: 'transparent',
  },
});
