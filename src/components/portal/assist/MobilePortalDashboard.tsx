import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AssistPortalShell } from '@/components/portal/assist/AssistPortalShell';
import { ClientPortalHomeDashboard } from '@/components/portal/assist/ClientPortalHomeDashboard';
import { PortalActivitiesModal } from '@/components/portal/assist/PortalActivitiesModal';
import { PortalDocumentUploadModal } from '@/components/portal/assist/PortalDocumentUploadModal';
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
import { canAccessPortalFeature } from '@/lib/portal/engine';
import type { PortalContext } from '@/lib/portal/types';
import type { AssistDashboardData, PortalRequestType } from '@/types/portal/assist';
import type { PortalStructuredRequestPayload } from '@/types/portal/requestPayloads';
import { ErrorState, LoadingState, SuccessState } from '@/components/ui';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';

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
  const router = useRouter();
  const params = useLocalSearchParams<{ modal?: string; action?: string }>();
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
  const [requestError, setRequestError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const tripsReleased = canAccessPortalFeature(context, 'assist', 'trips');
  const budgetReleased = canAccessPortalFeature(context, 'assist', 'budget');
  const proofsReleased = canAccessPortalFeature(context, 'assist', 'nachweise');
  const requestsReleased = canAccessPortalFeature(context, 'assist', 'anfragen');
  const activitiesReleased = canAccessPortalFeature(context, 'assist', 'aktivitaeten');

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
      setError(
        toPortalUserFacingError(
          result.error,
          'Ihre Übersicht konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
        ),
      );
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
    if (submitting) return;
    setSubmitting(true);
    setRequestError(null);
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
      setRequestError(
        toPortalUserFacingError(
          result.error,
          'Ihre Anfrage konnte gerade nicht gesendet werden. Bitte versuchen Sie es erneut.',
        ),
      );
    }
  };

  if (loading && !dashboard) {
    return <LoadingState message="Klient:innenportal wird geladen…" />;
  }

  if (error && !dashboard) {
    return (
      <ErrorState
        title="Klient:innenportal nicht geladen"
        message={error}
        onRetry={handleRefresh}
      />
    );
  }

  const data = dashboard!;

  return (
    <AssistPortalShell>
      <View style={styles.container}>
        {showSuccess || localSuccess ? (
          <SuccessState message="Ihre Anfrage wurde übermittelt." />
        ) : null}
        {uploadSuccess ? (
          <SuccessState message="Dokument wurde hochgeladen und zur Prüfung gesendet." />
        ) : null}

        <ClientPortalHomeDashboard
          context={context}
          data={data}
          tripsReleased={tripsReleased}
          budgetReleased={budgetReleased}
          proofsReleased={proofsReleased}
          requestsReleased={requestsReleased}
          activitiesReleased={activitiesReleased}
          onRequestChange={() => setRequestModal('termin_aendern')}
          onRequestExtra={openZusatzterminRequest}
          onUpload={() => setUploadModalOpen(true)}
          onProofs={() => setProofsModalOpen(true)}
          onOpenRequests={openRequestsModal}
          onOpenActivities={openActivitiesModal}
          onRequestCallback={() => setRequestModal('rueckruf')}
        />
      </View>

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
          submitError={requestError}
          onClose={() => {
            setRequestError(null);
            setRequestModal(null);
          }}
          onSubmit={(payload) => void submitRequest(requestModal, payload)}
        />
      ) : null}
    </AssistPortalShell>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.lg,
    width: '100%',
    maxWidth: '100%',
  },
});
