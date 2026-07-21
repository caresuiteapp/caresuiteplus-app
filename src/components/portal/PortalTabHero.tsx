import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useLightLiquidGlassShell } from '@/design/tokens/auroraGlass';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { PortalTabGlassHero } from '@/components/portal/PortalTabGlassHero';
import { resolvePortalTabHeroContent } from '@/components/portal/portalTabHeroContent';
import {
  SpatialPortalMetric,
  SpatialPortalSection,
} from '@/components/portal/SpatialPortalSurface';
import { spatialCareColors } from '@/design/tokens/spatialCareSuite';

import type { PortalScope } from '@/types/portal';
import { designTokens, spacing } from '@/theme';

export type PortalTabKind = 'messages' | 'documents' | 'appointments' | 'signatures';

export type PortalTabHeroProps = {
  tab: PortalTabKind;
  scope: PortalScope;
  totalCount: number;
  unreadCount?: number;
  activeCount?: number;
  restrictedCount?: number;
  /** Überschreibt den Tab-Titel (z. B. modulspezifische Einsatz-Labels) */
  titleOverride?: string;
};

function resolveScope(scope: PortalScope): 'portal_employee' | 'portal_client' | 'portal_family' {
  if (scope === 'portal_family') return 'portal_family';
  return scope === 'portal_client' ? 'portal_client' : 'portal_employee';
}

function PortalTabHeroLegacy(props: PortalTabHeroProps) {
  const { colors } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const { tab, scope, totalCount } = props;
  const { title, subtitle, kpis } = resolvePortalTabHeroContent(props, colors);
  const scopeKey = resolveScope(scope);
  const tabIcons: Record<PortalTabKind, string> = {
    messages: '✉️',
    documents: '📄',
    appointments: '📅',
    signatures: '✍️',
  };

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
        title: heroText.title,
        meta: heroText.meta,
        subtitle: heroText.subtitle,
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
    [colors, heroText],
  );

  const accent =
    scopeKey === 'portal_client'
      ? colors.cyan
      : scopeKey === 'portal_family'
        ? colors.violet
        : colors.orange;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>
            {totalCount} {totalCount === 1 ? 'Eintrag' : 'Einträge'}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={[styles.iconBadge, { borderColor: `${accent}55` }]}>
          <Text style={styles.iconText}>{tabIcons[tab]}</Text>
        </View>
      </View>
      <View style={styles.badges}>
        {scopeKey === 'portal_family' ? <PremiumBadge label="Geteilte Sicht" variant="muted" /> : null}
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={String(kpi.numericValue ?? 0)}
            icon={kpi.icon}
            accentColor={kpi.accentColor ?? accent}
            style={styles.kpiItem}
          />
        ))}
      </View>
    </PremiumListHeroFrame>
  );
}

/**
 * Employee portal hero using the same spatial section hierarchy on every tab.
 * This deliberately bypasses the legacy light/dark theme branch so messages,
 * documents, appointments and signatures cannot drift into different worlds.
 */
function PortalTabHeroSpatial(props: PortalTabHeroProps) {
  const { colors } = useLegacyTheme();
  const { title, subtitle, meta, kpis } = resolvePortalTabHeroContent(props, colors);

  return (
    <SpatialPortalSection
      title={title}
      subtitle={`${meta} · ${subtitle}`}
      accentColor={spatialCareColors.cyanLight}
    >
      <View style={stylesSpatial.metrics}>
        {kpis.map((kpi) => (
          <SpatialPortalMetric
            key={kpi.id}
            label={kpi.label}
            value={String(kpi.numericValue ?? 0)}
            subValue={kpi.numericValue ? kpi.subValue : kpi.fallbackLabel}
            icon={kpi.icon}
            accentColor={kpi.accentColor ?? spatialCareColors.cyanLight}
          />
        ))}
      </View>
    </SpatialPortalSection>
  );
}

export function PortalTabHero(props: PortalTabHeroProps) {
  const useLightGlass = useLightLiquidGlassShell();
  if (props.scope === 'portal_employee') {
    return <PortalTabHeroSpatial {...props} />;
  }
  const useGlassHero =
    useLightGlass || props.scope === 'portal_client' || props.scope === 'portal_family';
  if (useGlassHero) {
    return <PortalTabGlassHero {...props} />;
  }
  return <PortalTabHeroLegacy {...props} />;
}

const iconSize = designTokens.hero.iconBadgeSize;

const stylesSpatial = StyleSheet.create({
  metrics: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
