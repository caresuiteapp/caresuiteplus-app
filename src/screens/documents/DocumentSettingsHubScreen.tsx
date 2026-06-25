import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { DocumentTemplateListPanel } from '@/components/documents/DocumentTemplateListPanel';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  InfoBanner,
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
  ensureDocumentCatalogSeeded,
  loadDocumentEngineAudit,
  loadDocumentEngineBindings,
  loadDocumentEngineDashboardStats,
  loadDocumentEngineTemplates,
} from '@/lib/documents/documentEngineService';
import { PERMISSION_LABELS } from '@/lib/permissions';
import type { PermissionKey } from '@/types/permissions';
import type {
  DocumentEngineAuditEntry,
  DocumentEngineBinding,
  DocumentEngineDashboardStats,
  DocumentEngineTemplateListItem,
} from '@/types/documents/documentEngine';
import { colors, spacing, typography } from '@/theme';

const TABS = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'all', label: 'Alle' },
  { key: 'system', label: 'System' },
  { key: 'tenant', label: 'Mandant' },
  { key: 'module', label: 'Module' },
  { key: 'client', label: 'Klient' },
  { key: 'employee', label: 'Mitarbeiter' },
  { key: 'contract', label: 'Vertrag' },
  { key: 'service_proof', label: 'Leistungsnachweis' },
  { key: 'documentation', label: 'Dokumentation' },
  { key: 'pflege', label: 'Pflege' },
  { key: 'assist', label: 'Assist' },
  { key: 'beratung', label: 'Beratung' },
  { key: 'stationaer', label: 'Stationär' },
  { key: 'akademie', label: 'Akademie' },
  { key: 'shift', label: 'Dienstplan' },
  { key: 'billing', label: 'Abrechnung' },
  { key: 'vehicle', label: 'Fahrzeug' },
  { key: 'imported', label: 'Importiert' },
  { key: 'layouts', label: 'Layouts' },
  { key: 'variables', label: 'Platzhalter' },
  { key: 'mapping', label: 'Mapping' },
  { key: 'preview', label: 'Vorschau' },
  { key: 'signatures', label: 'Signaturen' },
  { key: 'send', label: 'Versand' },
  { key: 'archive', label: 'Archiv' },
  { key: 'permissions', label: 'Berechtigungen' },
  { key: 'import_export', label: 'Import/Export' },
  { key: 'versions', label: 'Versionen' },
  { key: 'audit', label: 'Audit' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const TEMPLATE_LIST_TABS = new Set<TabKey>([
  'all',
  'system',
  'tenant',
  'module',
  'client',
  'employee',
  'contract',
  'service_proof',
  'documentation',
  'pflege',
  'assist',
  'beratung',
  'stationaer',
  'akademie',
  'shift',
  'billing',
  'vehicle',
  'imported',
]);

const SETTINGS_TEMPLATE_PERMISSIONS: PermissionKey[] = [
  'settings.templates.view',
  'settings.templates.create',
  'settings.templates.update',
  'settings.templates.delete',
  'settings.templates.deactivate',
  'settings.templates.copy',
  'settings.templates.publish',
  'settings.templates.version',
  'settings.templates.mapping',
  'settings.templates.layout',
  'settings.templates.send_settings',
  'settings.templates.audit',
];

const DOCUMENTS_PERMISSIONS: PermissionKey[] = [
  'documents.preview',
  'documents.create',
  'documents.edit_draft',
  'documents.finalize',
  'documents.pdf_create',
  'documents.download',
  'documents.email_send',
  'documents.fax_send',
  'documents.save_to_file',
  'documents.archive',
  'documents.delete_draft',
];

const STAT_FIELDS: { key: keyof DocumentEngineDashboardStats; label: string }[] = [
  { key: 'totalTemplates', label: 'Vorlagen gesamt' },
  { key: 'activeTemplates', label: 'Aktive Vorlagen' },
  { key: 'systemTemplates', label: 'Systemvorlagen' },
  { key: 'tenantTemplates', label: 'Mandantenvorlagen' },
  { key: 'importedTemplates', label: 'Importierte Vorlagen' },
  { key: 'assistTemplates', label: 'Assist-Vorlagen' },
  { key: 'officeTemplates', label: 'Office-Vorlagen' },
  { key: 'pflegeTemplates', label: 'Pflege-Vorlagen' },
  { key: 'beratungTemplates', label: 'Beratungsvorlagen' },
  { key: 'stationaerTemplates', label: 'Stationäre Vorlagen' },
  { key: 'akademieTemplates', label: 'Akademie-Vorlagen' },
  { key: 'pdfEnabledTemplates', label: 'PDF-fähig' },
  { key: 'emailEnabledTemplates', label: 'E-Mail-fähig' },
  { key: 'faxEnabledTemplates', label: 'Fax-fähig' },
  { key: 'signatureRequiredTemplates', label: 'Signaturpflichtig' },
  { key: 'mappingIncompleteTemplates', label: 'Mapping unvollständig' },
  { key: 'pendingApprovalTemplates', label: 'Freigabe ausstehend' },
  { key: 'documentsCreatedToday', label: 'Dokumente heute' },
  { key: 'openSignatures', label: 'Offene Signaturen' },
  { key: 'failedSendCount', label: 'Fehlgeschlagene Sendungen' },
];

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <PremiumCard style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </PremiumCard>
  );
}

function filterTemplatesForSpecialTab(
  tab: TabKey,
  templates: DocumentEngineTemplateListItem[],
): DocumentEngineTemplateListItem[] {
  switch (tab) {
    case 'signatures':
      return templates.filter((t) => t.isSignatureRequired);
    case 'send':
      return templates.filter((t) => t.isEmailEnabled || t.isFaxEnabled);
    case 'archive':
      return templates.filter((t) => t.templateStatus === 'archived' || t.templateStatus === 'inactive');
    case 'versions':
      return [...templates].sort((a, b) => b.version - a.version);
    default:
      return templates;
  }
}

export function DocumentSettingsHubScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, canAny, check, roleLabel } = usePermissions();
  const canView = canAny(['settings.templates.view', 'office.catalogs.view']);

  const [tab, setTab] = useState<TabKey>('overview');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<DocumentEngineDashboardStats | null>(null);
  const [templates, setTemplates] = useState<DocumentEngineTemplateListItem[]>([]);
  const [bindings, setBindings] = useState<DocumentEngineBinding[]>([]);
  const [audit, setAudit] = useState<DocumentEngineAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const reloadCore = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    await ensureDocumentCatalogSeeded();
    const [statsRes, bindRes, auditRes] = await Promise.all([
      loadDocumentEngineDashboardStats(tenantId, profile?.roleKey),
      loadDocumentEngineBindings(tenantId, profile?.roleKey),
      loadDocumentEngineAudit(tenantId, profile?.roleKey),
    ]);
    if (statsRes.ok) setStats(statsRes.data);
    else setError(statsRes.error);
    if (bindRes.ok) setBindings(bindRes.data);
    if (auditRes.ok) setAudit(auditRes.data);
    setLoading(false);
  }, [tenantId, profile?.roleKey]);

  const reloadTemplates = useCallback(
    async (tabKey: TabKey) => {
      if (!tenantId) return;
      if (!TEMPLATE_LIST_TABS.has(tabKey) && tabKey !== 'signatures' && tabKey !== 'send' && tabKey !== 'archive' && tabKey !== 'versions') {
        return;
      }
      setTemplatesLoading(true);
      const listTab = TEMPLATE_LIST_TABS.has(tabKey) ? tabKey : 'all';
      const res = await loadDocumentEngineTemplates(
        tenantId,
        { tab: listTab, search: search.trim() || undefined },
        profile?.roleKey,
      );
      if (res.ok) {
        setTemplates(filterTemplatesForSpecialTab(tabKey, res.data));
      }
      setTemplatesLoading(false);
    },
    [tenantId, profile?.roleKey, search],
  );

  useEffect(() => {
    void reloadCore();
  }, [reloadCore]);

  useEffect(() => {
    if (
      TEMPLATE_LIST_TABS.has(tab) ||
      tab === 'signatures' ||
      tab === 'send' ||
      tab === 'archive' ||
      tab === 'versions'
    ) {
      void reloadTemplates(tab);
    }
  }, [tab, reloadTemplates]);

  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? tab;

  const tabContent = useMemo(() => {
    switch (tab) {
      case 'layouts':
        return (
          <SectionPanel title="CI & Layout">
            <Text style={styles.hint}>
              Mandanten-CI, Briefkopf, Fußzeile und Layout-Familien für alle Dokumentvorlagen.
            </Text>
            <PremiumButton
              title="CI & Layout öffnen"
              onPress={() => router.push('/business/templates/ci-layout' as never)}
            />
          </SectionPanel>
        );
      case 'variables':
        return (
          <SectionPanel title="Platzhalter">
            <Text style={styles.hint}>
              Zentrale Registry für System- und Mandantenplatzhalter in Vorlagen & Dokumenten.
            </Text>
            <PremiumButton
              title="Platzhalterverwaltung öffnen"
              onPress={() => router.push('/business/templates/placeholders' as never)}
            />
          </SectionPanel>
        );
      case 'mapping':
        return (
          <SectionPanel title="Feldmapping & Bindings">
            {bindings.length === 0 ? (
              <EmptyState title="Keine Bindings" message="Noch keine Vorlagen-Bindings konfiguriert." />
            ) : (
              bindings.map((b) => (
                <PremiumCard key={b.id} style={styles.listCard}>
                  <Text style={styles.listTitle}>{b.templateName || b.templateId}</Text>
                  <Text style={styles.listMeta}>
                    {b.targetModule} · {b.targetArea}
                    {b.targetComponent ? ` · ${b.targetComponent}` : ''}
                  </Text>
                  <Text style={styles.listMeta}>
                    {b.bindingType}
                    {b.triggerEvent ? ` · ${b.triggerEvent}` : ''}
                    {b.isDefault ? ' · Standard' : ''}
                    {b.isRequired ? ' · Pflicht' : ''}
                    {!b.isActive ? ' · Inaktiv' : ''}
                  </Text>
                </PremiumCard>
              ))
            )}
          </SectionPanel>
        );
      case 'preview':
        return (
          <SectionPanel title="Live-Vorschau">
            <Text style={styles.hint}>
              HTML-Vorlagen mit Beispieldaten rendern und vor dem Versand prüfen.
            </Text>
            <PremiumButton
              title="Live-Vorschau öffnen"
              onPress={() => router.push('/business/templates/live-preview' as never)}
            />
          </SectionPanel>
        );
      case 'permissions':
        return (
          <SectionPanel title="Berechtigungen">
            <InfoBanner
              variant="info"
              message="Einstellungsrechte (settings.templates.*) steuern die Vorlagenverwaltung. Dokumentenrechte (documents.*) steuern Erstellung, Versand und Archivierung."
            />
            <Text style={styles.permissionGroupTitle}>settings.templates.*</Text>
            {SETTINGS_TEMPLATE_PERMISSIONS.map((key) => (
              <PremiumCard key={key} style={styles.permissionRow}>
                <Text style={styles.listTitle}>{key}</Text>
                <Text style={styles.listMeta}>{PERMISSION_LABELS[key]}</Text>
                <PremiumBadgeInline allowed={can(key)} />
              </PremiumCard>
            ))}
            <Text style={styles.permissionGroupTitle}>documents.*</Text>
            {DOCUMENTS_PERMISSIONS.map((key) => (
              <PremiumCard key={key} style={styles.permissionRow}>
                <Text style={styles.listTitle}>{key}</Text>
                <Text style={styles.listMeta}>{PERMISSION_LABELS[key]}</Text>
                <PremiumBadgeInline allowed={can(key)} />
              </PremiumCard>
            ))}
          </SectionPanel>
        );
      case 'import_export':
        return (
          <SectionPanel title="Import / Export">
            <InfoBanner
              variant="info"
              message="Mandantenvorlagen können exportiert und in andere Mandanten importiert werden. Systemvorlagen sind schreibgeschützt."
            />
            <PremiumButton
              title="Systemkatalog synchronisieren"
              onPress={async () => {
                const res = await ensureDocumentCatalogSeeded();
                if (res.ok) {
                  setSeedMessage(`${res.data.inserted} Systemvorlagen synchronisiert.`);
                  void reloadCore();
                  void reloadTemplates('all');
                } else {
                  setSeedMessage(res.error);
                }
              }}
            />
            {seedMessage ? <Text style={styles.hint}>{seedMessage}</Text> : null}
          </SectionPanel>
        );
      case 'audit':
        return (
          <SectionPanel title="Änderungsverlauf">
            {audit.length === 0 ? (
              <EmptyState title="Keine Einträge" message="Noch keine protokollierten Vorlagenänderungen." />
            ) : (
              audit.map((e) => (
                <PremiumCard key={e.id} style={styles.listCard}>
                  <Text style={styles.listTitle}>{e.action}</Text>
                  <Text style={styles.listMeta}>
                    {e.entityType} · {e.entityId}
                  </Text>
                  <Text style={styles.listMeta}>
                    {e.actorRole ?? 'System'} · {new Date(e.createdAt).toLocaleString('de-DE')}
                  </Text>
                </PremiumCard>
              ))
            )}
          </SectionPanel>
        );
      case 'overview':
        return (
          <>
            <SectionPanel title="Schnellaktionen">
              <View style={styles.actions}>
                <PremiumButton title="Live-Vorschau" onPress={() => router.push('/business/templates/live-preview' as never)} />
                <PremiumButton title="CI & Layout" onPress={() => router.push('/business/templates/ci-layout' as never)} />
                <PremiumButton title="Platzhalter" onPress={() => router.push('/business/templates/placeholders' as never)} />
                <PremiumButton title="Alle Vorlagen" onPress={() => setTab('all')} />
              </View>
            </SectionPanel>
            {stats ? (
              <View style={styles.statsGrid}>
                {STAT_FIELDS.map(({ key, label }) => (
                  <StatTile key={key} label={label} value={stats[key]} />
                ))}
              </View>
            ) : null}
          </>
        );
      default:
        return (
          <DocumentTemplateListPanel
            title={tabLabel}
            templates={templates}
            loading={templatesLoading}
          />
        );
    }
  }, [
    tab,
    tabLabel,
    stats,
    templates,
    templatesLoading,
    bindings,
    audit,
    seedMessage,
    can,
    router,
    reloadCore,
    reloadTemplates,
  ]);

  if (!canView) {
    const reason =
      check('settings.templates.view').reason ??
      check('office.catalogs.view').reason ??
      'Keine Berechtigung.';
    return (
      <ScreenShell title="Vorlagen & Dokumente" subtitle={roleLabel ?? ''} showBack>
        <LockedActionBanner message={reason} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && !stats) {
    return (
      <ScreenShell title="Vorlagen & Dokumente" subtitle="Wird geladen…" showBack>
        <LoadingState message="Dokument-Engine wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !stats) {
    return (
      <ScreenShell title="Vorlagen & Dokumente" subtitle="Fehler" showBack>
        <ErrorState message={error} onRetry={() => void reloadCore()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Vorlagen & Dokumente"
      subtitle="Zentrale Steuerung aller Dokumentvorlagen, Layouts, Bindings und Versandeinstellungen."
      showBack
    >
      <PremiumInput
        label="Suche"
        placeholder="Vorlage suchen…"
        value={search}
        onChangeText={setSearch}
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

function PremiumBadgeInline({ allowed }: { allowed: boolean }) {
  return (
    <Text style={[styles.badgeInline, { color: allowed ? colors.success : colors.textSecondary }]}>
      {allowed ? 'Freigegeben' : 'Nicht freigegeben'}
    </Text>
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
  hint: { ...typography.body, marginBottom: spacing.md, color: colors.textSecondary },
  listCard: { marginBottom: spacing.sm },
  listTitle: { ...typography.body, fontWeight: '600' },
  listMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  permissionGroupTitle: { ...typography.h3, marginTop: spacing.md, marginBottom: spacing.sm },
  permissionRow: { marginBottom: spacing.sm, gap: spacing.xs },
  badgeInline: { ...typography.caption, fontWeight: '600', marginTop: spacing.xs },
});
