import { StyleSheet, View } from 'react-native';
import { EmptyState } from '@/components/ui';
import { OfficePortalApprovalsInbox } from '@/components/office/OfficePortalApprovalsInbox';
import { careSpacing } from '@/design/tokens/spacing';
import type { ModuleNavModalComponentProps } from '@/lib/navigation/modulenav/modalscreens';

/** Modal prep — tenant-wide portal approval inbox. */
export function PortalApprovalModalPrepScreen({ payload }: ModuleNavModalComponentProps = {}) {
  const clientId = payload?.clientId ? String(payload.clientId) : undefined;

  return (
    <View style={styles.root}>
      <OfficePortalApprovalsInbox clientId={clientId} limit={30} />
      {!clientId ? (
        <EmptyState
          title="Mandanten-Inbox"
          message="Offene Nachweise und Uploads mandantenweit. Für klientenspezifische Zugangsanfragen die Klient:innen-Akte öffnen."
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: careSpacing.md },
});
