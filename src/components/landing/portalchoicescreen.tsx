import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdaptiveCardGrid } from '@/components/adaptive';
import { CareSuiteIcon } from '@/components/brand/CareSuiteIcon';
import type { AppStartEntry } from '@/data/landing/appStartEntries';
import { GlassCard } from '@/design/components';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type PortalChoiceScreenProps = {
  entries: AppStartEntry[];
};

/** Public portal entry cards — glass cards with icon containers. */
export function PortalChoiceScreen({ entries }: PortalChoiceScreenProps) {
  const router = useRouter();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  if (entries.length === 0) {
    return null;
  }

  return (
    <AdaptiveCardGrid>
      {entries.map((entry) => (
        <GlassCard
          key={entry.path}
          accentColor={entry.accentColor}
          onPress={() => router.push(entry.path as never)}
        >
          <View style={styles.cardInner}>
            <CareSuiteIcon
              iconKey={entry.iconKey}
              accentColor={entry.accentColor}
              size={52}
              variant="aurora"
            />
            <Text style={[type.cardTitle, styles.cardTitle]} numberOfLines={2}>
              {entry.label}
            </Text>
            <Text style={[type.caption, styles.cardDescription]} numberOfLines={3}>
              {entry.description}
            </Text>
          </View>
        </GlassCard>
      ))}
    </AdaptiveCardGrid>
  );
}

const styles = StyleSheet.create({
  cardInner: {
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  cardTitle: {
    marginTop: careSpacing.xs,
    marginBottom: careSpacing.xs,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  cardDescription: { flexShrink: 1, minWidth: 0, textAlign: 'center' },
});
