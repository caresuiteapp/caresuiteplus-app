import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import {
  MedicationDetailHero,
  MEDICATION_DETAIL_PREPARED_MESSAGE,
} from '@/components/pflege/MedicationDetailHero';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { DetailInfoRow } from '@/components/detail';
import { ScreenShell } from '@/components/layout';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchMedicationDetail } from '@/lib/pflege/medicationDetailService';
import {
  isMedicationEmpReady,
  MEDICATION_EMP_PREPARED_MESSAGE,
} from '@/lib/pflege/pflegeModuleConfig';
import { getActionAvailability } from '@/lib/ui/actionAvailability';
import { spacing, typography, colors } from '@/theme';

export function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, isReadOnly } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !id) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchMedicationDetail(id, tenantId, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );

  const detail = query.data;
  const empReady = isMedicationEmpReady();
  const empSyncAvailability = getActionAvailability('medication.emp_sync', {
    roleKey,
    isPreparedOnly: !empReady,
    hasProvider: empReady,
    isReadOnly,
    canExecute: false,
  });
  const prescriptionAvailability = getActionAvailability('medication.prescription', {
    roleKey,
    isPreparedOnly: !empReady,
    isReadOnly,
    canExecute: false,
  });
  const interactionsAvailability = getActionAvailability('medication.interactions', {
    roleKey,
    isPreparedOnly: !empReady,
    isReadOnly,
    canExecute: false,
  });

  if (query.loading && !detail) {
    return (
      <ScreenShell title="Medikation" subtitle="Wird geladen…">
        <LoadingState message="Verordnung wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error || !detail) {
    return (
      <ScreenShell title="Medikation" subtitle="Fehler">
        <ErrorState
          message={query.error ?? 'Verordnung nicht gefunden.'}
          onRetry={query.refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Medikation"
      subtitle={`${detail.medicationName} · ${roleLabel ?? 'Demo'}`}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <MedicationDetailHero detail={detail} roleKey={roleKey} isReadOnly={isReadOnly} />
        <PreparedModeBanner hint={MEDICATION_DETAIL_PREPARED_MESSAGE} />
        {!empReady ? (
          <InfoBanner
            variant="warning"
            title="eMP extern"
            message={MEDICATION_EMP_PREPARED_MESSAGE}
          />
        ) : null}

        <SectionPanel title="Aktionen" subtitle="eMP und Verordnung (vorbereitet)">
          <PremiumButton
            title="eMP abgleichen"
            fullWidth
            variant={empSyncAvailability.isPreparedOnly ? 'prepared' : 'primary'}
            disabled={!empSyncAvailability.enabled}
          />
          {empSyncAvailability.disabledReason ? (
            <Text style={styles.hint}>{empSyncAvailability.disabledReason}</Text>
          ) : null}
          <PremiumButton
            title="Verordnung ändern"
            variant={prescriptionAvailability.isPreparedOnly ? 'prepared' : 'secondary'}
            fullWidth
            disabled={!prescriptionAvailability.enabled}
          />
          <PremiumButton
            title="Wechselwirkungen prüfen"
            variant={interactionsAvailability.isPreparedOnly ? 'prepared' : 'secondary'}
            fullWidth
            disabled={!interactionsAvailability.enabled}
          />
        </SectionPanel>

        <SectionPanel title="Verordnung" subtitle="Dosierung und Einnahme">
          <DetailInfoRow label="Präparat" value={detail.medicationName} />
          <DetailInfoRow label="Dosierung" value={detail.dosage} />
          <DetailInfoRow label="Einnahme" value={detail.schedule} />
          <DetailInfoRow label="Applikation" value={detail.route} />
          <DetailInfoRow label="Verordnet von" value={detail.prescribedBy} />
          <DetailInfoRow
            label="eMP-Status"
            value={detail.empSyncStatus === 'prepared' ? 'Externe Anbindung' : detail.empSyncStatus}
          />
        </SectionPanel>

        <SectionPanel title="Hinweise" subtitle="eMP und Interaktionen (vorbereitet)">
          <Text style={styles.body}>{detail.instructions}</Text>
          {detail.interactions.length > 0 ? (
            <Text style={styles.meta}>Wechselwirkungen: {detail.interactions.join(', ')}</Text>
          ) : null}
          <Text style={styles.note}>{detail.notes}</Text>
        </SectionPanel>

        <PflegeCrossModuleLinksPanel context="medication" />

        <PremiumButton title="Zurück zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  body: { ...typography.body, marginBottom: spacing.sm },
  meta: { ...typography.caption, marginBottom: spacing.xs },
  note: { ...typography.caption, color: colors.textMuted },
  hint: { ...typography.caption, color: colors.textMuted },
});
