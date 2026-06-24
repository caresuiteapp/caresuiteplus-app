import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { CareSuiteBrandHeader } from '@/components/brand/CareSuiteBrandHeader';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { type CareModuleKey } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

type CareLightModuleHeaderProps = {
  moduleKey: CareModuleKey;
  subtitle?: string;
  style?: ViewStyle;
};

export function CareLightModuleHeader({ moduleKey, subtitle, style }: CareLightModuleHeaderProps) {
  const { c } = useCareLightPalette();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: careSpacing.xs,
        },
        eyebrow: {
          ...careTypography.caption,
          color: c.muted,
          letterSpacing: 1.2,
          fontWeight: '700',
        },
      }),
    [c.muted],
  );

  const moduleTitles: Record<CareModuleKey, string> = {
    office: 'CareSuite+ Office',
    assist: 'CareSuite+ Assist',
    pflege: 'CareSuite+ Pflege',
    beratung: 'CareSuite+ Beratung',
    stationaer: 'Stationär',
    akademie: 'Akademie',
    qm: 'Qualitätsmanagement',
    insight: 'Insight',
  };

  return (
    <View style={[styles.root, style]}>
      <CareSuiteBrandHeader
        moduleKey={moduleKey}
        title={moduleTitles[moduleKey]}
        subtitle={subtitle}
      />
    </View>
  );
}
