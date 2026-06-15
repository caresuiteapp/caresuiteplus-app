import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AiJobDetailHero } from '@/components/platform';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAiJobDetail } from '@/hooks/useAiJobDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { spacing, typography } from '@/theme';

export function AiJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data, loading, error, refresh, notFound } = useAiJobDetail(id);

  if (loading) {
    return (
      <ScreenShell title="KI-Job" subtitle="Wird geladen…">
        <LoadingState message="Job wird geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error || !data) {
    return (
      <ScreenShell title="KI-Job" subtitle="Fehler">
        <ErrorState title="Fehler" message={error ?? 'Job nicht gefunden.'} onRetry={refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={data.promptSummary}
      subtitle={`${roleLabel ?? 'Demo'} · ${data.providerKey}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <AiJobDetailHero job={data} roleKey={roleKey} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {data.resultSummary ? (
          <SectionPanel title="Ergebnis">
            <Text style={styles.text}>{data.resultSummary}</Text>
          </SectionPanel>
        ) : (
          <SectionPanel title="Ergebnis">
            <Text style={styles.text}>Noch kein Ergebnis — Job läuft oder ist ausstehend.</Text>
          </SectionPanel>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  text: { ...typography.body, lineHeight: 22 },
});
