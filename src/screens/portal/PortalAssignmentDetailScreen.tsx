import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { PortalEmployeeAssignmentDetailHero } from '@/components/portal';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { ScreenShell } from '@/components/layout';
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
import { colors, spacing, typography } from '@/theme';

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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
        previewCard: { padding: spacing.md, gap: spacing.sm },
        previewTitle: { ...typography.h3, color: colors.textPrimary },
        notes: { ...typography.body, color: colors.textSecondary },
        actions: { gap: spacing.sm, marginTop: spacing.sm },
      }),
    [],
  );

  if (!canView) {
    return (
      <ScreenShell title="Einsatz" subtitle={resolvePortalScreenSubtitle(roleLabel, 'employee')}>
        <LockedActionBanner
          message={check('portal.employee.appointments.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading) {
    return (
      <ScreenShell title="Einsatz" subtitle="Wird geladen…">
        <LoadingState message="Einsatzdetails werden geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Einsatz" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Einsatz existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!data) return null;

  const handleCall = () => {
    if (!data.clientPhone) return;
    void Linking.openURL(`tel:${data.clientPhone.replace(/\s/g, '')}`);
  };

  return (
    <C14vSubpageShell
      title={data.title}
      eyebrow="PORTAL · EINSATZ"
      subtitle={`${data.clientName} · ${resolvePortalScreenSubtitle(roleLabel, 'employee')}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <CachedDataBanner visible={fromCache} cachedAt={cachedAt} partialDetail={partialDetail} />
        <PortalEmployeeAssignmentDetailHero assignment={data} />

        <PremiumCard style={styles.previewCard}>
          <Text style={styles.previewTitle}>Einsatzvorschau</Text>
          <DetailInfoRow label="Klient:in" value={data.clientName} />
          {data.location ? <DetailInfoRow label="Adresse" value={data.location} /> : null}
          <DetailInfoRow
            label="Einsatzzeit"
            value={`${formatTime(data.startsAt)} – ${formatTime(data.endsAt)}`}
          />
          <DetailInfoRow
            label="Geplante Dauer"
            value={formatDurationMinutes(data.startsAt, data.endsAt)}
          />
          {data.clientPhone ? <DetailInfoRow label="Telefon" value={data.clientPhone} /> : null}
          {data.notes ? (
            <>
              <DetailInfoRow label="Hinweise" value="" />
              <Text style={styles.notes}>{data.notes}</Text>
            </>
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
