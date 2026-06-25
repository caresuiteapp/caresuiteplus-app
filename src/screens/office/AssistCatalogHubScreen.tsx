import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { CatalogItemsEditor } from '@/components/office/assistCatalog/CatalogItemsEditor';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  exportCatalogAsJson,
  loadAssistCatalogHubStats,
  loadCatalogAuditEvents,
  loadTemplateBindings,
} from '@/lib/assistCatalog';
import type { AssistCatalogHubStats, CatalogAuditEvent, TemplateBinding } from '@/types/assistCatalog';
import { colors, spacing, typography } from '@/theme';

const TABS = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'subjects', label: 'Betreff & Arten' },
  { key: 'packages', label: 'Aufgabenpakete' },
  { key: 'tasks', label: 'Einzelaufgaben' },
  { key: 'intake', label: 'Neuaufnahme' },
  { key: 'documentation', label: 'Dokumentation' },
  { key: 'documents', label: 'Dokumentvorlagen' },
  { key: 'proof', label: 'Leistungsnachweis' },
  { key: 'communication', label: 'Kommunikation' },
  { key: 'billing', label: 'Abrechnung' },
  { key: 'risks', label: 'Risiken' },
  { key: 'reasons', label: 'Abbruch/Ausfall' },
  { key: 'bindings', label: 'Bindungen' },
  { key: 'import', label: 'Import/Export' },
  { key: 'audit', label: 'Änderungsverlauf' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <PremiumCard style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </PremiumCard>
  );
}

export function AssistCatalogHubScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const canEdit = can('office.catalogs.edit');

  const [tab, setTab] = useState<TabKey>('overview');
  const [stats, setStats] = useState<AssistCatalogHubStats | null>(null);
  const [bindings, setBindings] = useState<TemplateBinding[]>([]);
  const [audit, setAudit] = useState<CatalogAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSystem, setFilterSystem] = useState<'all' | 'system' | 'tenant'>('all');
  const [exportJson, setExportJson] = useState('');

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    const [statsRes, bindRes, auditRes] = await Promise.all([
      loadAssistCatalogHubStats(tenantId, profile?.roleKey),
      loadTemplateBindings(tenantId, profile?.roleKey),
      loadCatalogAuditEvents(tenantId, profile?.roleKey),
    ]);
    if (statsRes.ok) setStats(statsRes.data);
    else setError(statsRes.error);
    if (bindRes.ok) setBindings(bindRes.data);
    if (auditRes.ok) setAudit(auditRes.data);
    setLoading(false);
  }, [tenantId, profile?.roleKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const tabContent = useMemo(() => {
    switch (tab) {
      case 'subjects':
        return (
          <>
            <CatalogItemsEditor catalogKey="assist.assignment.subjects" title="Einsatz-Betreff" canEdit={canEdit} />
            <CatalogItemsEditor catalogKey="assist.assignment.types" title="Einsatzarten" canEdit={canEdit} />
            <CatalogItemsEditor catalogKey="assist.service.categories" title="Leistungskategorien" canEdit={canEdit} />
          </>
        );
      case 'packages':
        return (
          <CatalogItemsEditor
            catalogKey="assist.task.packages"
            title="Aufgabenpakete"
            canEdit={canEdit}
            showParentOnly
          />
        );
      case 'tasks':
        return (
          <CatalogItemsEditor catalogKey="assist.task.items" title="Einzelaufgaben" canEdit={canEdit} showParentOnly />
        );
      case 'intake':
        return (
          <>
            <CatalogItemsEditor catalogKey="assist.intake.templates" title="Neuaufnahme-Vorlagen" canEdit={canEdit} />
            <CatalogItemsEditor catalogKey="assist.intake.service_wish" title="Leistungswunsch" canEdit={canEdit} />
            <CatalogItemsEditor catalogKey="assist.intake.household" title="Haushaltssituation" canEdit={canEdit} />
            <CatalogItemsEditor catalogKey="assist.intake.mobility" title="Mobilität" canEdit={canEdit} />
            <CatalogItemsEditor catalogKey="assist.intake.risks" title="Risiken / Hinweise" canEdit={canEdit} />
          </>
        );
      case 'documentation':
        return (
          <CatalogItemsEditor catalogKey="assist.documentation.quick_blocks" title="Dokumentationsbausteine" canEdit={canEdit} />
        );
      case 'documents':
        return (
          <SectionPanel title="Dokumentvorlagen">
            <Text style={styles.hint}>
              HTML-Dokumentvorlagen werden im Dokumentenmodul verwaltet.
            </Text>
            <PremiumButton
              title="Dokumentvorlagen öffnen"
              onPress={() => router.push('/business/templates/document-templates')}
            />
            <CatalogItemsEditor catalogKey="assist.document.types" title="Dokumentarten" canEdit={canEdit} />
          </SectionPanel>
        );
      case 'proof':
        return (
          <CatalogItemsEditor catalogKey="assist.service_proof.templates" title="Leistungsnachweis-Vorlagen" canEdit={canEdit} />
        );
      case 'communication':
        return (
          <CatalogItemsEditor catalogKey="assist.communication.templates" title="Kommunikationsvorlagen" canEdit={canEdit} />
        );
      case 'billing':
        return (
          <>
            <CatalogItemsEditor catalogKey="assist.billing.budget_sources" title="Abrechnungstöpfe" canEdit={canEdit} />
            <CatalogItemsEditor catalogKey="assist.billing.statuses" title="Abrechnungsstatus" canEdit={canEdit} />
            <CatalogItemsEditor catalogKey="assist.billing.notes" title="Abrechnungshinweise" canEdit={canEdit} />
          </>
        );
      case 'risks':
        return <CatalogItemsEditor catalogKey="assist.risk_flags" title="Risiken & Hinweise" canEdit={canEdit} />;
      case 'reasons':
        return (
          <>
            <CatalogItemsEditor catalogKey="assist.task.not_completed_reasons" title="Gründe: nicht erledigt" canEdit={canEdit} />
            <CatalogItemsEditor catalogKey="assist.assignment.abort_reasons" title="Einsatzabbruchgründe" canEdit={canEdit} />
            <CatalogItemsEditor catalogKey="assist.assignment.cancellation_reasons" title="Ausfallgründe" canEdit={canEdit} />
          </>
        );
      case 'bindings':
        return (
          <SectionPanel title="Sichtbarkeit & Bindings">
            {bindings.length === 0 ? (
              <EmptyState title="Keine Bindings" message="Noch keine Feld-Bindings konfiguriert." />
            ) : (
              bindings.map((b) => (
                <PremiumCard key={b.id} style={styles.bindingCard}>
                  <Text style={styles.bindingTitle}>{b.targetField ?? b.targetArea}</Text>
                  <Text style={styles.bindingMeta}>
                    {b.targetModule} · {b.targetArea} · {b.targetComponent ?? '—'}
                  </Text>
                </PremiumCard>
              ))
            )}
          </SectionPanel>
        );
      case 'import':
        return (
          <SectionPanel title="Import / Export">
            <PremiumButton
              title="Einsatz-Betreff als JSON exportieren"
              onPress={async () => {
                if (!tenantId) return;
                const res = await exportCatalogAsJson(tenantId, 'assist.assignment.subjects', profile?.roleKey);
                if (res.ok) setExportJson(JSON.stringify(res.data, null, 2));
              }}
            />
            {exportJson ? (
              <PremiumInput
                label="Export-Vorschau"
                value={exportJson}
                onChangeText={setExportJson}
                multiline
                numberOfLines={8}
              />
            ) : null}
          </SectionPanel>
        );
      case 'audit':
        return (
          <SectionPanel title="Änderungsverlauf">
            {audit.length === 0 ? (
              <EmptyState title="Keine Einträge" message="Noch keine protokollierten Änderungen." />
            ) : (
              audit.map((e) => (
                <PremiumCard key={e.id} style={styles.bindingCard}>
                  <Text style={styles.bindingTitle}>{e.summary ?? e.action}</Text>
                  <Text style={styles.bindingMeta}>
                    {e.entityType} · {new Date(e.createdAt).toLocaleString('de-DE')}
                  </Text>
                </PremiumCard>
              ))
            )}
          </SectionPanel>
        );
      default:
        return (
          <>
            <SectionPanel title="Schnellaktionen">
              <View style={styles.actions}>
                <PremiumButton title="Neuer Betreff" onPress={() => setTab('subjects')} disabled={!canEdit} />
                <PremiumButton title="Neues Aufgabenpaket" onPress={() => setTab('packages')} disabled={!canEdit} />
                <PremiumButton title="Assist → Neuer Einsatz" onPress={() => router.push('/assist/einsaetze')} />
              </View>
            </SectionPanel>
            {stats ? (
              <View style={styles.statsGrid}>
                <StatTile label="Aktive Betreffe" value={stats.activeAssignmentTemplates} />
                <StatTile label="Aufgabenpakete" value={stats.activeTaskPackages} />
                <StatTile label="Einzelaufgaben" value={stats.activeTaskItems} />
                <StatTile label="Dok.-Bausteine" value={stats.documentationBlocks} />
                <StatTile label="Neuaufnahme-Vorl." value={stats.intakeTemplates} />
                <StatTile label="Inaktive Einträge" value={stats.inactiveEntries} />
              </View>
            ) : null}
            <Text style={styles.auditHint}>
              Änderungen an Katalogen werden protokolliert. Zuletzt geändert:{' '}
              {stats?.lastChangedAt ? new Date(stats.lastChangedAt).toLocaleString('de-DE') : '—'}
            </Text>
          </>
        );
    }
  }, [tab, canEdit, bindings, audit, stats, exportJson, tenantId, profile?.roleKey, router]);

  if (!can('office.catalogs.view')) {
    return (
      <ScreenShell title="Assist-Vorlagen & Kataloge" subtitle={roleLabel ?? ''} showBack>
        <LockedActionBanner message={check('office.catalogs.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && !stats) {
    return (
      <ScreenShell title="Assist-Vorlagen & Kataloge" subtitle="Wird geladen…" showBack>
        <LoadingState message="Kataloge werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && !stats) {
    return (
      <ScreenShell title="Assist-Vorlagen & Kataloge" subtitle="Fehler" showBack>
        <ErrorState message={error} onRetry={() => void reload()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Assist-Vorlagen & Kataloge"
      subtitle="Steuern Sie hier alle Auswahlfelder, Aufgaben, Dokumentationsbausteine und Vorlagen für CareSuite+ Assist."
      showBack
    >
      <PremiumInput label="Suche" placeholder="Katalog durchsuchen…" value="" onChangeText={() => {}} editable={false} />
      <FilterChipGroup
        options={[
          { value: 'all', label: 'Alle' },
          { value: 'system', label: 'System' },
          { value: 'tenant', label: 'Mandant' },
        ]}
        value={filterSystem}
        onChange={(v) => setFilterSystem(v as typeof filterSystem)}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        <FilterChipGroup
          options={TABS.map((t) => ({ value: t.key, label: t.label }))}
          value={tab}
          onChange={(v) => setTab(v as TabKey)}
        />
      </ScrollView>
      <ScrollView style={styles.content}>{tabContent}</ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  tabBar: { marginVertical: spacing.sm, maxHeight: 48 },
  content: { flex: 1 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statTile: { minWidth: 140, flexGrow: 1, padding: spacing.md },
  statValue: { ...typography.h3, color: colors.primary },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  auditHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md },
  bindingCard: { marginBottom: spacing.sm },
  bindingTitle: { ...typography.body, fontWeight: '600' },
  bindingMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  hint: { ...typography.body, marginBottom: spacing.md },
});
