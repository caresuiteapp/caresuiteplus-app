import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AssistPortalShell } from '@/components/portal/assist/AssistPortalShell';
import { MobilePortalKpiCard } from '@/components/portal/assist/MobilePortalKpiCard';
import { MobilePortalSidebarCards } from '@/components/portal/assist/MobilePortalSidebarCards';
import { PortalActivitiesModal } from '@/components/portal/assist/PortalActivitiesModal';
import { PortalDocumentUploadModal } from '@/components/portal/assist/PortalDocumentUploadModal';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { PortalNextAppointmentHero } from '@/components/portal/assist/PortalNextAppointmentHero';
import { PortalOpenRequestsModal } from '@/components/portal/assist/PortalOpenRequestsModal';
import { PortalRequestFormModal } from '@/components/portal/assist/PortalRequestFormModal';
import { PortalServiceProofsModal } from '@/components/portal/assist/PortalServiceProofsModal';
import { careSpacing } from '@/design/tokens/spacing';
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
  resolvePortalTerminology,
} from '@/lib/portal/engine';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import type { PortalContext } from '@/lib/portal/types';
import type { AssistDashboardData, PortalRequestType } from '@/types/portal/assist';
import type { PortalStructuredRequestPayload } from '@/types/portal/requestPayloads';
import { ErrorState, LoadingState, SuccessState } from '@/components/ui';

type AssistOverviewModal = 'anfragen' | 'aktivitaeten';

type MobilePortalDashboardProps = {
  context: PortalContext;
  showSuccess?: boolean;
  onRefresh?: () => void;
  initialModal?: AssistOverviewModal | null;
};

/** Mobile-only (<768px) Assist portal overview — aurora glass dashboard layout. */
export function MobilePortalDashboard({
  context,
  showSuccess,
  onRefresh,
  initialModal = null,
}: MobilePortalDashboardProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ modal?: string; action?: string }>();
  const contentPadding = useMemo(
    () => ({
      paddingHorizontal: careSpacing.md,
      paddingBottom: PORTAL_MOBILE_NAV_HEIGHT + Math.max(insets.bottom, careSpacing.sm),
    }),
    [insets.bottom],
  );
  const { actorId } = usePortalActor();

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
  const releaseLabel =
    context.visibleFeatures.length > 0 ? 'Freigabe aktiv' : 'Freigabe ausstehend';
  const tripsReleased = canAccessPortalFeature(context, 'assist', 'trips');
  const proofsReleased = canAccessPortalFeature(context, 'assist', 'nachweise');
  const requestsReleased = canAccessPortalFeature(context, 'assist', 'anfragen');
  const activitiesReleased = canAccessPortalFeature(context, 'assist', 'aktivitaeten');

  const clearModalRoute = useCallback(() => {
    if (params.modal) {
      router.replace('/portal/client' as never);
    }
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
    } else if (action === 'nachweise' && proofsReleased) {
      setProofsModalOpen(true);
    } else if (action === 'termin_aendern' || action === 'zusatztermin' || action === 'rueckruf') {
      setRequestModal(action as PortalRequestType);
    }
  }, [params.action, proofsReleased]);

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
          <SuccessState message="Ihre Anfrage wurde übermittelt." />
        ) : null}
        {uploadSuccess ? (
          <SuccessState message="Dokument wurde hochgeladen und zur Prüfung gesendet." />
        ) : null}

        <PortalGlassHero
          leadingIcon={<Feather name="heart" size={22} color="#7B61FF" />}
          title={`${terminology.greetingLabel},`}
          titleSecondary={context.displayName}
          subtitle={context.tenantName}
          meta={`${terminology.moduleLabel} · Rolle: ${terminology.personLabel} · ${releaseLabel}`}
          badge={terminology.moduleLabel}
          showStatusDot
        />

        <PortalNextAppointmentHero
          appointment={data.nextAppointment}
          onRequestChange={() => setRequestModal('termin_aendern')}
          onRequestExtra={() => setRequestModal('zusatztermin')}
          emptyActionLabel="Termin anfragen"
        />

        <View style={styles.kpiGrid}>
          <MobilePortalKpiCard
            icon="📅"
            label="Termine"
            value={data.kpis.appointments}
            emptyMessage="Keine Termine geplant."
            ctaLabel="Termin anfragen →"
            accentColor="#4CC9F0"
            onCta={() => setRequestModal('zusatztermin')}
            onPress={() => router.push('/portal/client/appointments' as never)}
          />
          <MobilePortalKpiCard
            icon="💬"
            label="Nachrichten"
            value={data.kpis.messages}
            emptyMessage="Keine neuen Nachrichten."
            ctaLabel="Nachrichten öffnen →"
            accentColor="#7B61FF"
            onCta={() => router.push('/portal/client/messages' as never)}
            onPress={() => router.push('/portal/client/messages' as never)}
          />
          <MobilePortalKpiCard
            icon="📄"
            label="Dokumente"
            value={data.kpis.documents}
            emptyMessage="Keine neuen Dokumente."
            ctaLabel="Dokumente öffnen →"
            accentColor="#FF9500"
            onCta={() => router.push('/portal/client/documents' as never)}
            onPress={() => router.push('/portal/client/documents' as never)}
          />
          <MobilePortalKpiCard
            icon="📋"
            label="Nachweise"
            value={data.kpis.proofs}
            emptyMessage="Keine Nachweise offen."
            ctaLabel="Nachweise anzeigen →"
            accentColor="#2DD4BF"
            onCta={() => setProofsModalOpen(true)}
            onPress={() => setProofsModalOpen(true)}
            hidden={!proofsReleased}
          />
          <MobilePortalKpiCard
            icon="✍️"
            label="Unterschriften"
            value={data.kpis.signatures}
            emptyMessage="Keine Unterschriften ausstehend."
            ctaLabel="Anzeigen →"
            accentColor="#F472B6"
            onCta={() => router.push('/portal/client/documents' as never)}
            onPress={() => router.push('/portal/client/documents' as never)}
          />
          <MobilePortalKpiCard
            icon="📨"
            label="Anfragen"
            value={data.kpis.openRequests}
            emptyMessage="Keine offenen Anfragen."
            metricSubtitle="Offene Anfrage"
            ctaLabel="Anzeigen →"
            accentColor="#FFD166"
            onCta={openRequestsModal}
            onPress={openRequestsModal}
            hidden={!requestsReleased}
          />
          <MobilePortalKpiCard
            icon="📰"
            label="Aktivitäten"
            value={data.kpis.activities}
            emptyMessage="Noch keine Aktivitäten."
            metricSubtitle="Letzte 30 Tage"
            ctaLabel="Anzeigen →"
            accentColor="#60A5FA"
            onCta={openActivitiesModal}
            onPress={openActivitiesModal}
            hidden={!activitiesReleased}
          />
          <MobilePortalKpiCard
            icon="🚗"
            label="Begleitungen"
            value={data.kpis.begleitungen}
            emptyMessage="Keine Begleitungen geplant."
            ctaLabel="Mehr erfahren →"
            accentColor="#34D399"
            hidden={!tripsReleased}
            onCta={() => router.push('/portal/client?module=assist&section=begleitungen' as never)}
            onPress={() => router.push('/portal/client?module=assist&section=begleitungen' as never)}
          />
        </View>

        <MobilePortalSidebarCards />
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
          clearModalRoute();
          setRequestModal('sonstiges');
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
    gap: careSpacing.sm,
    width: '100%',
    maxWidth: '100%',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
    width: '100%',
    justifyContent: 'space-between',
  },
});
