import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  WoundDocumentationDetailHero,
} from '@/components/pflege/WoundDocumentationDetailHero';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { DetailInfoRow } from '@/components/detail';
import { ScreenShell } from '@/components/layout';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchWoundDocumentationDetail } from '@/lib/pflege/woundDocumentationDetailService';
import {
  isWoundBodyMapReady,
} from '@/lib/pflege/pflegeModuleConfig';
import { spacing, typography } from '@/theme';

export function WoundDocumentationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, isReadOnly } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !id) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchWoundDocumentationDetail(id, tenantId, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );

  const detail = query.data;
  const bodyMapReady = isWoundBodyMapReady();

  if (query.loading && !detail) {
    return (
      <ScreenShell title="Wunddokumentation" subtitle="Wird geladen…">
        <LoadingState message="Wundfall wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error || !detail) {
    return (
      <ScreenShell title="Wunddokumentation" subtitle="Fehler">
        <ErrorState message={query.error ?? 'Wundfall nicht gefunden.'} onRetry={query.refresh} />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Wunddokumentation"
      subtitle={`${detail.bodyLocation} · ${roleLabel ?? 'Demo'}`}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <WoundDocumentationDetailHero detail={detail} roleKey={roleKey} isReadOnly={isReadOnly} />

        <SectionPanel title="Aktionen" subtitle="BodyMap und Verlaufsfotos">
          <PremiumButton
            title="BodyMap öffnen"
            fullWidth
            disabled={!bodyMapReady || isReadOnly}
            onPress={() =>
              router.push(
                `/pflege/bodymap?clientId=${detail.clientId}&woundId=${detail.id}` as never,
              )
            }
          />
          <InfoBanner variant="info" title="Verlaufsmedien" message="Fotos werden ausschließlich über die gesicherte BodyMap-Medienablage referenziert." />
        </SectionPanel>

        <SectionPanel title="Wundstatus" subtitle="Lokalisation und Behandlung">
          <DetailInfoRow label="Klient:in" value={detail.clientName} />
          <DetailInfoRow label="Wundtyp" value={detail.woundType} />
          <DetailInfoRow label="Größe" value={detail.woundSize} />
          <DetailInfoRow label="Lokalisation" value={detail.bodyLocation} />
          <DetailInfoRow label="Behandlungsplan" value={detail.treatmentPlan} />
          <DetailInfoRow
            label="BodyMap"
            value={detail.bodyMapPrepared ? 'Markierung vorbereitet' : 'Nicht hinterlegt'}
          />
          <DetailInfoRow label="Verlaufsfotos" value={`${detail.photoCount} hochgeladen`} />
        </SectionPanel>

        <SectionPanel title="Beschreibung" subtitle="BodyMap und Verlauf (vorbereitet)">
          <Text style={styles.body}>{detail.description}</Text>
          <Text style={styles.note}>{detail.caregiverNotes}</Text>
        </SectionPanel>

        <PflegeCrossModuleLinksPanel context="wound" />

        {!isReadOnly ? <PremiumButton title="Wundverlauf dokumentieren" fullWidth onPress={() => router.push(`/pflege/wunden/${id}/assessment` as never)} /> : null}

        <PremiumButton title="Zurück zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  body: { ...typography.body, marginBottom: spacing.sm },
  note: { ...typography.caption },
});
