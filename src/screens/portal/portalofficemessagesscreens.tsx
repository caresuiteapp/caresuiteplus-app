import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PortalOfficeMessenger } from '@/components/portal/portalofficemessenger';
import { PortalOfficeThread } from '@/components/portal/portalofficethread';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { usePermissions } from '@/hooks/usePermissions';
import { careSpacing } from '@/design/tokens/spacing';
function ClientPortalVerwaltungMessages() {
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const initialComposeOpen = compose === '1' || compose === 'true';

  return (
    <PortalTabScreen
      title="Nachrichten"
      subtitle="Schreiben Sie direkt an Ihr Pflegebüro — Antworten erscheinen hier im Chat."
      hideHeaderOnPhone
      scroll={false}
    >
      <View style={styles.clientMessages}>
        <PortalOfficeMessenger
          audience="client"
          variant="default"
          initialComposeOpen={initialComposeOpen}
        />
      </View>
    </PortalTabScreen>
  );
}

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

  return <ClientPortalVerwaltungMessages />;
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
    <PortalTabScreen
      title="Nachrichten"
      subtitle="Schreiben Sie der Verwaltung — Antworten erscheinen hier im Chat."
      hideHeaderOnPhone
      scroll={false}
    >
      <View style={styles.employeeMessages}>
        <PortalOfficeMessenger audience="employee" variant="default" />
      </View>
    </PortalTabScreen>
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
    <PortalTabScreen title="Chat" hideHeaderOnPhone scroll={false}>
      <View style={styles.thread}>
        <PortalOfficeThread threadId={resolvedId} variant="default" />
      </View>
    </PortalTabScreen>
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
    <ScreenShell title="Chat an die Verwaltung" showBack>
      <View style={styles.thread}>
        <PortalOfficeThread threadId={resolvedId} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  clientMessages: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
    gap: careSpacing.md,
  },
  employeeMessages: {    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
    gap: careSpacing.md,
  },
  thread: { flex: 1, minHeight: 0, paddingHorizontal: careSpacing.md },
});
