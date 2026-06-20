import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ClientDetailSummaryPanel } from '@/components/office/ClientDetailSummaryPanel';
import { EmptyState, PremiumButton } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import type { ModuleNavModalComponentProps } from '@/lib/navigation/modulenav/modalscreens';

export function ClientRecordModalPrepScreen({ payload }: ModuleNavModalComponentProps = {}) {
  const router = useRouter();
  const clientId = String(payload?.clientId ?? '');

  if (!clientId) {
    return (
      <EmptyState
        title="Kein Datensatz"
        message="Klient:innen-ID fehlt — öffnen Sie die Akte aus der Liste erneut."
      />
    );
  }

  return (
    <View style={styles.root}>
      <ClientDetailSummaryPanel
        clientId={clientId}
        onOpenFullRecord={() => router.push(clientRecordRoute(clientId) as never)}
      />
      <PremiumButton
        title="Vollständige Office-Akte öffnen"
        onPress={() => router.push(clientRecordRoute(clientId) as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: careSpacing.md },
});
