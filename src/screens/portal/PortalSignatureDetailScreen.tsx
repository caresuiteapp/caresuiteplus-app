import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PremiumListHeroFrame } from '@/components/ui';
import {
  PortalSignatureCapturePanel,
  PortalSignatureMetaPanel,
} from '@/components/portal/PortalSignatureCapturePanel';
import { ErrorState, LoadingState } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { usePortalSignatureDetail } from '@/hooks/usePortalSignatureDetail';
import { spacing } from '@/theme';

export function PortalSignatureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can, check } = usePermissions();
  const documentId = typeof id === 'string' ? id : '';
  const { detail, loading, error, refresh, sign, signing } = usePortalSignatureDetail(documentId);

  const canView = can('portal.employee.signatures.view');
  const canSign = can('portal.employee.signatures.sign');

  if (!canView) {
    return (
      <ErrorState
        message={check('portal.employee.signatures.view').reason ?? 'Keine Berechtigung.'}
      />
    );
  }

  if (loading && !detail) {
    return <LoadingState message="Dokument wird geladen…" />;
  }

  if (error && !detail) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  if (!detail) {
    return <ErrorState message="Dokument nicht gefunden." />;
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <PremiumListHeroFrame>
        <Text style={styles.heroTitle}>{detail.title}</Text>
        <Text style={styles.heroSubtitle}>Unterschrift · Mitarbeiterportal</Text>
      </PremiumListHeroFrame>
      <View style={styles.content}>
        <PortalSignatureMetaPanel detail={detail} />
        <PortalSignatureCapturePanel
          detail={detail}
          disabled={!canSign || detail.status === 'completed'}
          loading={signing}
          onSign={sign}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  content: { gap: spacing.md, paddingHorizontal: spacing.md },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
});
