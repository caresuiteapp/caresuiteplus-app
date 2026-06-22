import { useMemo } from 'react';
import { useLegacyTheme, type LegacyColors } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';

import type { PortalScope } from '@/types/portal';
import { designTokens, spacing } from '@/theme';

export type PortalTabKind = 'messages' | 'documents' | 'appointments';

type TabConfig = {
  title: string;
  icon: string;
  subtitle: string;
};

type ScopeConfig = {
  eyebrow: string;
  accent: string;
  tabs: Record<PortalTabKind, TabConfig>;
};

const SCOPE_CONFIG = (colors: LegacyColors): Record<'portal_employee' | 'portal_client' | 'portal_family', ScopeConfig> => ({
  portal_employee: {
    eyebrow: 'MITARBEITERPORTAL',
    accent: colors.orange,
    tabs: {
      messages: {
        title: 'Nachrichten',
        icon: '✉️',
        subtitle: 'Mitteilungen vom Büro und Team — nach Portal-Freigabe.',
      },
      documents: {
        title: 'Dokumente',
        icon: '📄',
        subtitle: 'Freigegebene Unterlagen und Formulare für Ihre Einsätze.',
      },
      appointments: {
        title: 'Einsätze',
        icon: '📅',
        subtitle: 'Geplante Einsätze und Termine in Ihrer Sicht.',
      },
    },
  },
  portal_client: {
    eyebrow: 'KLIENT:INNENPORTAL',
    accent: colors.cyan,
    tabs: {
      messages: {
        title: 'Nachrichten',
        icon: '✉️',
        subtitle: 'Chat mit der Verwaltung — Antworten nach Freigabe sichtbar.',
      },
      documents: {
        title: 'Dokumente',
        icon: '📄',
        subtitle: 'Freigegebene Dokumente und Nachweise für Sie.',
      },
      appointments: {
        title: 'Termine',
        icon: '📅',
        subtitle: 'Anstehende Termine und Besuche in Ihrer Übersicht.',
      },
    },
  },
  portal_family: {
    eyebrow: 'ANGEHÖRIGENPORTAL',
    accent: colors.violet,
    tabs: {
      messages: {
        title: 'Nachrichten',
        icon: '✉️',
        subtitle: 'Mitteilungen zum Pflegefall — nur freigegebene Inhalte sichtbar.',
      },
      documents: {
        title: 'Dokumente',
        icon: '📄',
        subtitle: 'Freigegebene Unterlagen für Angehörige — nach Sichtbarkeitsregeln.',
      },
      appointments: {
        title: 'Termine',
        icon: '📅',
        subtitle: 'Termine und Besuche im Pflegefall — geteilte Sicht.',
      },
    },
  },
});

export type PortalTabHeroProps = {
  tab: PortalTabKind;
  scope: PortalScope;
  totalCount: number;
  unreadCount?: number;
  activeCount?: number;
  restrictedCount?: number;
  /** Überschreibt den Tab-Titel (z. B. „Einsätze“ vs. „Termine“) */
  titleOverride?: string;
};

function resolveScope(scope: PortalScope): 'portal_employee' | 'portal_client' | 'portal_family' {
  if (scope === 'portal_family') return 'portal_family';
  return scope === 'portal_client' ? 'portal_client' : 'portal_employee';
}

export function PortalTabHero({
  tab,
  scope,
  totalCount,
  unreadCount = 0,
  activeCount = 0,
  restrictedCount = 0,
  titleOverride,
}: PortalTabHeroProps) {
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
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
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


  const scopeKey = resolveScope(scope);
  const scopeConfig = SCOPE_CONFIG(colors)[scopeKey];
  const tabConfig = scopeConfig.tabs[tab];
  const title = titleOverride ?? tabConfig.title;

  const kpis =
    tab === 'messages'
      ? [
          { id: 'unread', label: 'Ungelesen', value: String(unreadCount), icon: '📬', accent: scopeConfig.accent },
          { id: 'total', label: 'Gesamt', value: String(totalCount), icon: '✉️', accent: colors.textMuted },
        ]
      : tab === 'documents'
        ? [
            { id: 'total', label: 'Dokumente', value: String(totalCount), icon: '📄', accent: scopeConfig.accent },
            {
              id: 'restricted',
              label: 'Eingeschränkt',
              value: String(restrictedCount),
              icon: '🔒',
              accent: colors.warning,
            },
          ]
        : [
            { id: 'active', label: 'Aktiv', value: String(activeCount), icon: '✅', accent: colors.success },
            { id: 'total', label: 'Gesamt', value: String(totalCount), icon: '📅', accent: scopeConfig.accent },
          ];

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={[styles.eyebrow, { color: scopeConfig.accent }]}>{scopeConfig.eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>
            {totalCount} {totalCount === 1 ? 'Eintrag' : 'Einträge'} · Portal-Sicht
          </Text>
          <Text style={styles.subtitle}>{tabConfig.subtitle}</Text>
        </View>
        <View style={[styles.iconBadge, { borderColor: `${scopeConfig.accent}55` }]}>
          <Text style={styles.iconText}>{tabConfig.icon}</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Portal-Sicht" variant="cyan" />
        {scopeKey === 'portal_family' ? (
          <PremiumBadge label="Geteilte Sicht" variant="muted" />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            accentColor={kpi.accent}
            style={styles.kpiItem}
          />
        ))}
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

