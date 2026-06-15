import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProtocolDetailHero } from '@/components/beratung';
import { ModuleExtensionNavStrip } from '@/components/navigation/ModuleExtensionNavStrip';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useProtocolDetail } from '@/hooks/useProtocolDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { spacing, typography } from '@/theme';

export function ProtocolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'counselor';
  const { data, loading, error, refresh, notFound } = useProtocolDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Protokoll" subtitle="Wird geladen…">
        <LoadingState message="Protokoll wird geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error || !data) {
    return (
      <ScreenShell title="Protokoll" subtitle="Fehler">
        <ErrorState message={error ?? 'Protokoll nicht gefunden.'} onRetry={refresh} />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={data.caseSubject}
      subtitle={`${roleLabel ?? 'Demo'} · ${new Date(data.recordedAt).toLocaleDateString('de-DE')}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ProtocolDetailHero protocol={data} roleKey={roleKey} />
      <ModuleExtensionNavStrip productKey="beratung" currentPath="/beratung/protokolle" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionPanel title="Protokollinhalt">
          <Text style={styles.content}>{data.content}</Text>
        </SectionPanel>
        <PremiumButton
          title="Zur Fallakte"
          variant="secondary"
          onPress={() => router.push(`/beratung/cases/${data.caseId}` as never)}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  content: { ...typography.body, lineHeight: 22 },
});
