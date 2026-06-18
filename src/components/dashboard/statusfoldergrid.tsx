import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PremiumBadge } from '@/components/ui';
import { GlowCard } from '@/components/ui/effects';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { accentCover, accentCycle } from '@/design/tokens/motion';
import type { DashboardSnapshot } from '@/types/dashboard';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { SENSITIVITY_LABELS } from '@/types/portal/visibility';
import { spacing } from '@/theme';

type StatusCard = DashboardSnapshot['statusCards'][number];

/** A single glowing "folder" card with a gradient cover + glass body. */
export function StatusFolderCard({ card, accent }: { card: StatusCard; accent: string }) {
  const { colors, typography } = useLegacyTheme();
  return (
    <GlowCard glowColor={accent} glowOpacity={0.14} contentStyle={styles.noPad} style={styles.card}>
      <View style={styles.cover}>
        <LinearGradient
          colors={accentCover(accent)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.coverDot, { backgroundColor: accent }]} />
        {card.count !== undefined ? <Text style={styles.coverCount}>{card.count}</Text> : null}
      </View>
      <View style={styles.cardBody}>
        <Text
          style={[styles.cardTitle, typography.bodyStrong, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          {card.title}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={3}>
          {card.description}
        </Text>
        <View style={styles.badges}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[card.status]}
            variant={
              card.status === 'fehlerhaft'
                ? 'red'
                : card.status === 'abgeschlossen'
                  ? 'green'
                  : 'orange'
            }
            dot
          />
          {card.sensitivity ? (
            <PremiumBadge label={SENSITIVITY_LABELS[card.sensitivity]} variant="cyan" />
          ) : null}
        </View>
      </View>
    </GlowCard>
  );
}

/** Responsive grid of glowing status "folder" cards (dark web experience). */
export function StatusFolderGrid({ cards }: { cards: StatusCard[] }) {
  return (
    <View style={styles.grid}>
      {cards.map((card, index) => (
        <StatusFolderCard key={card.id} card={card} accent={accentCycle[index % accentCycle.length]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { flexGrow: 1, flexBasis: 240, minWidth: 220 },
  noPad: { padding: 0 },
  cover: { height: 64, justifyContent: 'center', paddingHorizontal: 16, overflow: 'hidden' },
  coverDot: { width: 12, height: 12, borderRadius: 6 },
  coverCount: { position: 'absolute', right: 16, fontSize: 30, fontWeight: '800', color: '#FFFFFF' },
  cardBody: { padding: 16, gap: 6 },
  cardTitle: { fontSize: 15 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
});
