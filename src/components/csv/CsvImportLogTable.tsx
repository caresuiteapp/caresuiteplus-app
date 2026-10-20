import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import type { CsvImportLogRecord } from '@/types/csv';
import { buildErrorReportCsv } from '@/lib/csv/csvValidation';
import { buildErrorReportFileName, triggerCsvDownload } from '@/lib/csv/csvDownload';
import { getImportLogDetail } from '@/lib/csv/csvImportLogs';
import { CsvErrorTable } from './CsvErrorTable';
import { typography } from '@/theme';
import type { RoleKey } from '@/types';

type Props = {
  logs: CsvImportLogRecord[];
  tenantId: string;
  roleKey?: RoleKey | null;
};

export function CsvImportLogTable({ logs, tenantId, roleKey }: Props) {
  const text = useAuroraAdaptiveText();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailErrors, setDetailErrors] = useState<import('@/types/csv').CsvRowIssue[]>([]);

  async function openDetail(logId: string) {
    setSelectedId(logId);
    const result = await getImportLogDetail(tenantId, logId, roleKey);
    if (result.ok) setDetailErrors(result.data.errors);
  }

  if (logs.length === 0) {
    return (
      <SectionPanel title="Importprotokolle" subtitle="Noch keine Importe">
        <Text style={{ color: text.muted }}>Nach dem ersten Import erscheinen hier die Protokolle.</Text>
      </SectionPanel>
    );
  }

  return (
    <View style={styles.wrap}>
      <SectionPanel title="Importprotokolle" subtitle={`${logs.length} Einträge`}>
        {logs.map((log) => (
          <View key={log.id} style={[styles.row, { borderBottomColor: text.border }]}>
            <View style={styles.meta}>
              <Text style={[styles.title, { color: text.primary }]}>
                {log.importType === 'clients' ? 'Klient:innen' : 'Mitarbeiter:innen'} · {log.fileName ?? '—'}
              </Text>
              <Text style={[styles.sub, { color: text.muted }]}>
                {new Date(log.createdAt).toLocaleString('de-DE')} · {log.importedRows}/{log.totalRows} importiert · {log.status}
              </Text>
            </View>
            <PremiumButton title="Importprotokoll öffnen" variant="secondary" onPress={() => openDetail(log.id)} />
          </View>
        ))}
      </SectionPanel>
      {selectedId ? (
        <>
          <CsvErrorTable issues={detailErrors} />
          <PremiumButton
            title="Fehlerbericht herunterladen"
            variant="secondary"
            disabled={detailErrors.length === 0}
            onPress={() => triggerCsvDownload(buildErrorReportCsv(detailErrors), buildErrorReportFileName())}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: careSpacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: careSpacing.md,
    paddingVertical: careSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  meta: { flex: 1 },
  title: { ...typography.bodyStrong },
  sub: { ...typography.caption },
});
