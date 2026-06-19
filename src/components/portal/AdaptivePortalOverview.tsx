import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdaptivePortalDashboard } from '@/components/portal/AdaptivePortalDashboard';
import { AssistPortalOverview } from '@/components/portal/assist';
import { EmptyState, ErrorState, LoadingState, PremiumButton, SuccessState } from '@/components/ui';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText, useAuroraGlassCardStyle } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalContext } from '@/hooks/usePortalContext';
import {
  buildPortalDashboard,
  resolveCombinedModuleLabel,
  resolvePortalTerminology,
} from '@/lib/portal/engine';
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
  const { context, loading, error, refresh, isReady } = usePortalContext();
  const params = useLocalSearchParams<{ module?: string }>();
  const routeModule = typeof params.module === 'string' && isPortalModuleKey(params.module)
    ? params.module
    : null;
  const [activeModule, setActiveModule] = useState<PortalModuleKey | 'all'>(routeModule ?? 'all');
  const text = useAuroraAdaptiveText();
  const heroStyle = useAuroraGlassCardStyle();
  const { width } = useDeviceClass();
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

  if (loading || !isReady) {
    return <LoadingState message="Portal wird geladen…" />;
  }

  if (error) {
    return <ErrorState title="Portal nicht verfügbar" message={error} onRetry={handleRefresh} />;
  }

  if (!context) {
    return (
      <EmptyState
        title="Portal nicht verfügbar"
        message="Ihre Sitzung konnte nicht aufgelöst werden."
        actionLabel="Erneut laden"
        onAction={handleRefresh}
      />
    );
  }

  if (context.primaryModule === 'assist') {
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
      <View style={styles.container}>
        {showSuccess ? <SuccessState message="Daten erfolgreich aktualisiert." /> : null}
        <GlassCard style={heroStyle}>
          <Text style={[type.caption, { color: text.muted }]}>KLIENT:INNENPORTAL</Text>
          <Text style={[type.cardTitle, { color: text.primary }]}>
            Hallo, {context.displayName}
          </Text>
          <Text style={[type.body, { color: text.secondary }]}>
            {context.tenantName}
          </Text>
        </GlassCard>
        <EmptyState
          title="Portal noch nicht eingerichtet"
          message="Für Ihr Profil wurden noch keine Module zugewiesen. Bitte wenden Sie sich an Ihr Pflegebüro — dort können Assist, Pflege, Stationär oder Beratung freigeschaltet werden."
          actionLabel="Erneut prüfen"
          onAction={handleRefresh}
        />
      </View>
    );
  }

  const moduleTabs = context.activeModuleKeys;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {showSuccess ? <SuccessState message="Daten erfolgreich aktualisiert." /> : null}

      <GlassCard style={heroStyle}>
        <Text style={[type.caption, { color: text.muted }]}>KLIENT:INNENPORTAL</Text>
        <Text style={[type.cardTitle, { color: text.primary }]}>
          {terminology.greetingLabel}, {context.displayName}
        </Text>
        <Text style={[type.body, { color: text.secondary, fontWeight: '600' }]}>
          {context.tenantName}
        </Text>
        <Text style={[type.caption, { color: text.muted }]}>
          {resolveCombinedModuleLabel(context.activeModuleKeys)} ·{' '}
          {terminology.appointmentLabelPlural} und {terminology.careTeamLabel} nach Freigabe
        </Text>
      </GlassCard>

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
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  moduleChipActive: {
    borderColor: 'rgba(255,149,0,0.45)',
    backgroundColor: 'rgba(255,149,0,0.12)',
  },
  chipIcon: {
    fontSize: 14,
  },
});
