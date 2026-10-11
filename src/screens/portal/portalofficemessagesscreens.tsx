import { useEffect } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { PortalOfficeMessenger } from '@/components/portal/portalofficemessenger';
import { PortalOfficeThread } from '@/components/portal/portalofficethread';
import { LockedActionBanner } from '@/components/permissions';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { usePermissions } from '@/hooks/usePermissions';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { usePortalMessengerFocus } from '@/lib/portal/portalMessengerFocusContext';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';

function resolveRouteParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

function useDirectConversationBack(audience: 'client' | 'employee', active: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!active || Platform.OS === 'web') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace(`/portal/${audience}/messages` as never);
      return true;
    });
    return () => listener.remove();
  }, [active, audience, router]);
}

function ClientPortalVerwaltungMessages() {
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const initialComposeOpen = compose === '1' || compose === 'true';
  const { active: messengerFocusActive, closeThread } = usePortalMessengerFocus();

  useEffect(() => () => closeThread(), [closeThread]);

  return (
    <PortalTabScreen title="Nachrichten" hideHeaderOnPhone scroll={false}>
      <View style={[styles.clientMessages, messengerFocusActive ? styles.clientMessagesFocus : null]}>
        {!messengerFocusActive ? (
          <PortalGlassHero
            title="Nachrichten"
            subtitle="Schreiben Sie direkt an Ihr Pflegebüro — Antworten erscheinen hier im Chat."
            showStatusDot
          />
        ) : null}
        <PortalOfficeMessenger
          audience="client"
          variant="glass"
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
      <PortalTabScreen title="Nachrichten" subtitle="Klient:innenportal">
        <LockedActionBanner
          message={check('portal.client.messages.view').reason ?? 'Keine Berechtigung.'}
        />
      </PortalTabScreen>
    );
  }

  return <ClientPortalVerwaltungMessages />;
}

export function EmployeePortalOfficeMessagesScreen() {
  const { can, check } = usePermissions();
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const { active: messengerFocusActive, closeThread } = usePortalMessengerFocus();
  useEffect(() => () => closeThread(), [closeThread]);
  if (!can('portal.employee.messages.view')) {
    return (
      <PortalTabScreen title="Nachrichten" subtitle="Mitarbeiter:innenportal">
        <LockedActionBanner
          message={check('portal.employee.messages.view').reason ?? 'Keine Berechtigung.'}
        />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen
      title="Nachrichten"
      subtitle="Direkt, sicher und immer aktuell mit Verwaltung und Team verbunden."
      hideHeaderOnPhone
      scroll={false}
    >
      <View style={styles.employeeMessages}>
        {!messengerFocusActive ? <PortalGlassHero
          title="Ihre Gespräche"
          subtitle="Alles Wichtige an einem Ort – neue Antworten erscheinen sofort."
          showStatusDot
        />
        : null}
        <PortalOfficeMessenger audience="employee" variant="glass" initialComposeOpen={compose === '1' || compose === 'true'} />
      </View>
    </PortalTabScreen>
  );
}

export function ClientPortalOfficeConversationScreen() {
  const { threadId, id } = useLocalSearchParams<{ threadId?: string | string[]; id?: string | string[] }>();
  const resolvedId = resolveRouteParam(threadId) ?? resolveRouteParam(id);
  const router = useRouter();
  const { can, check } = usePermissions();
  const { setActive: setMessengerFocusActive } = usePortalMessengerFocus();
  const { useMasterDetail } = usePlatformLayout();
  const { c } = useCareLightPalette();
  const screenFocused = useIsFocused();
  const showMobileChrome = !useMasterDetail && !!resolvedId;
  useDirectConversationBack('client', screenFocused && showMobileChrome);

  useEffect(() => {
    if (!screenFocused || !resolvedId || useMasterDetail) return;
    setMessengerFocusActive(true);
    return () => setMessengerFocusActive(false);
  }, [screenFocused, resolvedId, useMasterDetail, setMessengerFocusActive]);

  if (!can('portal.client.messages.view')) {
    return (
      <PortalTabScreen title="Chat">
        <LockedActionBanner
          message={check('portal.client.messages.view').reason ?? 'Keine Berechtigung.'}
        />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen title="Chat" hideHeaderOnPhone scroll={false}>
      <View style={styles.thread} testID={showMobileChrome ? 'messenger-mobile-thread' : undefined}>
        {showMobileChrome ? (
          <View style={conversationChromeStyles.bar}>
            <Pressable
              onPress={() => router.replace('/portal/client/messages' as never)}
              style={conversationChromeStyles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Zurück zur Liste"
              testID="messenger-back-to-list"
            >
              <Text style={[conversationChromeStyles.backLabel, { color: c.violet }]}>← Liste</Text>
            </Pressable>
          </View>
        ) : null}
        <PortalOfficeThread
          threadId={resolvedId}
          variant="glass"
          hideHeader={showMobileChrome}
          onNewThreadStarted={(newThreadId) =>
            router.replace(`/portal/client/messages/${newThreadId}` as never)}
        />
      </View>
    </PortalTabScreen>
  );
}
export function EmployeePortalOfficeConversationScreen() {
  const { threadId, id } = useLocalSearchParams<{ threadId?: string | string[]; id?: string | string[] }>();
  const resolvedId = resolveRouteParam(threadId) ?? resolveRouteParam(id);
  const router = useRouter();
  const { can, check } = usePermissions();
  const { setActive: setMessengerFocusActive } = usePortalMessengerFocus();
  const { useMasterDetail } = usePlatformLayout();
  const { c } = useCareLightPalette();
  const screenFocused = useIsFocused();
  const showMobileChrome = !useMasterDetail && !!resolvedId;
  useDirectConversationBack('employee', screenFocused && showMobileChrome);

  useEffect(() => {
    if (!screenFocused || !resolvedId || useMasterDetail) return;
    setMessengerFocusActive(true);
    return () => setMessengerFocusActive(false);
  }, [screenFocused, resolvedId, useMasterDetail, setMessengerFocusActive]);

  if (!can('portal.employee.messages.view')) {
    return (
      <PortalTabScreen title="Chat">
        <LockedActionBanner
          message={check('portal.employee.messages.view').reason ?? 'Keine Berechtigung.'}
        />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen title="Chat" hideHeaderOnPhone scroll={false}>
      <View style={styles.thread} testID={showMobileChrome ? 'messenger-mobile-thread' : undefined}>
        {showMobileChrome ? (
          <View style={conversationChromeStyles.bar}>
            <Pressable
              onPress={() => router.replace('/portal/employee/messages' as never)}
              style={conversationChromeStyles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Zurück zur Liste"
              testID="messenger-back-to-list"
            >
              <Text style={[conversationChromeStyles.backLabel, { color: c.violet }]}>← Liste</Text>
            </Pressable>
          </View>
        ) : null}
        <PortalOfficeThread
          threadId={resolvedId}
          hideHeader={showMobileChrome}
          onNewThreadStarted={(newThreadId) =>
            router.replace(`/portal/employee/messages/${newThreadId}` as never)}
        />
      </View>
    </PortalTabScreen>
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
  clientMessagesFocus: {
    gap: 0,
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

const conversationChromeStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: careSpacing.sm,
  },
  backBtn: {
    paddingHorizontal: careSpacing.sm,
    paddingVertical: careSpacing.xs,
  },
  backLabel: {
    fontWeight: '700',
    fontSize: 15,
  },
});
