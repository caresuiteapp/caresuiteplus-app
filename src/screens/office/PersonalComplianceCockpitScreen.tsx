import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PersonalComplianceCockpitHero } from '@/components/office/PersonalComplianceCockpitHero';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumInput,
  PremiumKpiCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  createPersonalComplianceTaskFromRisk,
  fetchPersonalComplianceSnapshot,
  PERSONAL_COMPLIANCE_COCKPIT_ROUTE,
} from '@/lib/office/personalComplianceCockpitService';
import type {
  PersonalComplianceKpiKey,
  PersonalComplianceListFilter,
  PersonalComplianceRiskCode,
} from '@/types/modules/personalComplianceCockpit';
import { PERSONAL_COMPLIANCE_KPI_LABELS } from '@/types/modules/personalComplianceCockpit';
import { spacing } from '@/theme';

const RISK_FILTERS: { key: PersonalComplianceRiskCode | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'qualification_missing', label: 'Qualifikation' },
  { key: 'background_check_missing', label: 'Führungszeugnis' },
  { key: 'briefing_missing', label: 'Unterweisung' },
  { key: 'not_deployable', label: 'Einsatz' },
  { key: 'offboarding_open', label: 'Offboarding' },
];

export function PersonalComplianceCockpitScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? null;

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<PersonalComplianceRiskCode | 'all'>('all');
  const [kpiFilter, setKpiFilter] = useState<PersonalComplianceKpiKey | null>(null);

  const listFilter = useMemo((): PersonalComplianceListFilter | undefined => {
    const filter: PersonalComplianceListFilter = {};
    if (search.trim()) filter.search = search.trim();
    if (riskFilter !== 'all') filter.riskCode = riskFilter;
    if (kpiFilter) filter.kpiKey = kpiFilter;
    return Object.keys(filter).length > 0 ? filter : undefined;
  }, [search, riskFilter, kpiFilter]);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return Promise.resolve(
        fetchPersonalComplianceSnapshot(tenantId, roleKey, listFilter, {
          userId: profile?.id,
        }),
      );
    },
    [tenantId, roleKey, listFilter, profile?.id],
    { enabled: !!tenantId && can('office.employees.view') },
  );

  const handleCreateTask = useCallback(
    (riskId: string) => {
      if (!tenantId) return;
      createPersonalComplianceTaskFromRisk({
        tenantId,
        riskId,
        actorRoleKey: roleKey,
        actorId: profile?.id,
      });
      query.refresh();
    },
    [tenantId, roleKey, profile?.id, query],
  );

  if (!can('office.employees.view')) {
    return (
      <ScreenShell title="Personal-Compliance" subtitle="Kein Zugriff" scroll>
        <LockedActionBanner
          message={check('office.employees.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Personal-Compliance" subtitle="Wird geladen…" scroll>
        <LoadingState message="Compliance-Daten werden aggregiert…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Personal-Compliance" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const snapshot = query.data;
  if (!snapshot) {
    return (
      <ScreenShell title="Personal-Compliance" scroll>
        <EmptyState title="Keine Daten" message="Compliance-Übersicht nicht verfügbar." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Personal-Compliance" subtitle="Mehr → Personal → Personal-Compliance" scroll>
      <PersonalComplianceCockpitHero snapshot={snapshot} />

      <SectionPanel title="KPIs" subtitle="14 Kennzahlen — jede mit Datenquelle">
        <View style={styles.kpiGrid}>
          {snapshot.kpis.map((kpi) => (
            <Pressable
              key={kpi.key}
              style={styles.kpiTile}
              onPress={() => setKpiFilter(kpiFilter === kpi.key ? null : kpi.key)}
            >
              <PremiumKpiCard
                label={kpi.label}
                value={String(kpi.value)}
                subValue={kpi.dataSource}
                accentColor={kpi.accentColor}
              />
            </Pressable>
          ))}
        </View>
        {kpiFilter ? (
          <PremiumButton
            title={`Filter: ${PERSONAL_COMPLIANCE_KPI_LABELS[kpiFilter]} — zurücksetzen`}
            variant="secondary"
            onPress={() => setKpiFilter(null)}
          />
        ) : null}
      </SectionPanel>

      <SectionPanel title="Filter" subtitle="Risiko, Rolle, Suche">
        <PremiumInput
          label="Suche"
          value={search}
          onChangeText={setSearch}
          placeholder="Name, Rolle, Risiko…"
        />
        <FilterChipGroup
          options={RISK_FILTERS.map((f) => ({ key: f.key, label: f.label }))}
          value={riskFilter}
          onChange={(key) => setRiskFilter(key)}
        />
      </SectionPanel>

      <SectionPanel title="Risiken" subtitle={`${snapshot.risks.length} offene Hinweise`}>
        {snapshot.risks.length === 0 ? (
          <EmptyState title="Keine Risiken" message="Keine Warnungen für den aktuellen Filter." />
        ) : (
          snapshot.risks.map((risk) => (
            <View key={risk.id} style={styles.riskRow}>
              <Text style={styles.riskTitle}>
                {risk.severity === 'critical' ? '🔴' : risk.severity === 'warning' ? '🟠' : '🔵'}{' '}
                {risk.title} — {risk.employeeName}
              </Text>
              <Text style={styles.riskMeta}>
                {risk.message} · Quelle: {risk.dataSource}
              </Text>
              <View style={styles.riskActions}>
                <PremiumButton
                  title="Personalakte"
                  variant="secondary"
                  onPress={() => router.push(risk.employeeId ? `/business/office/employees/${risk.employeeId}` as never : PERSONAL_COMPLIANCE_COCKPIT_ROUTE as never)}
                />
                {can('office.employees.edit') ? (
                  <PremiumButton
                    title="Aufgabe anlegen"
                    variant="secondary"
                    onPress={() => handleCreateTask(risk.id)}
                  />
                ) : null}
              </View>
            </View>
          ))
        )}
      </SectionPanel>

      <SectionPanel title="Mitarbeitende" subtitle="Einsatzfähigkeit & Risikoanzahl">
        {snapshot.employees.map((employee) => (
          <View key={employee.employeeId} style={styles.employeeRow}>
            <Text style={styles.employeeName}>
              {employee.fullName} · {employee.roleTitle ?? '—'}
            </Text>
            <Text style={styles.employeeMeta}>
              {employee.deployable ? 'Einsatzfähig' : 'Nicht einsatzfähig'} · {employee.riskCount}{' '}
              Risiken ({employee.criticalRiskCount} kritisch)
            </Text>
            <PremiumButton
              title="Drilldown"
              variant="secondary"
              onPress={() => router.push(employee.personnelFileRoute as never)}
            />
          </View>
        ))}
      </SectionPanel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiTile: { flex: 1, minWidth: 140 },
  riskRow: { gap: spacing.xs, marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  riskTitle: { fontWeight: '600' },
  riskMeta: { opacity: 0.75, fontSize: 13 },
  riskActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  employeeRow: { gap: spacing.xs, marginBottom: spacing.md },
  employeeName: { fontWeight: '600' },
  employeeMeta: { opacity: 0.75, fontSize: 13 },
});
