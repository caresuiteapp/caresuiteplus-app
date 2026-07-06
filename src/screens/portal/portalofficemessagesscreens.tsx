import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { PortalOfficeMessenger } from '@/components/portal/portalofficemessenger';
import { PortalOfficeThread } from '@/components/portal/portalofficethread';
import { ScreenShell } from '@/components/layout';
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

function ClientPortalVerwaltungMessages() {
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const initialComposeOpen = compose === '1' || compose === 'true';

  return (
    <PortalTabScreen title="Nachrichten" hideHeaderOnPhone scroll={false}>
      <View style={styles.clientMessages}>
        <PortalGlassHero
          title="Nachrichten"
          subtitle="Schreiben Sie direkt an Ihr Pflegebüro — Antworten erscheinen hier im Chat."
          showStatusDot
        />
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
  const { threadId, id } = useLocalSearchParams<{ threadId?: string | string[]; id?: string | string[] }>();
  const resolvedId = resolveRouteParam(threadId) ?? resolveRouteParam(id);
  const router = useRouter();
  const { can, check } = usePermissions();
  const { setActive: setMessengerFocusActive } = usePortalMessengerFocus();
  const { useMasterDetail } = usePlatformLayout();
  const { c } = useCareLightPalette();
  const showMobileChrome = !useMasterDetail && !!resolvedId;

  useEffect(() => {
    if (!resolvedId || useMasterDetail) return;
    setMessengerFocusActive(true);
    return () => setMessengerFocusActive(false);
  }, [resolvedId, useMasterDetail, setMessengerFocusActive]);

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
        <PortalOfficeThread threadId={resolvedId} variant="glass" hideHeader={showMobileChrome} />
      </View>
    </PortalTabScreen>
  );
}
export function EmployeePortalOfficeConversationScreen() {
  const { threadId, id } = useLocalSearchParams<{ threadId?: string | string[]; id?: string | string[] }>();
  const resolvedId = resolveRouteParam(threadId) ?? resolveRouteParam(id);
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
