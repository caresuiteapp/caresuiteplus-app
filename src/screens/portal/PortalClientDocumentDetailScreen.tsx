import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { PortalDocumentDetailHero } from '@/components/portal';
import { CareLightPageShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  SuccessState,
} from '@/components/ui';
import { usePortalDocumentDetail } from '@/hooks/usePortalDocumentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

export function PortalClientDocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canView = can('portal.client.documents.view');
  const canDownload = can('portal.client.documents.download');

  const {
    data,
    loading,
    error,
    refresh,
    download,
    downloadLoading,
    downloadError,
    successMessage,
    notFound,
  } = usePortalDocumentDetail(id);

  if (!canView) {
    return (
      <CareLightPageShell title="Dokument" subtitle={roleLabel ?? 'Portal'}>
        <LockedActionBanner
          message={check('portal.client.documents.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </CareLightPageShell>
    );
  }

  if (loading) {
    return (
      <CareLightPageShell title="Dokument" subtitle="Wird geladen…">
        <LoadingState message="Dokument wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (notFound || error) {
    return (
      <CareLightPageShell title="Dokument" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Das Dokument existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  if (!data) return null;

  return (
    <CareLightPageShell
      title={data.title}
      subtitle={data.fileName}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {successMessage ? <SuccessState message={successMessage} /> : null}

        <PortalDocumentDetailHero document={data} scope="client" />

        {downloadError ? <Text style={styles.error}>{downloadError}</Text> : null}

        {data.downloadReady && canDownload ? (
          <PremiumButton
            title="Herunterladen"
            onPress={() => download()}
            loading={downloadLoading}
          />
        ) : data.downloadReady ? (
          <LockedActionBanner
            message={check('portal.client.documents.download').reason ?? 'Keine Berechtigung.'}
            roleLabel={roleLabel}
          />
        ) : (
          <Text style={styles.hint}>Download derzeit nicht verfügbar.</Text>
        )}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
