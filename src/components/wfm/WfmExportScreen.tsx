import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumKpiCard,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { buildWfmPdfStub, createWfmExportJob } from '@/lib/wfm';

export function WfmExportScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const userId = user?.id ?? profile?.id ?? '';
  const { can, check, roleLabel, roleKey } = usePermissions();
  const accent = moduleColor('office');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCsv, setLastCsv] = useState<string | null>(null);

  const canExport = can('time.tracking.admin.export');

  const runExport = async (format: 'csv' | 'pdf') => {
    if (!tenantId || !userId) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await createWfmExportJob(tenantId, userId, roleKey, year, month, format);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (format === 'csv') {
      setLastCsv(result.data.csv);
      setMessage(`CSV-Export erstellt: ${result.data.rowCount} Datensätze (Prüfsumme ${result.data.checksum}).`);
    } else {
      const stub = buildWfmPdfStub(tenantId, year, month, result.data.rowCount);
      setLastCsv(stub);
      setMessage(`PDF-Vorlage erstellt (${result.data.rowCount} Datensätze). Vollständiges PDF folgt in Phase 5.`);
    }
  };

  if (!canExport) {
    return (
      <ScreenShell title="Arbeitszeit-Export">
        <LockedActionBanner
          message={check('time.tracking.admin.export').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Arbeitszeit-Export" subtitle="CSV und PDF für Lohnbuchhaltung" scroll>
      <PremiumButton title="← Team-Übersicht" variant="ghost" onPress={() => router.push('/business/office/time-tracking/team' as never)} />

      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Monat" value={`${String(month).padStart(2, '0')}/${year}`} accentColor={accent} />
      </View>

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
        {loading ? <LoadingState message="Export wird erstellt…" /> : null}
        <PremiumButton title="CSV exportieren" onPress={() => void runExport('csv')} disabled={loading} />
        <PremiumButton title="PDF-Vorlage" variant="secondary" onPress={() => void runExport('pdf')} disabled={loading} />
      </SectionPanel>

      {lastCsv ? (
        <SectionPanel title="Export-Vorschau" subtitle="Erste Zeilen">
          <Text style={styles.preview} numberOfLines={12}>
            {lastCsv.split('\n').slice(0, 8).join('\n')}
          </Text>
        </SectionPanel>
      ) : null}

      {message ? <SuccessState title="Erfolg" message={message} /> : null}
      {error ? <ErrorState title="Fehler" message={error} onRetry={() => setError(null)} /> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: careSpacing.sm, marginBottom: careSpacing.md },
  periodRow: { flexDirection: 'row', gap: careSpacing.sm },
  preview: { fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
});
