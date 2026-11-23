import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { useMemo, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, RequireAuth, RequireEmployeePasswordSetup, RequireRole } from '@/lib/auth';
import { EmployeePortalFrame } from '@/components/portal/employee/EmployeePortalFrame';
import { ClientPortalFrame } from '@/components/portal/client/ClientPortalFrame';
import { clientPortalActiveId } from '@/components/portal/client/clientPortalDesign';
import { EmployeePortalWorkspaceContext } from '@/components/portal/employee/EmployeePortalWorkspaceContext';
import { employeePortalActiveId, employeePortalDesign } from '@/components/portal/employee/employeePortalDesign';
import { employeePortalWorkspaceForPath } from '@/lib/portal/employee/employeePortalNavigation';
import { employeePortalWorkspaceLabels, type EmployeePortalWorkspace } from '@/lib/portal/employee/employeePortalWorkspaces';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePortalProfileAvatarForActor } from '@/hooks/usePortalProfileAvatar';
import { useEmployeePortalWorkspace } from '@/hooks/useEmployeePortalWorkspace';
import { usePortalOfficeMessages } from '@/hooks/useportalofficemessages';
import { useClientPortalSettings } from '@/hooks/useClientPortalSettings';
import { LiquidVisualModeProvider } from '../components/LiquidPrimitives';
import { useLiquidLayout } from '../foundation/useLiquidLayout';
import {
  releasedLiquidPortalNavigation,
  liquidPortalLoginRoutes,
  liquidPortalRoots,
  type LiquidPortalNavigationItem,
  type ProductPortalKind as PortalKind,
} from '../navigation/portalCatalog';
import { webScaledFontMetric } from '@/design/web/webFontSize';
import { usePortalVisualViewport } from '@/hooks/usePortalVisualViewport';
import { PortalPremiumProvider } from '@/design/tokens/portalPremium';
import { PortalMessengerFocusProvider, usePortalMessengerFocus } from '@/lib/portal/portalMessengerFocusContext';
import { PortalViewportContext } from '@/lib/portal/portalViewportContext';
import {
  employeePortalUsesAmbientWorkspace,
  isEmployeeVisitExecutionRoute,
  resolvePortalDesktopChrome,
} from '@/lib/portal/portalResponsiveLayout';

const transparentContent = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  width: '100%',
  overflow: 'hidden',
  backgroundColor: 'transparent',
} as const;

function PortalStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: transparentContent,
        animation: 'fade',
      }}
    />
  );
}

function EmployeePortalChrome({
  overlay, width, height, pathname, accountId, unreadCount, keyboardVisible, focus, insets, onSignOut,
}: {
  overlay?: ReactNode; width: number; height: number; pathname: string; accountId: string | null; unreadCount: number;
  keyboardVisible: boolean; focus: boolean; insets: { top: number; bottom: number };
  onSignOut: () => Promise<void>;
}) {
  const router = useRouter();
  const actor = usePortalActor();
  const avatar = usePortalProfileAvatarForActor(actor);
  const workspace = useEmployeePortalWorkspace(actor);
  const weatherAccount = accountId ?? actor.actorId;
  const weatherOwner = weatherAccount && Platform.OS !== 'web' ? JSON.stringify([actor.tenantId, weatherAccount]) : weatherAccount;
  const required = employeePortalWorkspaceForPath(pathname);
  const canOpen = !required || (!workspace.loading && workspace.available.includes(required));
  const different = canOpen && required && required !== workspace.selected ? required : null;
  const blocked = !canOpen || Boolean(different);
  const select = (key: EmployeePortalWorkspace) => {
    if (!workspace.available.includes(key)) return;
    workspace.select(key);
    if (required && required !== key) router.replace('/portal/employee');
  };
  return (
    <EmployeePortalWorkspaceContext.Provider value={{ ...workspace, select }}>
      <EmployeePortalFrame width={width} height={height} displayName={actor.displayName} weatherOwner={weatherOwner} {...avatar}
        navigation={workspace.navigation} activeId={employeePortalActiveId(pathname, workspace.navigation)}
        lightWorkspace={!blocked && !employeePortalUsesAmbientWorkspace(pathname)}
        unreadCount={unreadCount} keyboardVisible={keyboardVisible} focus={focus && !blocked}
        insets={insets} overlay={overlay}
        onNavigate={route => router.push(route as never)} onSignOut={onSignOut}>
        {blocked ? (
          <View style={styles.employeeModuleNotice} testID="employee-portal-module-route-guard">
            <Text accessibilityLiveRegion="polite" style={styles.employeeModuleNoticeText}>
              {workspace.loading ? 'Ihre Modulfreigaben werden geprüft…' : workspace.error ??
                (different ? `Diese Seite gehört zum Arbeitsmodul ${employeePortalWorkspaceLabels[different]}.`
                  : 'Diese Seite gehört zu einem Arbeitsmodul, das für Ihr Konto derzeit nicht verfügbar ist.')}
            </Text>
            {!workspace.loading ? <Pressable accessibilityRole="button"
              style={styles.employeeModuleNoticeButton}
              onPress={workspace.error ? workspace.retry : different ? () => select(different) : () => router.replace('/portal/employee')}>
              <Text style={styles.employeeModuleNoticeButtonText}>
                {workspace.error ? 'Erneut prüfen' : different ? `Zu ${employeePortalWorkspaceLabels[different]} wechseln` : 'Zur Übersicht'}
              </Text>
            </Pressable> : null}
          </View>
        ) : <PortalStack />}
      </EmployeePortalFrame>
    </EmployeePortalWorkspaceContext.Provider>
  );
}

function ClientPortalChrome({ children, width, navigation, pathname, unreadCount, keyboardVisible, focus, insets, onSignOut, overlay }: {
  children: ReactNode; width: number; navigation: readonly LiquidPortalNavigationItem[]; pathname: string;
  unreadCount: number; keyboardVisible: boolean; focus: boolean; insets: { top: number; bottom: number };
  onSignOut: () => Promise<void>; overlay?: ReactNode;
}) {
  const router = useRouter();
  const actor = usePortalActor();
  const avatar = usePortalProfileAvatarForActor(actor);
  const owner = actor.tenantId && actor.actorId ? JSON.stringify([actor.tenantId, actor.actorId]) : null;
  return <ClientPortalFrame width={width} displayName={actor.displayName} {...avatar} weatherOwner={owner}
    navigation={navigation} activeId={clientPortalActiveId(pathname, navigation)} unreadCount={unreadCount}
    keyboardVisible={keyboardVisible} focus={focus} insets={insets} onSignOut={onSignOut} overlay={overlay}
    onNavigate={route => router.push(route as never)}>{children}</ClientPortalFrame>;
}

function PortalChrome({ kind, overlay }: { kind: PortalKind; overlay?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const layout = useLiquidLayout();
  const { height: visibleHeight, width: visibleWidth, offsetTop, offsetLeft, keyboardVisible } = usePortalVisualViewport();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const { active: messengerFocusActive } = usePortalMessengerFocus();
  const { settings: clientPortalSettings } = useClientPortalSettings(kind === 'client');
  const familySession = auth.portalSession?.roleKey === 'family_portal' || auth.profile?.roleKey === 'family_portal';
  const navigation = useMemo(() => releasedLiquidPortalNavigation(kind, clientPortalSettings)
    .filter(item => !familySession || item.id !== 'budget'), [kind, clientPortalSettings, familySession]);
  const messageInbox = usePortalOfficeMessages('open', true);
  const unreadCount = useMemo(() => messageInbox.threads.reduce((sum, thread) => sum + thread.unreadCount, 0), [messageInbox.threads]);
  const compactMessengerFocus = !resolvePortalDesktopChrome(layout.width) && messengerFocusActive;
  const width = visibleWidth ?? (Platform.OS === 'web' ? layout.width : layout.width - insets.left - insets.right);
  const signOut = async () => { await auth.signOut(); router.replace('/' as never); };
  return <View testID="portal-visual-viewport" style={[styles.viewport, visibleHeight !== null ? {
    position: 'fixed', top: offsetTop, left: offsetLeft, height: visibleHeight, width: visibleWidth ?? '100%',
  } as unknown as ViewStyle : null, Platform.OS !== 'web' && { paddingLeft: insets.left, paddingRight: insets.right }]}>
    {kind === 'employee' ? <EmployeePortalChrome width={width} height={visibleHeight ?? layout.height} pathname={pathname}
      accountId={auth.user?.id ?? null} unreadCount={unreadCount} keyboardVisible={keyboardVisible}
      focus={isEmployeeVisitExecutionRoute(pathname) || compactMessengerFocus} insets={insets} overlay={overlay} onSignOut={signOut} /> :
      <ClientPortalChrome width={width} navigation={navigation} pathname={pathname} unreadCount={unreadCount}
        keyboardVisible={keyboardVisible} focus={compactMessengerFocus} insets={insets} onSignOut={signOut} overlay={overlay}><PortalStack /></ClientPortalChrome>}
  </View>;
}

export function LiquidPortalRouteLayout({
  kind,
  overlay,
}: {
  kind: PortalKind;
  overlay?: ReactNode;
}) {
  const { portalSession } = useAuth();
  let content: ReactNode = <PortalChrome kind={kind} overlay={overlay} />;
  content = <RequireRole ownerPath={Platform.OS === 'web' ? undefined : liquidPortalRoots[kind]}>{content}</RequireRole>;
  if (kind === 'employee') {
    content = <RequireEmployeePasswordSetup>{content}</RequireEmployeePasswordSetup>;
  }
  const guarded = (
    <RequireAuth redirectTo={liquidPortalLoginRoutes[kind] as never}>
      {content}
    </RequireAuth>
  );
  const portalSurface = (
    <PortalMessengerFocusProvider key={`${portalSession?.tenantId ?? ''}:${portalSession?.accountId ?? kind}`}>
      <PortalViewportContext.Provider value={{ footerInFlow: true }}>
        <LiquidVisualModeProvider mode="orbit">{guarded}</LiquidVisualModeProvider>
      </PortalViewportContext.Provider>
    </PortalMessengerFocusProvider>
  );
  if (kind === 'client' || kind === 'employee') {
    return <PortalPremiumProvider kind={kind}>{portalSurface}</PortalPremiumProvider>;
  }
  return portalSurface;
}

const styles = StyleSheet.create(withCareSuiteTypography({
  employeeModuleNotice: { margin: 16, padding: 16, gap: 12, borderRadius: 14, borderWidth: 1, borderColor: employeePortalDesign.line, backgroundColor: employeePortalDesign.panel },
  employeeModuleNoticeText: { color: employeePortalDesign.text, fontSize: webScaledFontMetric(15), lineHeight: webScaledFontMetric(22) },
  employeeModuleNoticeButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: employeePortalDesign.selected },
  employeeModuleNoticeButtonText: { color: employeePortalDesign.accent, fontSize: webScaledFontMetric(14), lineHeight: webScaledFontMetric(21) },
  viewport: { flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' },
}));
