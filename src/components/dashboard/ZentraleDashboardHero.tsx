import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CareSuiteWordmark } from '@/components/brand/CareSuiteWordmark';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

type ZentraleDashboardHeroProps = {
  greeting: string;
  displayName: string;
  tenantName: string;
  subtitle?: string;
};

/** Centered aurora hero for Zentrale / business hub — white wordmark and greeting. */
export function ZentraleDashboardHero({
  greeting,
  displayName,
  tenantName,
  subtitle = 'Zentrale · Mandantenübersicht',
}: ZentraleDashboardHeroProps) {
  const text = useAuroraAdaptiveText();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          alignItems: 'center',
          gap: careSpacing.sm,
          paddingVertical: careSpacing.md,
        },
        wordmark: {
          justifyContent: 'center',
        },
        greeting: {
          ...careTypography.h2,
          fontSize: 26,
          fontWeight: '700',
          color: '#F9FAFB',
          textAlign: 'center',
        },
        tenant: {
          ...careTypography.bodyStrong,
          fontSize: 17,
          color: text.primary,
          textAlign: 'center',
        },
        subtitle: {
          ...careTypography.caption,
          color: text.muted,
          textAlign: 'center',
        },
      }),
    [text.muted, text.primary],
  );

  return (
    <View style={styles.root}>
      <CareSuiteWordmark size="nav" variant="aurora" style={styles.wordmark} />
      <Text style={styles.greeting}>
        {greeting}, {displayName}
      </Text>
      <Text style={styles.tenant}>{tenantName}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}
