import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { PortalEmployeeAssignmentDetailHero } from '@/components/portal';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  CachedDataBanner,
} from '@/components/ui';
import { usePortalAppointmentDetail } from '@/hooks/usePortalAppointmentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { employeePortalHomeAppointmentTitle } from '@/lib/portal/portalHomeAppointment';
import { spacing, typography } from '@/theme';
import { portalPremium } from '@/design/tokens/portalPremium';

function EmployeeDetailFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDurationMinutes(startsAt: string, endsAt: string): string {
  const mins = Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h} Std. ${m} Min.`;
  return `${m} Min.`;
}

export function PortalAssignmentDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canView = can('portal.employee.appointments.view');

  const { data, loading, error, refresh, notFound, fromCache, cachedAt, partialDetail } =
    usePortalAppointmentDetail(id);

  if (!canView) {
    return (
      <PortalTabScreen title="Einsatz" subtitle={resolvePortalScreenSubtitle(roleLabel, 'employee')}>
        <LockedActionBanner
          message={check('portal.employee.appointments.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </PortalTabScreen>
    );
  }

  if (loading) {
    return (
      <PortalTabScreen title="Einsatz" subtitle="Wird geladen…">
        <LoadingState message="Einsatzdetails werden geladen…" />
      </PortalTabScreen>
    );
  }

  if (notFound || error) {
    return (
      <PortalTabScreen title="Einsatz" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Einsatz existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </PortalTabScreen>
    );
  }

  if (!data) return null;

  const handleCall = () => {
    if (!data.clientPhone) return;
    void Linking.openURL(`tel:${data.clientPhone.replace(/\s/g, '')}`);
  };

  return (
    <C14vSubpageShell
      title={employeePortalHomeAppointmentTitle(data)}
      eyebrow="PORTAL · EINSATZ"
      subtitle={`${data.clientName} · ${resolvePortalScreenSubtitle(roleLabel, 'employee')}`}
      contentOwnsHero
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <CachedDataBanner visible={fromCache} cachedAt={cachedAt} partialDetail={partialDetail} />
        <PortalEmployeeAssignmentDetailHero assignment={data} />

        <PremiumCard style={styles.previewCard}>
          <Text style={styles.previewTitle}>Einsatzvorschau</Text>
          <View style={styles.factGrid}>
            <EmployeeDetailFact label="Klient:in" value={data.clientName} />
            {data.location ? <EmployeeDetailFact label="Adresse" value={data.location} /> : null}
          </View>
          <View style={styles.factGrid}>
            <EmployeeDetailFact
            label="Einsatzzeit"
            value={`${formatTime(data.startsAt)} – ${formatTime(data.endsAt)}`}
            />
            <EmployeeDetailFact
              label="Geplante Dauer"
              value={formatDurationMinutes(data.startsAt, data.endsAt)}
            />
          </View>
          {data.clientPhone ? <EmployeeDetailFact label="Telefon" value={data.clientPhone} /> : null}
          {data.notes ? (
            <View style={styles.notesCard}>
              <Text style={styles.factLabel}>Hinweise</Text>
              <Text style={styles.notes}>{data.notes}</Text>
            </View>
          ) : null}
        </PremiumCard>

        <View style={styles.actions}>
          {data.clientPhone ? (
            <PremiumButton title="Anrufen" variant="secondary" onPress={handleCall} />
          ) : null}
          {data.canOpenExecution && data.executionRoute && !fromCache ? (
            <PremiumButton
              title={data.canStartExecution ? 'Einsatz starten' : 'Zur Durchführung'}
              onPress={() => router.push(data.executionRoute as never)}
            />
          ) : null}
        </View>
      </ScrollView>
    </C14vSubpageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  previewCard: { padding: spacing.lg, gap: spacing.sm, borderRadius: 22 },
  previewTitle: { ...typography.h3, color: portalPremium.text.primary },
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fact: {
    flex: 1,
    minWidth: 220,
    gap: 3,
    padding: spacing.md,
    borderRadius: portalPremium.radius.card,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    backgroundColor: portalPremium.surfaceRaised,
  },
  factLabel: {
    ...typography.caption,
    color: portalPremium.text.muted,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  factValue: { ...typography.bodyStrong, color: portalPremium.text.primary },
  notesCard: {
    gap: 3,
    padding: spacing.md,
    borderRadius: portalPremium.radius.card,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    backgroundColor: portalPremium.surfaceSoft,
  },
  notes: { ...typography.body, color: portalPremium.text.secondary },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
