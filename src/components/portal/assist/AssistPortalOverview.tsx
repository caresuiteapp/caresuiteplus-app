import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AssistPortalShell } from '@/components/portal/assist/AssistPortalShell';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { PortalKpiCard } from '@/components/portal/assist/PortalKpiCard';
import { PortalNextAppointmentHero } from '@/components/portal/assist/PortalNextAppointmentHero';
import { PortalQuickActions, type PortalQuickAction } from '@/components/portal/assist/PortalQuickActions';
import { PortalRequestDrawer } from '@/components/portal/assist/PortalRequestDrawer';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { usePortalActor } from '@/hooks/usePortalActor';
import {
  createPortalRequest,
  fetchAssistDashboardData,
  resolvePortalRequestTypeLabel,
} from '@/lib/portal/assist';
import { resolvePortalHeroCopy, resolvePortalTerminology } from '@/lib/portal/engine';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import { isFeatureVisible } from '@/lib/portal/engine/portalVisibility';
import type { PortalContext } from '@/lib/portal/types';
import type { AssistDashboardData, PortalRequest, PortalRequestType } from '@/types/portal/assist';
import { ErrorState, LoadingState, PremiumInput, SuccessState } from '@/components/ui';

type AssistPortalOverviewProps = {
  context: PortalContext;
  showSuccess?: boolean;
  onRefresh?: () => void;
};

export function AssistPortalOverview({ context, showSuccess, onRefresh }: AssistPortalOverviewProps) {
  const text = useAuroraAdaptiveText();
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const insets = useSafeAreaInsets();
  const { showBottomTabs } = usePlatformLayout();
  const router = useRouter();
  const contentPadding = useMemo(
    () => ({
      paddingHorizontal: careSpacing.md,
      paddingBottom: showBottomTabs
        ? PORTAL_MOBILE_NAV_HEIGHT + Math.max(insets.bottom, careSpacing.sm)
        : careSpacing.xl + insets.bottom,
    }),
    [insets.bottom, showBottomTabs],
  );
  const { actorId } = usePortalActor();

  const [dashboard, setDashboard] = useState<AssistDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestModal, setRequestModal] = useState<PortalRequestType | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PortalRequest | null>(null);
  const [localSuccess, setLocalSuccess] = useState(false);

  const terminology = resolvePortalTerminology('assist');
  const heroCopy = resolvePortalHeroCopy({
    displayName: context.displayName,
    tenantName: context.tenantName,
    terminology,
    isPhone,
  });
  const tripsReleased = isFeatureVisible('assist', 'trips', context.portalRole);
  const budgetReleased = isFeatureVisible('assist', 'budget', context.portalRole);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchAssistDashboardData(context);
    if (result.ok) {
      setDashboard(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [context]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleRefresh = async () => {
    await loadDashboard();
    onRefresh?.();
  };

  const submitRequest = async (requestType: PortalRequestType, description?: string) => {
    setSubmitting(true);
    const result = await createPortalRequest({
      tenantId: context.tenantId,
      clientId: context.clientId,
      portalUserId: actorId,
      moduleKey: 'assist',
      requestType,
      title: resolvePortalRequestTypeLabel(requestType),
      description: description?.trim() || null,
    });
    setSubmitting(false);

    if (result.ok) {
      setRequestModal(null);
      setRequestNote('');
      setLocalSuccess(true);
      setTimeout(() => setLocalSuccess(false), 2500);
      await loadDashboard();
    } else {
      setError(result.error);
    }
  };

  const handleQuickAction = (action: PortalQuickAction) => {
    if (action.key === 'nav_messages') {
      router.push('/portal/client/messages' as never);
      return;
    }
    if (action.key === 'nav_documents') {
      router.push('/portal/client/documents' as never);
      return;
    }
    setRequestModal(action.key as PortalRequestType);
  };

  if (loading && !dashboard) {
    return <LoadingState message="Assist-Portal wird geladen…" />;
  }

  if (error && !dashboard) {
    return <ErrorState title="Assist-Portal" message={error} onRetry={handleRefresh} />;
  }

  const data = dashboard!;

  return (
    <AssistPortalShell>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, contentPadding]}
        showsVerticalScrollIndicator={false}
      >
        {showSuccess || localSuccess ? (
          <SuccessState message="Anfrage wurde übermittelt." />
        ) : null}

        <PortalGlassHero
          eyebrow={heroCopy.eyebrow}
          title={heroCopy.title}
          subtitle={heroCopy.subtitle}
          meta={heroCopy.meta}
          badge={heroCopy.badge}
        />

        <PortalNextAppointmentHero
          appointment={data.nextAppointment}
          onRequestChange={() => setRequestModal('termin_aendern')}
          onRequestExtra={() => setRequestModal('zusatztermin')}
        />

        <View style={styles.kpiGrid}>
          <PortalKpiCard
            label="Termine"
            description="Anstehend"
            value={data.kpis.appointments}
            emptyMessage="Keine Termine geplant."
            ctaLabel="Zusatztermin"
            onCta={() => setRequestModal('zusatztermin')}
            onPress={() => router.push('/portal/client/appointments' as never)}
          />
          <PortalKpiCard
            label="Nachrichten"
            description="Threads"
            value={data.kpis.messages}
            emptyMessage="Noch keine Nachrichten."
            ctaLabel="Nachricht senden"
            onCta={() => router.push('/portal/client/messages' as never)}
            onPress={() => router.push('/portal/client/messages' as never)}
          />
          <PortalKpiCard
            label="Dokumente"
            description="Freigegeben"
            value={data.kpis.documents}
            emptyMessage="Noch keine Dokumente."
            ctaLabel="Upload anfragen"
            onCta={() => setRequestModal('upload')}
            onPress={() => router.push('/portal/client/documents' as never)}
          />
          <PortalKpiCard
            label="Nachweise"
            description="Offen"
            value={data.kpis.proofs}
            emptyMessage="Keine Nachweise offen."
            ctaLabel="Nachweis anfragen"
            onCta={() => setRequestModal('nachweise')}
          />
          <PortalKpiCard
            label="Unterschriften"
            description="Ausstehend"
            value={data.kpis.signatures}
            emptyMessage="Keine Unterschriften ausstehend."
            onPress={() => router.push('/portal/client/documents' as never)}
          />
          {budgetReleased ? (
            <PortalKpiCard
              label="Budget"
              description="§45b"
              value={data.budget ? data.budget.remainingAmount : null}
              emptyMessage="Budget noch nicht freigegeben."
            />
          ) : null}
          <PortalKpiCard
            label="Anfragen"
            description="Offen"
            value={data.kpis.openRequests}
            emptyMessage="Keine offenen Anfragen."
            ctaLabel="Anfrage stellen"
            onCta={() => setRequestModal('sonstiges')}
          />
          <PortalKpiCard
            label="Begleitungen"
            description="Geplant"
            value={data.kpis.begleitungen}
            emptyMessage="Keine Begleitungen geplant."
            hidden={!tripsReleased}
            onPress={() => router.push('/portal/client?module=assist&section=begleitungen' as never)}
          />
        </View>

        <PortalQuickActions onAction={handleQuickAction} />

        <View style={styles.section}>
          <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>AKTIVITÄTEN</Text>
          {data.activities.length === 0 ? (
            <GlassCard>
              <Text style={[type.body, { color: text.secondary }]} {...noBreakTextProps}>
                Noch keine Aktivitäten im Portal.
              </Text>
            </GlassCard>
          ) : (
            data.activities.map((activity) => (
              <GlassCard key={activity.id}>
                <Text style={[type.body, { color: text.primary, fontWeight: '600' }]} {...noBreakTextProps}>
                  {activity.title}
                </Text>
                {activity.description ? (
                  <Text style={[type.caption, { color: text.secondary }]}>{activity.description}</Text>
                ) : null}
              </GlassCard>
            ))
          )}
        </View>

        {budgetReleased && data.budget ? (
          <GlassCard glow accentColor="#FFD166">
            <Text style={[type.caption, { color: text.muted }]}>BUDGET §45B</Text>
            <Text style={[type.cardTitle, { color: text.primary }]}>
              {data.budget.remainingAmount.toLocaleString('de-DE', {
                style: 'currency',
                currency: data.budget.currency,
              })}{' '}
              verfügbar
            </Text>
            <Text style={[type.caption, { color: text.secondary }]}>
              Zeitraum {data.budget.periodStart} – {data.budget.periodEnd}
            </Text>
          </GlassCard>
        ) : null}

        {data.openRequests.length > 0 ? (
          <View style={styles.section}>
            <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>OFFENE ANFRAGEN</Text>
            {data.openRequests.map((request) => (
              <GlassCard key={request.id} onPress={() => setSelectedRequest(request)}>
                <Text style={[type.body, { color: text.primary, fontWeight: '600' }]} {...noBreakTextProps}>
                  {request.title}
                </Text>
                <Text style={[type.caption, { color: text.muted }]}>
                  {resolvePortalRequestTypeLabel(request.requestType)}
                </Text>
              </GlassCard>
            ))}
          </View>
        ) : null}

        <PortalRequestDrawer
          request={selectedRequest}
          visible={selectedRequest !== null}
          onClose={() => setSelectedRequest(null)}
        />
      </ScrollView>

      <PortalGlassModal
        visible={requestModal !== null}
        title={requestModal ? resolvePortalRequestTypeLabel(requestModal) : 'Anfrage'}
        onClose={() => {
          setRequestModal(null);
          setRequestNote('');
        }}
        primaryLabel="Anfrage senden"
        primaryLoading={submitting}
        onPrimary={() => {
          if (requestModal) void submitRequest(requestModal, requestNote);
        }}
      >
        <PremiumInput
          label="Nachricht (optional)"
          value={requestNote}
          onChangeText={setRequestNote}
          placeholder="Was möchten Sie mitteilen?"
          multiline
        />
      </PortalGlassModal>
    </AssistPortalShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    gap: careSpacing.md,
    width: '100%',
    maxWidth: '100%',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    width: '100%',
  },
  section: {
    gap: careSpacing.sm,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
