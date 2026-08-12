import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CareDocumentationDetailHero } from '@/components/pflege/CareDocumentationDetailHero';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { DetailInfoRow } from '@/components/detail';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchCareDocumentationDetail } from '@/lib/pflege/careDocumentationListService';
import { signClinicalDocumentation } from '@/lib/pflege/clinicalWorkflowService';
import {
  CARE_DOCUMENTATION_PREPARED_MESSAGE,
  CARE_DOCUMENTATION_PDF_PREPARED_MESSAGE,
  CARE_DOCUMENTATION_SIGN_PREPARED_MESSAGE,
  isCareDocumentationPdfReady,
  isCareDocumentationSignReady,
} from '@/lib/pflege/pflegeModuleConfig';
import { spacing, typography } from '@/theme';

export function CareDocumentationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, isReadOnly } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !id) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCareDocumentationDetail(id, tenantId, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );

  const detail = query.data;
  const signReady = isCareDocumentationSignReady();
  const pdfReady = isCareDocumentationPdfReady();

  async function sign() {
    if (!tenantId || !id) return;
    setSigning(true); setSignError(null);
    const result = await signClinicalDocumentation(tenantId, id, profile?.roleKey);
    setSigning(false);
    if (!result.ok) return setSignError(result.error);
    query.refresh();
  }

  if (query.loading && !detail) {
    return (
      <ScreenShell title="Pflegedokumentation" subtitle="Wird geladen…">
        <LoadingState message="Nachweis wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error || !detail) {
    return (
      <ScreenShell title="Pflegedokumentation" subtitle="Fehler">
        <ErrorState message={query.error ?? 'Nachweis nicht gefunden.'} onRetry={query.refresh} />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Pflegedokumentation" subtitle={`${detail.title} · ${roleLabel ?? 'Demo'}`}>
      <ScrollView contentContainerStyle={styles.content}>
        <CareDocumentationDetailHero detail={detail} roleKey={roleKey} isReadOnly={isReadOnly} />
        <PreparedModeBanner hint={CARE_DOCUMENTATION_PREPARED_MESSAGE} />
        {!signReady ? (
          <InfoBanner
            variant="warning"
            title="Signatur nicht verfügbar"
            message={CARE_DOCUMENTATION_SIGN_PREPARED_MESSAGE}
          />
        ) : null}
        {!pdfReady ? (
          <InfoBanner
            variant="warning"
            title="PDF-Export folgt"
            message={CARE_DOCUMENTATION_PDF_PREPARED_MESSAGE}
          />
        ) : null}

        <SectionPanel title="Inhalt" subtitle="Pflegenachweis">
          <Text style={styles.body}>{detail.content}</Text>
          {detail.location ? <DetailInfoRow label="Ort" value={detail.location} /> : null}
          {detail.durationMinutes != null ? (
            <DetailInfoRow label="Dauer" value={`${detail.durationMinutes} Min.`} />
          ) : null}
        </SectionPanel>

        {signError ? <ErrorState message={signError} /> : null}
        {!detail.hasSignature && signReady && !isReadOnly ? (
          <PremiumButton title="Dokumentation fachlich signieren" fullWidth loading={signing} disabled={signing} onPress={sign} />
        ) : detail.hasSignature ? (
          <InfoBanner variant="success" title="Fachlich signiert" message="Die Signatur wurde serverseitig mit Person und Zeitpunkt protokolliert." />
        ) : null}

        <PflegeCrossModuleLinksPanel context="care-documentation" />

        <PremiumButton title="Zurück zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  body: { ...typography.body },
});
