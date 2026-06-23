import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  ModuleTile,
  PremiumKpiCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchPrivacyComplianceDashboard,
  PRIVACY_COMPLIANCE_ROUTE,
} from '@/lib/privacy/privacyManagementService';
import type { PrivacyManagementAreaKey } from '@/types/modules/privacyManagement';
import { PRIVACY_MANAGEMENT_AREA_LABELS } from '@/types/modules/privacyManagement';
import { spacing, typography, colors } from '@/theme';

const AREA_ROUTES: Partial<Record<PrivacyManagementAreaKey, string>> = {
  data_subject_requests: '/business/security/data-requests',
};

const COMPLIANCE_EXTRA_LINKS = [
  {
    key: 'time_tracking_audit',
    label: 'Arbeitszeit-Audit',
    route: '/business/office/time-tracking/audit',
    icon: '⏱️',
    permission: 'time.audit.view' as const,
  },
];

const AREA_ICONS: Record<PrivacyManagementAreaKey, string> = {
  processing_activities: '📋',
  toms: '🔒',
  dpa: '📝',
  data_subject_requests: '✉️',
  access_requests: '🔍',
  correction_requests: '✏️',
  deletion_requests: '🗑️',
  data_export: '📤',
  consents: '✅',
  retention_rules: '⏱️',
  incidents: '⚠️',
};

const AREA_KEYS = Object.keys(PRIVACY_MANAGEMENT_AREA_LABELS) as PrivacyManagementAreaKey[];

export function PrivacyComplianceHubScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    useCallback(
      () => fetchPrivacyComplianceDashboard(tenantId ?? '', roleKey),
      [tenantId, roleKey],
    ),
    [tenantId, roleKey],
  );

  if (!can('security.view')) {
    return (
      <ScreenShell title="Datenschutz & Compliance" subtitle="Mehr → Datenschutz & Compliance">
        <LockedActionBanner
          message={check('security.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Datenschutz & Compliance" subtitle="Mehr → Datenschutz & Compliance">
        <LoadingState message="Datenschutz-Dashboard wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Datenschutz & Compliance" subtitle="Mehr → Datenschutz & Compliance">
        <ErrorState title="Datenschutz" message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const dashboard = query.data!;

  return (
    <ScreenShell
      title="Datenschutz & Compliance"
      subtitle="Mehr → Datenschutz & Compliance"
      scroll
    >
      <SectionPanel title="Übersicht" subtitle="DSGVO-Management — 11 Bereiche">
        <View style={styles.kpiRow}>
          <PremiumKpiCard label="Offene Anfragen" value={String(dashboard.openRequestsCount)} />
          <PremiumKpiCard label="Überfällig" value={String(dashboard.overdueRequestsCount)} />
          <PremiumKpiCard label="Löschprüfungen" value={String(dashboard.pendingDeletionReviews)} />
        </View>
      </SectionPanel>

      <SectionPanel title="Bereiche" subtitle="Verarbeitung, Betroffenenrechte, Löschfristen">
        <View style={styles.tileGrid}>
          {AREA_KEYS.map((key) => {
            const route = AREA_ROUTES[key];
            const prepared = key === 'incidents';
            return (
              <ModuleTile
                key={key}
                icon={AREA_ICONS[key]}
                title={PRIVACY_MANAGEMENT_AREA_LABELS[key]}
                description={prepared ? 'Meldeprozess vorbereitet' : 'DSGVO-Bereich'}
                accentColor={colors.primary}
                preparedOnly={prepared}
                isNavigable={Boolean(route)}
                onPress={route ? () => router.push(route as never) : undefined}
              />
            );
          })}
          {COMPLIANCE_EXTRA_LINKS.filter((link) => can(link.permission)).map((link) => (
            <ModuleTile
              key={link.key}
              icon={link.icon}
              title={link.label}
              description="Homeoffice-Arbeitszeit — Metadaten-Audit"
              accentColor={colors.primary}
              onPress={() => router.push(link.route as never)}
            />
          ))}
        </View>
      </SectionPanel>

      {!can('security.manage') ? (
        <Text style={styles.hint}>Verwaltung erfordert Berechtigung „Security & DSGVO verwalten“.</Text>
      ) : null}

      <Text style={styles.routeHint}>Route: {PRIVACY_COMPLIANCE_ROUTE}</Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.md,
    opacity: 0.7,
  },
  routeHint: {
    ...typography.caption,
    marginTop: spacing.sm,
    opacity: 0.5,
  },
});
