import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';

import type { MessageDetail } from '@/types/portal/communication';
import { VISIBILITY_LABELS } from '@/types/portal/visibility';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type PortalMessageDetailHeroProps = {
  message: MessageDetail;
  scope: 'client' | 'employee' | 'family';
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function statusVariant(status: string) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function PortalMessageDetailHero({ message, scope }: PortalMessageDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
  },
  meta: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(98,243,255,0.35)',
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiItem: {
    flex: 1,
    minWidth: 100,
  },
}),
    [colors, typography, gradients],
  );


  const scopeLabel =
    scope === 'client'
      ? 'KLIENT:INNENPORTAL'
      : scope === 'family'
        ? 'ANGEHÖRIGENPORTAL'
        : 'MITARBEITERPORTAL';
  const isUnread = !message.readAt;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>{scopeLabel} · NACHRICHT</Text>
          <Text style={styles.title}>{message.subject}</Text>
          <Text style={styles.meta}>Von {message.senderName}</Text>
          <Text style={styles.subtitle}>An {message.recipientName}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>✉️</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[message.status]}
          variant={statusVariant(message.status)}
          dot
        />
        <PremiumBadge label={VISIBILITY_LABELS[message.visibility]} variant="muted" />
        {isUnread ? <PremiumBadge label="Ungelesen" variant="orange" dot /> : null}
        {message.canReply ? <PremiumBadge label="Antwort möglich" variant="green" /> : null}
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard
          label="Gesendet"
          value={formatShortDate(message.updatedAt)}
          subValue={formatTime(message.updatedAt)}
          icon="📅"
          accentColor={colors.cyan}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Von"
          value={message.senderName}
          icon="👤"
          accentColor={colors.orange}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="An"
          value={message.recipientName}
          icon="📨"
          accentColor={colors.violet}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Gelesen"
          value={message.readAt ? formatShortDate(message.readAt) : '—'}
          subValue={message.readAt ? formatTime(message.readAt) : 'Noch nicht gelesen'}
          icon="👁️"
          accentColor={isUnread ? colors.amber : colors.success}
          style={styles.kpiItem}
        />
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

