import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { AuroraSegmentedControl } from '@/components/aurora';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { CsvExportPanel } from '@/components/csv/CsvExportPanel';
import { CsvImportLogTable } from '@/components/csv/CsvImportLogTable';
import { CsvImportPreview } from '@/components/csv/CsvImportPreview';
import { CsvSecurityNotice } from '@/components/csv/CsvSecurityNotice';
import { CsvTemplateDownloadCard } from '@/components/csv/CsvTemplateDownloadCard';
import { CsvUploadDropzone } from '@/components/csv/CsvUploadDropzone';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  executeClientCsvImport,
  executeEmployeeCsvImport,
  exportClientsCsv,
  exportEmployeesCsv,
  listImportLogs,
  loadEmployeeRoleOptions,
  loadExistingDuplicateKeys,
  validateCsvImport,
} from '@/lib/csv';
import type { ClientImportRow } from '@/types/clientImport';
import type { EmployeeImportRow } from '@/types/employeeImport';
import type { CsvImportPreview as PreviewState } from '@/types/csv';
import { typography } from '@/theme';

type TabKey =
  | 'overview'
  | 'clients-import'
  | 'clients-export'
  | 'employees-import'
  | 'employees-export'
  | 'templates'
  | 'logs';

const TAB_OPTIONS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'clients-import', label: 'Klient:innen Import' },
  { key: 'clients-export', label: 'Klient:innen Export' },
  { key: 'employees-import', label: 'MA Import' },
  { key: 'employees-export', label: 'MA Export' },
  { key: 'templates', label: 'Vorlagen' },
  { key: 'logs', label: 'Protokolle' },
];

export function CsvImportExportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { profile, user } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, roleLabel } = usePermissions();
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');

  const [tab, setTab] = useState<TabKey>((params.tab as TabKey | undefined) ?? 'overview');
  useEffect(() => {
    if (params.tab && TAB_OPTIONS.some((t) => t.key === params.tab)) {
      setTab(params.tab as TabKey);
    }
  }, [params.tab]);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number; content: string } | null>(null);
  const [clientPreview, setClientPreview] = useState<PreviewState<ClientImportRow> | null>(null);
  const [employeePreview, setEmployeePreview] = useState<PreviewState<EmployeeImportRow> | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);

  const canView = can('tenant.settings.csv.view');
  const canImportClients = can('tenant.settings.csv.import.clients') && can('office.clients.create');
  const canImportEmployees = can('tenant.settings.csv.import.employees') && can('office.employees.create');
  const canExportClients = can('tenant.settings.csv.export.clients');
  const canExportEmployees = can('tenant.settings.csv.export.employees');
  const canLogs = can('tenant.settings.csv.logs.view');

  const logsQuery = useAsyncQuery(
    () => {
      if (!tenantId || !canLogs) return Promise.resolve({ ok: true as const, data: [] });
      return listImportLogs(tenantId, profile?.roleKey);
    },
    [tenantId, canLogs, profile?.roleKey],
    { enabled: !!tenantId && canLogs },
  );

  useEffect(() => {
    if (!tenantId) return;
    loadEmployeeRoleOptions(tenantId).then(setRoleOptions);
  }, [tenantId]);

  const validateFile = useCallback(
    async (importType: 'clients' | 'employees') => {
      if (!selectedFile || !tenantId) return;
      setError(null);
      setMessage(null);
      const dupes = await loadExistingDuplicateKeys(tenantId, importType);
      const result = await validateCsvImport({
        csvContent: selectedFile.content,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        importType,
        roleOptions,
        allowSensitiveEmployeeFields: can('office.employees.view_sensitive'),
        existingDuplicateKeys: dupes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (importType === 'clients') setClientPreview(result.data as PreviewState<ClientImportRow>);
      else setEmployeePreview(result.data as PreviewState<EmployeeImportRow>);
      setMessage('Datei geprüft — bitte Vorschau bestätigen.');
    },
    [selectedFile, tenantId, roleOptions, can],
  );

  async function runImport(importType: 'clients' | 'employees', validOnly: boolean) {
    if (!tenantId || !user?.id) return;
    const preview = importType === 'clients' ? clientPreview : employeePreview;
    if (!preview) return;
    setImporting(true);
    setError(null);
    try {
      const result =
        importType === 'clients'
          ? await executeClientCsvImport({
              tenantId,
              userId: user.id,
              actorProfileId: profile?.id,
              actorRoleKey: profile?.roleKey,
              preview: preview as PreviewState<ClientImportRow>,
              validRowsOnly: validOnly,
            })
          : await executeEmployeeCsvImport({
              tenantId,
              userId: user.id,
              actorProfileId: profile?.id,
              actorRoleKey: profile?.roleKey,
              preview: preview as PreviewState<EmployeeImportRow>,
              validRowsOnly: validOnly,
            });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        result.data.status === 'partially_imported'
          ? 'Der Import wurde teilweise abgeschlossen.'
          : 'Der Import wurde abgeschlossen.',
      );
      setClientPreview(null);
      setEmployeePreview(null);
      setSelectedFile(null);
      logsQuery.refresh();
      setTab('logs');
    } finally {
      setImporting(false);
    }
  }

  const overviewCards = useMemo(
    () => [
      { id: 'clients-import', title: 'Klient:innen importieren', desc: 'Mehrere Klient:innen per CSV anlegen', tab: 'clients-import' as TabKey, enabled: canImportClients },
      { id: 'clients-export', title: 'Klient:innen exportieren', desc: 'Stammdaten als CSV exportieren', tab: 'clients-export' as TabKey, enabled: canExportClients },
      { id: 'employees-import', title: 'Mitarbeiter:innen importieren', desc: 'Personalstamm per CSV erweitern', tab: 'employees-import' as TabKey, enabled: canImportEmployees },
      { id: 'employees-export', title: 'Mitarbeiter:innen exportieren', desc: 'Personalstamm als CSV sichern', tab: 'employees-export' as TabKey, enabled: canExportEmployees },
      { id: 'templates', title: 'Standardvorlagen', desc: 'Import-Vorlagen herunterladen', tab: 'templates' as TabKey, enabled: can('tenant.settings.csv.templates.download') },
      { id: 'logs', title: 'Importprotokolle', desc: 'Historie und Fehlerdetails', tab: 'logs' as TabKey, enabled: canLogs },
    ],
    [canImportClients, canImportEmployees, canExportClients, canExportEmployees, canLogs, can],
  );

  if (!canView) {
    return (
      <ScreenShell title="CSV Import / Export" subtitle="Office · Mandanteneinstellungen">
        <LockedActionBanner message="Keine Berechtigung für CSV Import / Export." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="CSV Import / Export"
      subtitle={`Datenverwaltung · ${roleLabel ?? 'Office'} · Mandanteneinstellungen`}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.lead, { color: text.secondary }]}>
          Importieren oder exportieren Sie Klient:innen- und Mitarbeiter:innen-Daten über standardisierte CSV-Dateien.
          Nutzen Sie die bereitgestellten Vorlagen, um Fehler beim Import zu vermeiden.
        </Text>

        <AuroraSegmentedControl
          options={TAB_OPTIONS}
          value={tab}
          onChange={(value) => setTab(value as TabKey)}
          style={styles.tabs}
        />

        {message ? <SuccessState message={message} /> : null}
        {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}

        {tab === 'overview' ? (
          <View style={styles.grid}>
            {overviewCards.map((card) => (
              <View key={card.id} style={[styles.card, { borderColor: `${accent}55`, backgroundColor: `${accent}12` }]}>
                <Text style={[styles.cardTitle, { color: text.primary }]}>{card.title}</Text>
                <Text style={[styles.cardDesc, { color: text.secondary }]}>{card.desc}</Text>
                <PremiumButton
                  title="Öffnen"
                  variant="secondary"
                  disabled={!card.enabled}
                  onPress={() => setTab(card.tab)}
                />
              </View>
            ))}
          </View>
        ) : null}

        {tab === 'templates' ? (
          <View style={styles.stack}>
            <CsvTemplateDownloadCard importType="clients" disabled={!can('tenant.settings.csv.templates.download')} />
            <CsvTemplateDownloadCard importType="employees" disabled={!can('tenant.settings.csv.templates.download')} />
          </View>
        ) : null}

        {tab === 'clients-import' ? (
          <View style={styles.stack}>
            <CsvSecurityNotice variant="import" />
            <CsvTemplateDownloadCard importType="clients" />
            <CsvUploadDropzone
              selectedFileName={selectedFile?.name}
              disabled={!canImportClients}
              onFileSelected={setSelectedFile}
            />
            <PremiumButton title="Datei prüfen" disabled={!selectedFile || !canImportClients} onPress={() => validateFile('clients')} />
            {clientPreview ? (
              <CsvImportPreview
                preview={clientPreview}
                importing={importing}
                onCancel={() => {
                  setClientPreview(null);
                  setSelectedFile(null);
                }}
                onImportAll={() => runImport('clients', false)}
                onImportValidOnly={() => runImport('clients', true)}
              />
            ) : null}
          </View>
        ) : null}

        {tab === 'employees-import' ? (
          <View style={styles.stack}>
            <CsvSecurityNotice variant="import" />
            <CsvTemplateDownloadCard importType="employees" />
            <CsvUploadDropzone
              selectedFileName={selectedFile?.name}
              disabled={!canImportEmployees}
              onFileSelected={setSelectedFile}
            />
            <PremiumButton title="Datei prüfen" disabled={!selectedFile || !canImportEmployees} onPress={() => validateFile('employees')} />
            {employeePreview ? (
              <CsvImportPreview
                preview={employeePreview}
                importing={importing}
                onCancel={() => {
                  setEmployeePreview(null);
                  setSelectedFile(null);
                }}
                onImportAll={() => runImport('employees', false)}
                onImportValidOnly={() => runImport('employees', true)}
              />
            ) : null}
          </View>
        ) : null}

        {tab === 'clients-export' ? (
          <CsvExportPanel
            kind="clients"
            onExport={async (filters) => {
              if (!tenantId || !user?.id) return;
              const result = await exportClientsCsv({
                tenantId,
                userId: user.id,
                filters,
                actorRoleKey: profile?.roleKey,
              });
              if (!result.ok) setError(result.error);
              else setMessage(`Der Export wurde erfolgreich erstellt (${result.data.count} Datensätze).`);
            }}
          />
        ) : null}

        {tab === 'employees-export' ? (
          <CsvExportPanel
            kind="employees"
            onExport={async (filters) => {
              if (!tenantId || !user?.id) return;
              const result = await exportEmployeesCsv({
                tenantId,
                userId: user.id,
                filters,
                actorRoleKey: profile?.roleKey,
              });
              if (!result.ok) setError(result.error);
              else setMessage(`Der Export wurde erfolgreich erstellt (${result.data.count} Datensätze).`);
            }}
          />
        ) : null}

        {tab === 'logs' ? (
          logsQuery.loading ? (
            <LoadingState message="Importprotokolle werden geladen…" />
          ) : (
            <CsvImportLogTable
              logs={logsQuery.data ?? []}
              tenantId={tenantId ?? ''}
              roleKey={profile?.roleKey}
            />
          )
        ) : null}

        <SectionPanel title="Navigation">
          <PremiumButton title="Zurück zu Office Einstellungen" variant="ghost" onPress={() => router.push('/business/office/settings')} />
        </SectionPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: careSpacing.md, gap: careSpacing.md, paddingBottom: careSpacing.xxl },
  lead: { ...typography.body },
  tabs: { marginBottom: careSpacing.sm },
  stack: { gap: careSpacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: careSpacing.md,
    minWidth: 240,
    flexGrow: 1,
    gap: careSpacing.sm,
  },
  cardTitle: { ...typography.bodyStrong },
  cardDesc: { ...typography.caption, flex: 1 },
});
