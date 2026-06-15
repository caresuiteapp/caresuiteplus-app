import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchCareRecordDetail } from '@/lib/assist/careRecordService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { CareRecordDetailHero } from '@/components/assist';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, InfoBanner, LoadingState, PremiumButton, PremiumCard, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useCareRecordDetail } from '@/hooks/useCareRecordDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

export function CareRecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'caregiver';
  const {
    data: record,
    loading,
    error,
    actionLoading,
    successMessage,
    pdfResult,
    refresh,
    sign,
    exportPdf,
    notFound,
  } = useCareRecordDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Nachweis" subtitle="Wird geladen…">
        <LoadingState message="Nachweis wird geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Nachweis" subtitle="Fehler">
        <ErrorState message={error ?? 'Nachweis nicht gefunden.'} onRetry={refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!record) return null;

  return (
    <ScreenShell
      title="Leistungsnachweis"
      subtitle={`${record.assignmentTitle} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      {successMessage ? <SuccessState message={successMessage} /> : null}

      <CareRecordDetailHero record={record} roleKey={roleKey} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <PremiumCard accentColor={record.hasSignature ? colors.success : colors.amber}>
          <Text style={styles.status}>{WORKFLOW_STATUS_LABELS[record.status]}</Text>
          <Text style={styles.content}>{record.content}</Text>
        </PremiumCard>

        <SectionPanel title="Einsatzdaten">
          <DetailInfoRow label="Klient:in" value={record.clientName} />
          <DetailInfoRow label="Mitarbeitende:r" value={record.employeeName} />
          <DetailInfoRow
            label="Dauer"
            value={record.durationMinutes != null ? `${record.durationMinutes} Min.` : '—'}
          />
          <DetailInfoRow label="Ort" value={record.location} />
        </SectionPanel>

        {record.signature ? (
          <SectionPanel title="Unterschrift">
            <DetailInfoRow label="Unterzeichnet von" value={record.signature.signedByName} />
            <DetailInfoRow
              label="Zeitpunkt"
              value={new Date(record.signature.signedAt).toLocaleString('de-DE')}
            />
          </SectionPanel>
        ) : (
          <SectionPanel title="Unterschrift ausstehend">
            {!can('assist.records.sign') ? (
              <LockedActionBanner
                message={check('assist.records.sign').reason ?? 'Keine Berechtigung.'}
                roleLabel={roleLabel}
              />
            ) : (
              <PremiumButton
                title="Digital unterschreiben"
                fullWidth
                loading={actionLoading}
                onPress={() => sign()}
              />
            )}
          </SectionPanel>
        )}

        {record.hasSignature && can('assist.records.export') ? (
          <SectionPanel title="PDF-Export">
            <PremiumButton
              title="PDF erzeugen"
              fullWidth
              loading={actionLoading}
              onPress={() => exportPdf()}
            />
            {pdfResult ? (
              <InfoBanner
                variant="success"
                title={`${pdfResult.fileName} erzeugt`}
                message={pdfResult.storagePath}
              />
            ) : null}
            {record.pdfExportPath ? (
              <PremiumCard accentColor={colors.cyan}>
                <Text style={styles.previewLabel}>Vorschau</Text>
                <Text style={styles.preview}>
                  {pdfResult?.contentPreview ?? 'PDF im Demo-Speicher abgelegt.'}
                </Text>
              </PremiumCard>
            ) : null}
          </SectionPanel>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  status: { ...typography.caption, marginBottom: spacing.sm },
  content: { ...typography.body },
  previewLabel: { ...typography.label, marginBottom: spacing.xs },
  preview: { ...typography.caption, fontFamily: 'monospace' },
});
