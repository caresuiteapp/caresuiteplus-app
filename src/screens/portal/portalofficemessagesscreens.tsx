import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PortalOfficeMessenger } from '@/components/portal/portalofficemessenger';
import { PortalOfficeThread } from '@/components/portal/portalofficethread';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { spacing } from '@/theme';

export function ClientPortalOfficeMessagesScreen() {
  const { can, check } = usePermissions();
  if (!can('portal.client.messages.view')) {
    return (
      <ScreenShell title="Nachrichten" subtitle="Klient:innenportal" showBack={false}>
        <LockedActionBanner
          message={check('portal.client.messages.view').reason ?? 'Keine Berechtigung.'}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Nachrichten" subtitle="Klient:innenportal · Büro" showBack={false}>
      <PortalOfficeMessenger audience="client" />
    </ScreenShell>
  );
}

export function EmployeePortalOfficeMessagesScreen() {
  const { can, check } = usePermissions();
  if (!can('portal.employee.messages.view')) {
    return (
      <ScreenShell title="Nachrichten" subtitle="Mitarbeiter:innenportal" showBack={false}>
        <LockedActionBanner
          message={check('portal.employee.messages.view').reason ?? 'Keine Berechtigung.'}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Nachrichten" subtitle="Mitarbeiter:innenportal · Büro" showBack={false}>
      <PortalOfficeMessenger audience="employee" />
    </ScreenShell>
  );
}

export function ClientPortalOfficeConversationScreen() {
  const { threadId, id } = useLocalSearchParams<{ threadId?: string; id?: string }>();
  const resolvedId = threadId ?? id ?? null;
  const { can, check } = usePermissions();

  if (!can('portal.client.messages.view')) {
    return (
      <ScreenShell title="Chat" showBack>
        <LockedActionBanner
          message={check('portal.client.messages.view').reason ?? 'Keine Berechtigung.'}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Chat ans Büro" showBack>
      <View style={styles.thread}>
        <PortalOfficeThread threadId={resolvedId} />
      </View>
    </ScreenShell>
  );
}

export function EmployeePortalOfficeConversationScreen() {
  const { threadId, id } = useLocalSearchParams<{ threadId?: string; id?: string }>();
  const resolvedId = threadId ?? id ?? null;
  const { can, check } = usePermissions();

  if (!can('portal.employee.messages.view')) {
    return (
      <ScreenShell title="Chat" showBack>
        <LockedActionBanner
          message={check('portal.employee.messages.view').reason ?? 'Keine Berechtigung.'}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Chat ans Büro" showBack>
      <View style={styles.thread}>
        <PortalOfficeThread threadId={resolvedId} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  thread: { flex: 1, minHeight: 400 },
});
