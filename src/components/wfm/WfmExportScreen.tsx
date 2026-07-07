import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { triggerCsvDownload } from '@/lib/csv/csvDownload';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createWfmExportJob, type WfmExportFormat } from '@/lib/wfm/wfmExportService';
import { getWfmOfficeExportWarnings } from '@/lib/wfm/wfmOfficeTimekeepingService';

function triggerWebFileDownload(content: string, mimeType: string, fileName: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  try {
    if (content.startsWith('data:')) {
      const anchor = document.createElement('a');
      anchor.href = content;
      anchor.download = fileName;
      anchor.click();
      return;
    }

    if (mimeType.includes('csv') || mimeType.includes('text/plain')) {
      triggerCsvDownload(content, fileName);
      return;
    }

    if (typeof Blob !== 'undefined' && typeof URL?.createObjectURL === 'function') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    }
  } catch {
    // Headless or restricted browser — UI preview remains available.
  }
}

export function WfmExportScreen() {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const userId = user?.id ?? profile?.id ?? '';
  const { can, check, roleLabel, roleKey } = usePermissions();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  const [lastFormat, setLastFormat] = useState<WfmExportFormat>('csv');
  const [exportWarnings, setExportWarnings] = useState<string[]>([]);

  const canExport = can('time.tracking.admin.export');
  const exportReady = Boolean(tenantId && userId);

  const runExport = async (format: WfmExportFormat) => {
    if (!exportReady) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setExportWarnings([]);

    const warnResult = await getWfmOfficeExportWarnings(tenantId, roleKey, 'this_month');
    if (warnResult.ok && warnResult.data.warnings.length) {
      setExportWarnings(warnResult.data.warnings);
    }

    const result = await createWfmExportJob(tenantId, userId, roleKey, year, month, format);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setLastPreview(result.data.content);
    setLastFormat(format);
    triggerWebFileDownload(result.data.content, result.data.mimeType, result.data.fileName);

    const formatLabels: Record<WfmExportFormat, string> = {
      csv: 'CSV',
      pdf: 'PDF',
      datev: 'DATEV',
    };
    setMessage(
      `${formatLabels[format]}-Export erstellt: ${result.data.rowCount} Datensätze (Prüfsumme ${result.data.checksum}).`,
    );
  };

  if (!canExport) {
    return (
      <ScreenShell title="Arbeitszeit-Export">
        <View testID="wfm-export-screen" accessibilityLabel="Arbeitszeit-Export">
          <LockedActionBanner
            message={check('time.tracking.admin.export').reason ?? 'Keine Berechtigung.'}
            roleLabel={roleLabel}
          />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Arbeitszeit-Export" subtitle="CSV, PDF und DATEV für Lohnbuchhaltung" showBack={false} scroll>
      <View testID="wfm-export-screen" accessibilityLabel="Arbeitszeit-Export">
      <Text style={styles.periodLabel}>Zeitraum: {String(month).padStart(2, '0')}/{year}</Text>

      <SectionPanel title="Zeitraum">
        <View style={styles.periodRow}>
          <PremiumButton title="◀ Monat" variant="ghost" onPress={() => {
            if (month === 1) { setMonth(12); setYear((y) => y - 1); } else setMonth((m) => m - 1);
          }} />
          <PremiumButton title="Monat ▶" variant="ghost" onPress={() => {
            if (month === 12) { setMonth(1); setYear((y) => y + 1); } else setMonth((m) => m + 1);
          }} />
        </View>
      </SectionPanel>

      <SectionPanel title="Export starten">
        {!exportReady ? (
          <InfoBanner message="Sitzung wird geladen — Export starten, sobald Mandant und Benutzer bereit sind." />
        ) : null}
        {loading ? <LoadingState message="Export wird erstellt…" /> : null}
        {exportWarnings.map((w) => (
          <InfoBanner key={w} variant="warning" message={w} />
        ))}
        <PremiumButton
          title="CSV exportieren"
          testID="wfm-export-csv"
          onPress={() => void runExport('csv')}
          disabled={loading || !exportReady}
        />
        <PremiumButton
          title="PDF exportieren"
          variant="secondary"
          onPress={() => void runExport('pdf')}
          disabled={loading || !exportReady}
        />
        <PremiumButton
          title="DATEV LOHN exportieren"
          variant="secondary"
          onPress={() => void runExport('datev')}
          disabled={loading || !exportReady}
        />
      </SectionPanel>

      {lastPreview ? (
        <SectionPanel title="Export-Vorschau" subtitle={`Format: ${lastFormat.toUpperCase()}`}>
          <Text style={styles.preview} numberOfLines={12}>
            {lastFormat === 'pdf' && lastPreview.startsWith('data:')
              ? '[PDF-Datei erzeugt — Download im Browser verfügbar]'
              : lastPreview.split('\n').slice(0, 8).join('\n')}
          </Text>
        </SectionPanel>
      ) : null}

      {message ? <SuccessState title="Erfolg" message={message} /> : null}
      {error ? <ErrorState title="Fehler" message={error} onRetry={() => setError(null)} /> : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  periodLabel: { marginBottom: careSpacing.md, fontWeight: '600' },
  periodRow: { flexDirection: 'row', gap: careSpacing.sm },
  preview: { fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
});
