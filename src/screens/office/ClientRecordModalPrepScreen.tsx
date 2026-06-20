import { StyleSheet, View } from 'react-native';
import { ClientRecordScreen } from '@/screens/business/office/ClientRecordScreen';
import { EmptyState, PremiumButton } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import type { ModuleNavModalComponentProps } from '@/lib/navigation/modulenav/modalscreens';
import { useRouter } from 'expo-router';

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
      <ClientRecordScreen
        clientId={clientId}
        embedded
        embeddedInModal
        initialTabOverride="leistungsbereiche"
      />
      <PremiumButton
        title="Vollständige Office-Akte öffnen"
        variant="secondary"
        onPress={() => router.push(clientRecordRoute(clientId) as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: careSpacing.md, flex: 1 },
});
