import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '@/components/ui';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';
import { CareSuiteIcon } from './CareSuiteIcon';

type CareBotCardProps = {
  onPress?: () => void;
  compact?: boolean;
};

export function CareBotCard({ onPress, compact = false }: CareBotCardProps) {
  const { colors, typography } = useLegacyTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        compact: {
          maxWidth: 360,
        },
        row: {
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'flex-start',
        },
        text: {
          flex: 1,
          gap: spacing.xs,
        },
        title: {
          ...typography.bodyStrong,
          color: colors.cyan,
        },
        body: {
          ...typography.caption,
          color: colors.textSecondary,
        },
      }),
    [colors.cyan, colors.textSecondary, typography.bodyStrong, typography.caption],
  );

  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button">
      <PremiumCard accentColor={colors.cyan} sheen style={compact ? styles.compact : undefined}>
        <View style={styles.row}>
          <CareSuiteIcon emoji="🤖" accentColor={colors.cyan} size={compact ? 36 : 44} />
          <View style={styles.text}>
            <Text style={styles.title}>CareBot</Text>
            <Text style={styles.body} numberOfLines={compact ? 2 : 3}>
              Assistent für Pflege, Planung und Dokumentation — kontextbezogen in jedem Modul.
            </Text>
          </View>
        </View>
      </PremiumCard>
    </Pressable>
  );
}
