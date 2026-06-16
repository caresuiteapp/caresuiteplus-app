import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import type { DataSubjectRequestAdminKpi } from '@/hooks/useDataSubjectRequestsAdmin';
import { ROLE_LABELS } from '@/data/demo';
import { isDataSubjectRequestBackendReady } from '@/lib/privacy/dataRequestConfig';
import { isDataSubjectRequestAdminNotifyInvokable } from '@/lib/privacy/dataSubjectRequestAdminNotify';
import { DSGVO_ART12_RESPONSE_DAYS } from '@/lib/privacy/dataSubjectRequestSla';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import { spacing } from '@/theme';

type DataSubjectRequestsAdminHeroProps = {
  kpis: DataSubjectRequestAdminKpi[];
  totalCount: number;
  roleKey: RoleKey;
  canManage?: boolean;
  exportLiveReady?: boolean;
  onExport?: () => void;
  exporting?: boolean;
};

export function DataSubjectRequestsAdminHero({
  kpis,
  totalCount,
  roleKey,
  canManage = false,
  exportLiveReady = false,
  onExport,
  exporting = false,
}: DataSubjectRequestsAdminHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionsCol: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: 1,
  },
  title: {
    ...typography.h2,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,149,0,0.35)',
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
}),
    [colors, typography, gradients],
  );


  const liveReady = isDataSubjectRequestBackendReady();
  const modeLabel = canManage ? 'Status bearbeiten' : 'Nur-Lese-Ansicht';

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>DSGVO · BETROFFENENRECHTE</Text>
          <Text style={styles.title}>Anfragen-Übersicht</Text>
          <Text style={styles.meta}>
            {totalCount} Anfrage{totalCount === 1 ? '' : 'n'} · {modeLabel} · Frist {DSGVO_ART12_RESPONSE_DAYS} T.
          </Text>
        </View>
        <View style={styles.actionsCol}>
          {onExport ? (
            <PremiumButton
              title={exporting ? 'Export…' : 'CSV-Export'}
              size="sm"
              variant="ghost"
              onPress={onExport}
              disabled={exporting}
            />
          ) : null}
          <View style={styles.iconBadge}>
            <Text style={styles.iconText}>🔒</Text>
          </View>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {!liveReady ? <PremiumBadge label="Live folgt" variant="cyan" /> : null}
        {exportLiveReady ? (
          <PremiumBadge label="CSV-Export Live" variant="green" />
        ) : (
          <PremiumBadge label="Export in Vorbereitung" variant="orange" />
        )}
        {isDataSubjectRequestAdminNotifyInvokable() ? (
          <PremiumBadge label="Admin-Mail Edge" variant="cyan" />
        ) : (
          <PremiumBadge label="Admin-Mail in Vorbereitung" variant="orange" />
        )}
        {canManage ? (
          <PremiumBadge label="Status-Update" variant="green" />
        ) : (
          <PremiumBadge label="Read-only" variant="green" />
        )}
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            accentColor={kpi.accentColor}
          />
        ))}
      </View>
    </PremiumListHeroFrame>
  );
}

