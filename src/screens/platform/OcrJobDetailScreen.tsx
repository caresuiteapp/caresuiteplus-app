import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { OcrJobDetailHero } from '@/components/platform';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useOcrJobDetail } from '@/hooks/useOcrJobDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

export function OcrJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data, loading, error, refresh, retry, retryLoading, successMessage, notFound } =
    useOcrJobDetail(id);

  if (loading) {
    return (
      <ScreenShell title="OCR-Job" subtitle="Wird geladen…">
        <LoadingState message="Job wird geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error || !data) {
    return (
      <ScreenShell title="OCR-Job" subtitle="Fehler">
        <ErrorState title="Fehler" message={error ?? 'Job nicht gefunden.'} onRetry={refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={data.sourceDocumentTitle}
      subtitle={`${roleLabel ?? 'Demo'} · ${data.providerKey}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      {successMessage ? <SuccessState message={successMessage} /> : null}
      <OcrJobDetailHero job={data} roleKey={roleKey} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <PremiumCard accentColor={colors.cyan}>
          <DetailInfoRow label="Status" value={WORKFLOW_STATUS_LABELS[data.status]} />
          <DetailInfoRow label="Dokument-ID" value={data.sourceDocumentId} />
          {data.confidence != null ? (
            <DetailInfoRow label="Konfidenz" value={`${Math.round(data.confidence * 100)}%`} />
          ) : null}
        </PremiumCard>
        {data.extractedText ? (
          <SectionPanel title="Extrahierter Text">
            <Text style={styles.text}>{data.extractedText}</Text>
          </SectionPanel>
        ) : null}
        {data.status === 'fehlerhaft' ? (
          <PremiumButton title="Erneut versuchen" onPress={retry} loading={retryLoading} />
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  text: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
});
