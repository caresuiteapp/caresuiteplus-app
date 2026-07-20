import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AdaptivePortalDashboard } from '@/components/portal/AdaptivePortalDashboard';
import {
  AssistPortalOverview,
  AssistPortalSectionBlocked,
  AssistPortalSectionView,
} from '@/components/portal/assist';
import { MobilePortalKpiCard } from '@/components/portal/assist/MobilePortalKpiCard';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { EmptyState, ErrorState, LoadingState, PremiumButton, SuccessState } from '@/components/ui';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { SYSTEM_LIQUID_COLORS } from '@/design/tokens/systemLiquidGlass';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalContext } from '@/hooks/usePortalContext';
import {
  ASSIST_PORTAL_MODAL_SECTIONS,
  ASSIST_PORTAL_SECTIONS,
  buildPortalDashboard,
  canAccessPortalFeature,
  resolveCombinedModuleLabel,
  resolvePortalTerminology,
} from '@/lib/portal/engine';
import { resolveClientPortalHeroLines } from '@/lib/portal/clientPortalGreeting';
import {
  PORTAL_MODULE_ICONS,
  PORTAL_MODULE_LABELS,
  isPortalModuleKey,
} from '@/lib/portal/engine/portalModuleKeys';
import type { PortalModuleKey } from '@/lib/portal/types';

type AdaptivePortalOverviewProps = {
  showSuccess?: boolean;
  onRefresh?: () => void;
};

export function AdaptivePortalOverview({ showSuccess, onRefresh }: AdaptivePortalOverviewProps) {
  const router = useRouter();
  const { context, loading, error, refresh } = usePortalContext();
  const params = useLocalSearchParams<{ module?: string; section?: string }>();
  const routeModule = typeof params.module === 'string' && isPortalModuleKey(params.module)
    ? params.module
    : null;
  const routeSection = typeof params.section === 'string' ? params.section : null;
  const [activeModule, setActiveModule] = useState<PortalModuleKey | 'all'>(routeModule ?? 'all');
  const text = useAuroraAdaptiveText();
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  const effectiveModule = activeModule;

  const terminology = useMemo(
    () => resolvePortalTerminology(context?.primaryModule ?? null),
    [context?.primaryModule],
  );

  const widgets = useMemo(() => {
    if (!context?.hasModuleAssignments) return [];
    return buildPortalDashboard(context, {
      activeModuleFilter: effectiveModule === 'all' ? 'all' : effectiveModule,
    });
  }, [context, effectiveModule]);

  const handleRefresh = async () => {
    await refresh();
    onRefresh?.();
  };

  if (loading && !context) {
    return <LoadingState message="Klient:innenportal wird geladen…" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Klient:innenportal nicht geladen"
        message={error}
        onRetry={handleRefresh}
      />
    );
  }

  if (!context) {
    return (
      <EmptyState
        title="Klient:innenportal nicht verfügbar"
        message="Ihre Sitzung konnte nicht aufgelöst werden."
        actionLabel="Erneut laden"
        onAction={handleRefresh}
      />
    );
  }

  if (context.primaryModule === 'assist') {
    if (routeSection) {
      const featureKey = ASSIST_PORTAL_SECTIONS[routeSection];
      if (!featureKey || !canAccessPortalFeature(context, 'assist', featureKey)) {
        return <AssistPortalSectionBlocked section={routeSection} />;
      }
      if (ASSIST_PORTAL_MODAL_SECTIONS.has(routeSection)) {
        return (
          <AssistPortalOverview
            context={context}
            showSuccess={showSuccess}
            onRefresh={handleRefresh}
            initialModal={routeSection as 'anfragen' | 'aktivitaeten'}
          />
        );
      }
      if (routeSection === 'budget') {
        return <Redirect href="/portal/client/budget" />;
      }
      if (routeSection === 'hilfe') {
        return <Redirect href="/portal/client/help" />;
      }
      if (routeSection === 'nachweise') {
        return <Redirect href="/portal/client/proofs" />;
      }
      return <AssistPortalSectionView context={context} section={routeSection} />;
    }

    return (
      <AssistPortalOverview
        context={context}
        showSuccess={showSuccess}
        onRefresh={handleRefresh}
      />
    );
  }

  if (!context.hasModuleAssignments) {
    return (
      <AssistPortalOverview
        context={context}
        showSuccess={showSuccess}
        onRefresh={handleRefresh}
      />
    );
  }

  const moduleTabs = context.activeModuleKeys;
  const heroLines = resolveClientPortalHeroLines({
    displayName: context.displayName,
    tenantName: context.tenantName,
    moduleLabel: terminology.moduleLabel,
  });
  const overviewBody = (
    <>
      {showSuccess ? <SuccessState message="Daten erfolgreich aktualisiert." /> : null}

      {isPhone ? (
        <PortalGlassHero
          title={`${heroLines.greetingLine},`}
          titleSecondary={heroLines.nameLine}
          subtitle={heroLines.providerLine}
          meta={
            context.portalRole === 'family_contact'
              ? `Angehörigenzugang · Portal für ${heroLines.nameLine}`
              : terminology.personLabel
          }
          badge={PORTAL_MODULE_LABELS[context.primaryModule ?? 'assist']}
          showStatusDot
        />
      ) : (
        <GlassCard
          style={{
            backgroundColor: careLightColors.surface,
            borderColor: careLightColors.borderStrong,
          }}
        >
          <Text style={[type.caption, { color: text.muted }]}>KLIENT:INNENPORTAL</Text>
          <Text style={[type.cardTitle, { color: text.primary }]}>
            {terminology.greetingLabel}, {heroLines.nameLine}
          </Text>
          <Text style={[type.body, { color: text.secondary, fontWeight: '600' }]}>
            {context.tenantName}
          </Text>
          <Text style={[type.caption, { color: text.muted }]}>
            {resolveCombinedModuleLabel(context.activeModuleKeys)} ·{' '}
            {terminology.appointmentLabelPlural} und {terminology.careTeamLabel} nach Freigabe
          </Text>
        </GlassCard>
      )}

      {isPhone ? (
        <>
          <Text style={[type.label, { color: text.primary }]}>Wichtig für Sie</Text>
          <View style={styles.priorityGrid}>
            <MobilePortalKpiCard
              icon="📅"
              label={terminology.appointmentLabelPlural}
              value={widgets.find((w) => w.widgetKey.includes('appointment'))?.metricValue ?? null}
              emptyMessage={`Keine ${terminology.appointmentLabelPlural.toLowerCase()} geplant.`}
              ctaLabel={`${terminology.appointmentLabelPlural} öffnen →`}
              accentColor="#7B61FF"
              onCta={() => router.push('/portal/client/appointments' as never)}
              onPress={() => router.push('/portal/client/appointments' as never)}
            />
            <MobilePortalKpiCard
              icon="💬"
              label="Nachrichten"
              value={widgets.find((w) => w.widgetKey.includes('message'))?.metricValue ?? null}
              emptyMessage="Keine neuen Nachrichten."
              ctaLabel="Nachrichten öffnen →"
              accentColor={SYSTEM_LIQUID_COLORS.electricBlue}
              onCta={() => router.push('/portal/client/messages' as never)}
              onPress={() => router.push('/portal/client/messages' as never)}
            />
            <MobilePortalKpiCard
              icon="📄"
              label="Dokumente"
              value={widgets.find((w) => w.widgetKey.includes('document'))?.metricValue ?? null}
              emptyMessage="Keine neuen Dokumente."
              ctaLabel="Dokumente öffnen →"
              accentColor="#22C55E"
              onCta={() => router.push('/portal/client/documents' as never)}
              onPress={() => router.push('/portal/client/documents' as never)}
            />
          </View>
        </>
      ) : null}

      {moduleTabs.length > 1 ? (
        <View style={styles.moduleTabs}>
          <Pressable
            onPress={() => setActiveModule('all')}
            style={[styles.moduleChip, activeModule === 'all' && styles.moduleChipActive]}
          >
            <Text style={[type.caption, { color: text.primary }]}>Alle Module</Text>
          </Pressable>
          {moduleTabs.map((moduleKey) => (
            <Pressable
              key={moduleKey}
              onPress={() => setActiveModule(moduleKey)}
              style={[
                styles.moduleChip,
                activeModule === moduleKey && styles.moduleChipActive,
              ]}
            >
              <Text style={styles.chipIcon}>{PORTAL_MODULE_ICONS[moduleKey]}</Text>
              <Text style={[type.caption, { color: text.primary }]}>
                {PORTAL_MODULE_LABELS[moduleKey]}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <AdaptivePortalDashboard widgets={widgets} />

      <PremiumButton title="Aktualisieren" variant="secondary" onPress={handleRefresh} fullWidth />
    </>
  );

  if (isPhone) {
    return <View style={styles.container}>{overviewBody}</View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {overviewBody}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.md,
    paddingBottom: careSpacing.lg,
  },
  moduleTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
  },
  moduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: careSpacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: careLightColors.borderStrong,
    backgroundColor: careLightColors.surface,
  },
  moduleChipActive: {
    borderColor: 'rgba(255,149,0,0.45)',
    backgroundColor: 'rgba(255,149,0,0.12)',
  },
  chipIcon: {
    fontSize: 14,
  },
  priorityGrid: {
    gap: careSpacing.sm,
  },
});
