import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { SisDetailHero, SIS_DETAIL_PREPARED_MESSAGE } from '@/components/pflege/SisDetailHero';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchSisAssessmentDetail, syncSisReviewDeadline } from '@/lib/pflege/sisListService';
import { isSisWriteReady, SIS_EDIT_PREPARED_MESSAGE } from '@/lib/pflege/pflegeModuleConfig';
import { colors, spacing, typography } from '@/theme';

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function SisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const writeReady = isSisWriteReady();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncOk, setSyncOk] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  const query = useAsyncQuery(
    () => {
      if (!id) return Promise.resolve({ ok: false as const, error: 'Keine Assessment-ID angegeben.' });
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchSisAssessmentDetail(id, tenantId, profile?.roleKey);
    },
    [id, tenantId, profile?.roleKey],
    { enabled: Boolean(id) && !!tenantId },
  );

  const assessment = query.data;

  async function handleSyncReview() {
    if (!id || !tenantId || !writeReady || isReadOnly) return;
    setSyncing(true);
    setSyncError(null);
    setSyncOk(false);
    const result = await syncSisReviewDeadline(id, tenantId, profile?.roleKey);
    setSyncing(false);
    if (!result.ok) {
      setSyncError(result.error);
      return;
    }
    setSyncOk(true);
    await query.refresh();
  }

  if (query.loading) {
    return (
      <ScreenShell title="SIS-Assessment" subtitle="Wird geladen…">
        <LoadingState message="Assessment wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error || !assessment) {
    return (
      <ScreenShell title="SIS-Assessment" subtitle="Fehler">
        <ErrorState
          title={query.error ? 'Fehler' : 'Nicht gefunden'}
          message={query.error ?? 'Das Assessment existiert nicht.'}
          onRetry={query.refresh}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="SIS-Assessment"
      subtitle={`${assessment.clientName} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        !isReadOnly ? (
          <PremiumButton
            title="Bearbeiten"
            size="sm"
            variant="ghost"
            onPress={() => router.push(`/pflege/sis/${id}/edit` as never)}
          />
        ) : undefined
      }
      scroll
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <SisDetailHero assessment={assessment} roleKey={roleKey} isReadOnly={isReadOnly} />
        <PreparedModeBanner hint={SIS_DETAIL_PREPARED_MESSAGE} />
        {!writeReady ? (
          <InfoBanner variant="warning" title="Demo-funktional" message={SIS_EDIT_PREPARED_MESSAGE} />
        ) : null}

        {isReadOnly ? (
          <LockedActionBanner
            title="Lesemodus"
            message="Sie können SIS-Assessments einsehen, aber nicht bearbeiten."
            roleLabel={roleLabel}
          />
        ) : null}

        <SectionPanel title="Assessment" subtitle="Bewertungsdaten">
          <SummaryRow
            label="Bewertet am"
            value={new Date(assessment.assessedAt).toLocaleString('de-DE')}
          />
          <SummaryRow label="Assessor:in" value={assessment.assessorName} />
          <SummaryRow label="Gesamtscore" value={`${assessment.overallScore} Punkte`} />
          {!assessment.nextReviewAt ? (
            <EmptyState
              title="Keine Prüffrist"
              message="Für dieses Assessment ist noch kein Review-Termin hinterlegt."
            />
          ) : (
            <SummaryRow
              label="Nächste Prüfung"
              value={new Date(assessment.nextReviewAt).toLocaleDateString('de-DE')}
            />
          )}
        </SectionPanel>

        <SectionPanel title="Review-Notiz" subtitle="Optional für Prüffrist-Sync">
          <PremiumInput
            label="Notiz zur nächsten Prüfung"
            placeholder="z. B. Rücksprache PDL, Angehörige einbinden…"
            value={reviewNote}
            onChangeText={setReviewNote}
            editable={!isReadOnly}
            multiline
          />
        </SectionPanel>

        <SectionPanel title="Aktionen" subtitle="Assessment">
          <PremiumButton
            title="Assessment bearbeiten"
            fullWidth
            disabled={isReadOnly}
            onPress={() => router.push(`/pflege/sis/${id}/edit` as never)}
          />
          <PremiumButton
            title={syncing ? 'Synchronisiere…' : 'Prüffrist synchronisieren'}
            variant="secondary"
            fullWidth
            disabled={!writeReady || isReadOnly || syncing}
            onPress={handleSyncReview}
          />
          {syncError ? <ErrorState message={syncError} /> : null}
          {syncOk ? (
            <SuccessState message="Prüffrist auf 90 Tage synchronisiert — Liste aktualisiert." />
          ) : null}
        </SectionPanel>

        <PflegeCrossModuleLinksPanel context="sis-assessment" />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  row: { marginBottom: spacing.sm },
  rowLabel: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  rowValue: { ...typography.body },
});
