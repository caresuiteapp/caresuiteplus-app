import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AssistPortalShell } from '@/components/portal/assist/AssistPortalShell';
import { MobilePortalDashboard } from '@/components/portal/assist/MobilePortalDashboard';
import { PortalActivitiesModal } from '@/components/portal/assist/PortalActivitiesModal';
import { PortalDocumentUploadModal } from '@/components/portal/assist/PortalDocumentUploadModal';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { PortalOpenRequestsModal } from '@/components/portal/assist/PortalOpenRequestsModal';
import { PortalRequestFormModal } from '@/components/portal/assist/PortalRequestFormModal';
import { PortalKpiCard } from '@/components/portal/assist/PortalKpiCard';
import { PortalNextAppointmentHero } from '@/components/portal/assist/PortalNextAppointmentHero';
import { PortalQuickActions, type PortalQuickAction } from '@/components/portal/assist/PortalQuickActions';
import { PortalServiceProofsModal } from '@/components/portal/assist/PortalServiceProofsModal';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePortalAssistRealtime } from '@/hooks/usePortalAssistRealtime';
import {
  buildPortalRequestDescription,
  createPortalRequest,
  fetchAssistDashboardData,
  isPortalFormRequestType,
  resolvePortalRequestTypeLabel,
  serializePortalRequestPayload,
} from '@/lib/portal/assist';
import {
  canAccessPortalFeature,
  resolvePortalHeroCopy,
  resolvePortalTerminology,
} from '@/lib/portal/engine';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import type { PortalContext } from '@/lib/portal/types';
import type { AssistDashboardData, PortalRequestType } from '@/types/portal/assist';
import type { PortalStructuredRequestPayload } from '@/types/portal/requestPayloads';
import { ErrorState, LoadingState, SuccessState } from '@/components/ui';

type AssistOverviewModal = 'anfragen' | 'aktivitaeten';

type AssistPortalOverviewProps = {
  context: PortalContext;
  showSuccess?: boolean;
  onRefresh?: () => void;
  initialModal?: AssistOverviewModal | null;
};

export function AssistPortalOverview({
  context,
  showSuccess,
  onRefresh,
  initialModal = null,
}: AssistPortalOverviewProps) {
  const { isPhone } = useDeviceClass();

  if (isPhone) {
    return (
      <MobilePortalDashboard
        context={context}
        showSuccess={showSuccess}
        onRefresh={onRefresh}
        initialModal={initialModal}
      />
    );
  }

  return (
    <AssistPortalOverviewDesktop
      context={context}
      showSuccess={showSuccess}
      onRefresh={onRefresh}
      initialModal={initialModal}
    />
  );
}

function AssistPortalOverviewDesktop({
  context,
  showSuccess,
  onRefresh,
  initialModal = null,
}: AssistPortalOverviewProps) {
  const { width } = useDeviceClass();
  const text = useAuroraAdaptiveText();
  const type = resolveGalaxyTypography(width);
  const insets = useSafeAreaInsets();
  const { showBottomTabs } = usePlatformLayout();
  const router = useRouter();
  const params = useLocalSearchParams<{ modal?: string; action?: string }>();
  const contentPadding = useMemo(
    () => ({
      paddingHorizontal: careSpacing.md,
      paddingBottom: showBottomTabs
        ? PORTAL_MOBILE_NAV_HEIGHT + Math.max(insets.bottom, careSpacing.sm)
        : careSpacing.xl + insets.bottom,
    }),
    [insets.bottom, showBottomTabs],
  );
  const { actorId, displayName: actorDisplayName } = usePortalActor();

  const [dashboard, setDashboard] = useState<AssistDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestModal, setRequestModal] = useState<PortalRequestType | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [proofsModalOpen, setProofsModalOpen] = useState(false);
  const [openRequestsModalOpen, setOpenRequestsModalOpen] = useState(false);
  const [activitiesModalOpen, setActivitiesModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const terminology = resolvePortalTerminology('assist');
  const heroCopy = resolvePortalHeroCopy({
    displayName: actorDisplayName,
    tenantName: context.tenantName,
    terminology,
    isPhone: false,
  });
  const tripsReleased = canAccessPortalFeature(context, 'assist', 'trips');
  const budgetReleased = canAccessPortalFeature(context, 'assist', 'budget');
  const proofsReleased = canAccessPortalFeature(context, 'assist', 'nachweise');
  const requestsReleased = canAccessPortalFeature(context, 'assist', 'anfragen');
  const activitiesReleased = canAccessPortalFeature(context, 'assist', 'aktivitaeten');

  const quickActions = useMemo(() => {
    const actions: PortalQuickAction[] = [
      { key: 'nav_messages', label: 'Nachricht', icon: '💬' },
      { key: 'termin_aendern', label: 'Einsatzänderung', icon: '📅' },
      { key: 'zusatztermin', label: 'Zusatzeinsatz', icon: '➕' },
      { key: 'upload', label: 'Upload', icon: '📎' },
      { key: 'rueckruf', label: 'Rückruf', icon: '📞' },
    ];
    if (proofsReleased) {
      actions.push({ key: 'nachweise', label: 'Nachweise', icon: '📋' });
    }
    return actions;
  }, [proofsReleased]);

  const clearModalRoute = useCallback(() => {
    if (params.modal) {
      router.replace('/portal/client' as never);
    }
  }, [params.modal, router]);

  const openZusatzterminRequest = useCallback(() => {
    if (params.modal) {
      router.replace('/portal/client?action=zusatztermin' as never);
      return;
    }
    setRequestModal('zusatztermin');
  }, [params.modal, router]);

  const openRequestsModal = useCallback(() => {
    if (!requestsReleased) return;
    setOpenRequestsModalOpen(true);
  }, [requestsReleased]);

  const openActivitiesModal = useCallback(() => {
    if (!activitiesReleased) return;
    setActivitiesModalOpen(true);
  }, [activitiesReleased]);

  useEffect(() => {
    const modalKey = initialModal ?? (typeof params.modal === 'string' ? params.modal : null);
    if (modalKey === 'anfragen' && requestsReleased) {
      setOpenRequestsModalOpen(true);
    } else if (modalKey === 'aktivitaeten' && activitiesReleased) {
      setActivitiesModalOpen(true);
    }
  }, [activitiesReleased, initialModal, params.modal, requestsReleased]);

  useEffect(() => {
    const action = typeof params.action === 'string' ? params.action : null;
    if (!action) return;

    if (action === 'upload') {
      setUploadModalOpen(true);
    } else if (action === 'nachweise') {
      router.push('/portal/client/proofs' as never);
    } else if (action === 'termin_aendern' || action === 'zusatztermin' || action === 'rueckruf') {
      setRequestModal(action as PortalRequestType);
    }
  }, [params.action, router]);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    const result = await fetchAssistDashboardData(context);
    if (result.ok) {
      setDashboard(result.data);
    } else if (!silent) {
      setError(result.error);
    }
    if (!silent) {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  usePortalAssistRealtime(context.tenantId, context.clientId, () => {
    void loadDashboard(true);
  });

  const handleRefresh = async () => {
    await loadDashboard();
    onRefresh?.();
  };

  const submitRequest = async (
    requestType: PortalRequestType,
    structuredPayload?: PortalStructuredRequestPayload,
  ) => {
    setSubmitting(true);
    const description =
      structuredPayload && isPortalFormRequestType(requestType)
        ? buildPortalRequestDescription(requestType, structuredPayload)
        : null;
    const payload =
      structuredPayload && isPortalFormRequestType(requestType)
        ? serializePortalRequestPayload(requestType, structuredPayload)
        : undefined;

    const result = await createPortalRequest({
      tenantId: context.tenantId,
      clientId: context.clientId,
      portalUserId: actorId,
      moduleKey: 'assist',
      requestType,
      title: resolvePortalRequestTypeLabel(requestType),
      description,
      payload,
    });
    setSubmitting(false);

    if (result.ok) {
      setRequestModal(null);
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
    if (action.key === 'upload') {
      setUploadModalOpen(true);
      return;
    }
    if (action.key === 'nachweise') {
      setProofsModalOpen(true);
      return;
    }
    setRequestModal(action.key as PortalRequestType);
  };

  if (loading && !dashboard) {
    return <LoadingState message="Klient:innenportal wird geladen…" />;
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
          <SuccessState message="Ihre Anfrage wurde übermittelt." />
        ) : null}
        {uploadSuccess ? (
          <SuccessState message="Dokument wurde hochgeladen und zur Prüfung gesendet." />
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
            label="Einsätze"
            description="Anstehend"
            value={data.kpis.appointments}
            emptyMessage="Keine Einsätze geplant."
            ctaLabel="Zusatzeinsatz"
            onCta={() => setRequestModal('zusatztermin')}
            onPress={() => router.push('/portal/client/appointments' as never)}
          />
          <PortalKpiCard
            label="Nachrichten"
            description="Threads"
            value={data.kpis.messages}
            emptyMessage="Noch keine Nachrichten."
            ctaLabel="Verwaltung anschreiben"
            onCta={() => router.push('/portal/client/messages?compose=1' as never)}
            onPress={() => router.push('/portal/client/messages' as never)}
          />
          <PortalKpiCard
            label="Dokumente"
            description="Freigegeben"
            value={data.kpis.documents}
            emptyMessage="Noch keine Dokumente."
            ctaLabel="Dokument hochladen"
            onCta={() => setUploadModalOpen(true)}
            onPress={() => router.push('/portal/client/documents' as never)}
          />
          <PortalKpiCard
            label="Nachweise"
            description="Offen"
            value={data.kpis.proofs}
            emptyMessage="Keine Nachweise offen."
            ctaLabel="Nachweise anzeigen"
            onCta={() => router.push('/portal/client/proofs' as never)}
            onPress={() => router.push('/portal/client/proofs' as never)}
          />
          <PortalKpiCard
            label="Unterschriften"
            description="Ausstehend"
            value={data.kpis.signatures}
            emptyMessage="Keine Unterschriften ausstehend."
            onPress={() => router.push('/portal/client/documents/signatures' as never)}
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
            onCta={openZusatzterminRequest}
            onPress={openRequestsModal}
            hidden={!requestsReleased}
          />
          <PortalKpiCard
            label="Aktivitäten"
            description="Neu"
            value={data.kpis.activities}
            emptyMessage="Noch keine Aktivitäten."
            onPress={openActivitiesModal}
            hidden={!activitiesReleased}
          />
          <PortalKpiCard
            label="Begleitungen"
            description="Geplant"
            value={data.kpis.begleitungen}
            emptyMessage="Keine Begleitungen geplant."
            hidden={!tripsReleased || !data.kpis.begleitungen}
            onPress={() => router.push('/portal/client?module=assist&section=begleitungen' as never)}
          />
        </View>

        <PortalQuickActions onAction={handleQuickAction} actions={quickActions} />

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
      </ScrollView>

      <PortalDocumentUploadModal
        visible={uploadModalOpen}
        tenantId={context.tenantId}
        clientId={context.clientId}
        portalUserId={actorId}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          setUploadSuccess(true);
          setTimeout(() => setUploadSuccess(false), 2500);
          void loadDashboard();
        }}
      />

      <PortalServiceProofsModal
        visible={proofsModalOpen}
        tenantId={context.tenantId}
        clientId={context.clientId}
        portalUserId={actorId}
        onClose={() => setProofsModalOpen(false)}
      />

      <PortalOpenRequestsModal
        visible={openRequestsModalOpen}
        requests={data.openRequests}
        onClose={() => {
          setOpenRequestsModalOpen(false);
          clearModalRoute();
        }}
        onNewRequest={() => {
          setOpenRequestsModalOpen(false);
          openZusatzterminRequest();
        }}
      />

      <PortalActivitiesModal
        visible={activitiesModalOpen}
        activities={data.activities}
        onClose={() => {
          setActivitiesModalOpen(false);
          clearModalRoute();
        }}
      />

      {requestModal && isPortalFormRequestType(requestModal) ? (
        <PortalRequestFormModal
          visible
          requestType={requestModal}
          careContexts={context.careProfile.careContexts}
          upcomingAppointments={data.upcomingAppointments}
          contactPhone={data.contactPhone}
          submitting={submitting}
          onClose={() => setRequestModal(null)}
          onSubmit={(payload) => void submitRequest(requestModal, payload)}
        />
      ) : null}
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
});
