import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { CareSuiteLogo } from '@/components/brand';
import { SpaceMandantIcon } from '@/components/icons/space';
import { withAlpha } from '@/design/tokens/motion';
import { spacing, typography } from '@/theme';

const LOGO_MAX_HEIGHT = 96;

type TenantMandantCardContentProps = {
  logoUrl?: string;
  logoLoading?: boolean;
  accentColor: string;
  labelStyle?: TextStyle;
  chipTextStyle?: TextStyle;
  style?: ViewStyle;
};

export function TenantMandantCardContent({
  logoUrl,
  logoLoading = false,
  accentColor,
  labelStyle,
  chipTextStyle,
  style,
}: TenantMandantCardContentProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const trimmedLogo = logoUrl?.trim() ?? '';

  useEffect(() => {
    setLogoFailed(false);
  }, [trimmedLogo]);

  const showRemoteLogo = trimmedLogo.length > 0 && !logoFailed;
  const showFallbackLogo = !logoLoading && !showRemoteLogo;

  return (
    <View style={[styles.root, style]}>
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <SpaceMandantIcon accentColor={accentColor} size={22} />
          <Text style={[styles.label, labelStyle]}>MANDANT</Text>
        </View>
        <View style={[styles.liveChip, { borderColor: withAlpha(accentColor, 0.45) }]}>
          <Text style={[styles.liveChipText, { color: accentColor }, chipTextStyle]}>● Live</Text>
        </View>
      </View>

      <View style={styles.logoWrap}>
        {showRemoteLogo ? (
          <Image
            source={{ uri: trimmedLogo }}
            style={styles.logo as unknown as import('react-native').ImageStyle}
            resizeMode="contain"
            accessibilityLabel="Mandant Logo"
            onError={() => setLogoFailed(true)}
          />
        ) : showFallbackLogo ? (
          <CareSuiteLogo size="xl" />
        ) : null}
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    ...(Platform.OS === 'web'
      ? ({ filter: 'contrast(1.14) saturate(1.06)' } as ViewStyle)
      : null),
  },
  logo: {
    width: '100%',
    height: LOGO_MAX_HEIGHT,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({ filter: 'drop-shadow(0 1px 3px rgba(10,25,55,0.16))' } as ViewStyle)
      : null),
  },
});
