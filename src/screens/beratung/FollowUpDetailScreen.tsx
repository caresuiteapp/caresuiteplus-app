import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FollowUpDetailHero } from '@/components/beratung';
import { ModuleExtensionNavStrip } from '@/components/navigation/ModuleExtensionNavStrip';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useFollowUpDetail } from '@/hooks/useFollowUpDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { spacing, typography } from '@/theme';

export function FollowUpDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'counselor';
  const { data, loading, error, refresh, notFound } = useFollowUpDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Wiedervorlage" subtitle="Wird geladen…">
        <LoadingState message="Wiedervorlage wird geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error || !data) {
    return (
      <ScreenShell title="Wiedervorlage" subtitle="Fehler">
        <ErrorState message={error ?? 'Wiedervorlage nicht gefunden.'} onRetry={refresh} />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={data.caseSubject}
      subtitle={`Fällig ${new Date(data.dueAt).toLocaleDateString('de-DE')} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <FollowUpDetailHero followUp={data} roleKey={roleKey} />
      <ModuleExtensionNavStrip productKey="beratung" currentPath="/beratung/wiedervorlagen" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {data.note ? (
          <SectionPanel title="Notiz">
            <Text style={styles.content}>{data.note}</Text>
          </SectionPanel>
        ) : null}
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
