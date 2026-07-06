import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AssistPortalShell } from '@/components/portal/assist/AssistPortalShell';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { PortalOfficeMessenger } from '@/components/portal/portalofficemessenger';
import { PortalOfficeThread } from '@/components/portal/portalofficethread';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { usePortalOfficeMessages } from '@/hooks/useportalofficemessages';
import { usePermissions } from '@/hooks/usePermissions';
import { careSpacing } from '@/design/tokens/spacing';

function ClientPortalVerwaltungMessages() {
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const initialComposeOpen = compose === '1' || compose === 'true';
  const { threads } = usePortalOfficeMessages('open');
  const unreadCount = threads.reduce((sum, thread) => sum + (thread.unreadCount ?? 0), 0);

  return (
    <AssistPortalShell>
      <View style={styles.glassWrap}>
        <PortalGlassHero
          eyebrow="VERWALTUNG"
          title="Nachrichten"
          subtitle="Schreiben Sie direkt an Ihr Pflegebüro — Antworten erscheinen hier im Chat."
          meta={`${threads.length} ${threads.length === 1 ? 'Chat' : 'Chats'}${unreadCount > 0 ? ` · ${unreadCount} ungelesen` : ''}`}
          badge="Live"
        />
        <PortalOfficeMessenger
          audience="client"
          variant="glass"
          initialComposeOpen={initialComposeOpen}
        />
      </View>
    </AssistPortalShell>
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
    <AssistPortalShell>
      <View style={styles.thread}>
        <PortalOfficeThread threadId={resolvedId} variant="glass" />
      </View>
    </AssistPortalShell>
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
  glassWrap: {
    flex: 1,
    minHeight: 0,
    gap: careSpacing.md,
    paddingHorizontal: careSpacing.md,
    paddingBottom: careSpacing.md,
  },
  employeeMessages: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
    gap: careSpacing.md,
  },
  thread: { flex: 1, minHeight: 0, paddingHorizontal: careSpacing.md },
});
