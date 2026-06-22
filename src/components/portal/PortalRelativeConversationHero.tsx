import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  PRIORITY_LABELS,
  THREAD_STATUS_LABELS,
  THREAD_TYPE_LABELS,
} from '@/features/communication/communication.constants';
import type { CommunicationThread } from '@/features/communication/communication.types';

import { designTokens, spacing } from '@/theme';

type PortalRelativeConversationHeroProps = {
  thread: CommunicationThread;
  messageCount: number;
};

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PortalRelativeConversationHero({
  thread,
  messageCount,
}: PortalRelativeConversationHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.violet,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: { ...typography.h2 },
  meta: { ...typography.caption, color: colors.textMuted },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
}),
    [colors, typography, gradients],
  );


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>ANGEHÖRIGENPORTAL · KONVERSATION</Text>
          <Text style={styles.title}>{thread.title}</Text>
          <Text style={styles.meta}>Geteilte Sicht · nur freigegebene Inhalte</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>👨‍👩‍👧</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={THREAD_TYPE_LABELS[thread.threadType]} variant="cyan" />
        <PremiumBadge label={THREAD_STATUS_LABELS[thread.status]} variant="muted" />
        {thread.priority !== 'normal' ? (
          <PremiumBadge label={PRIORITY_LABELS[thread.priority]} variant="orange" dot />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard
          label="Nachrichten"
          value={String(messageCount)}
          icon="💬"
          accentColor={colors.violet}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Letzte Aktivität"
          value={formatShortDate(thread.lastMessageAt)}
          subValue={thread.lastMessageByDisplayName ?? '—'}
          icon="📅"
          accentColor={colors.cyan}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Status"
          value={THREAD_STATUS_LABELS[thread.status]}
          icon="📨"
          accentColor={colors.orange}
          style={styles.kpiItem}
        />
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

