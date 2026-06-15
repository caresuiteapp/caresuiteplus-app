import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { HandoverDetailHero } from '@/components/stationaer';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useHandoverDetail } from '@/hooks/useHandoverDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { spacing, typography } from '@/theme';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE');
}

export function HandoverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const { data: handover, loading, error, refresh, notFound } = useHandoverDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Übergabebericht" subtitle="Wird geladen…">
        <LoadingState message="Details werden geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Übergabebericht" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Übergabebericht existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!handover) return null;

  return (
    <ScreenShell
      title={handover.shiftLabel}
      subtitle={`${handover.authorName} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <HandoverDetailHero handover={handover} roleKey={roleKey} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SectionPanel title="Übergabe">
          <DetailInfoRow label="Schicht" value={handover.shiftLabel} />
          <DetailInfoRow label="Bereich" value={handover.wing ?? '—'} />
          <DetailInfoRow label="Autor:in" value={handover.authorName} />
          <DetailInfoRow label="Zeitpunkt" value={formatDateTime(handover.handoverAt)} />
          <DetailInfoRow label="Priorität" value={handover.priorityLabel} />
          <DetailInfoRow label="Status" value={WORKFLOW_STATUS_LABELS[handover.status]} />
        </SectionPanel>
        <SectionPanel title="Inhalt">
          <Text style={styles.content}>{handover.content}</Text>
        </SectionPanel>
        {handover.recipientNames.length > 0 ? (
          <SectionPanel title="Empfänger:innen">
            {handover.recipientNames.map((name) => (
              <Text key={name} style={styles.recipient}>
                • {name}
              </Text>
            ))}
          </SectionPanel>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  content: { ...typography.body },
  recipient: { ...typography.body, marginBottom: spacing.xs },
});
