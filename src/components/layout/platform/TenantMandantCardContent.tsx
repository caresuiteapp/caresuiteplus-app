import { useState } from 'react';
import { Image, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { CareSuiteLogo } from '@/components/brand';
import { withAlpha } from '@/design/tokens/motion';
import { spacing, typography } from '@/theme';

const LOGO_SIZE = 44;

type TenantMandantCardContentProps = {
  tenantName: string;
  logoUrl?: string;
  accentColor: string;
  nameStyle?: TextStyle;
  chipTextStyle?: TextStyle;
  style?: ViewStyle;
};

export function TenantMandantCardContent({
  tenantName,
  logoUrl,
  accentColor,
  nameStyle,
  chipTextStyle,
  style,
}: TenantMandantCardContentProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const trimmedLogo = logoUrl?.trim() ?? '';
  const showRemoteLogo = trimmedLogo.length > 0 && !logoFailed;

  return (
    <View style={[styles.row, style]}>
      <View style={styles.logoWrap}>
        {showRemoteLogo ? (
          <Image
            source={{ uri: trimmedLogo }}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel={`${tenantName} Logo`}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <CareSuiteLogo size="sm" />
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.tenantName, nameStyle]} numberOfLines={2}>
            {tenantName}
          </Text>
          <View style={[styles.liveChip, { borderColor: withAlpha(accentColor, 0.45) }]}>
            <Text style={[styles.liveChipText, { color: accentColor }, chipTextStyle]}>● Live</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    backgroundColor: 'transparent',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tenantName: {
    ...typography.bodyStrong,
    fontWeight: '700',
    flexShrink: 1,
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
});
