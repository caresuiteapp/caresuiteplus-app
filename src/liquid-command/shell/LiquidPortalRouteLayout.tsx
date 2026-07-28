import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useAuth, RequireAuth, RequireEmployeePasswordSetup, RequireRole } from '@/lib/auth';
import { LiquidBackdrop, LiquidButton, LiquidLogo, LiquidSurface } from '../components/LiquidPrimitives';
import { liquidColors, liquidLayers, liquidRadius } from '../foundation/tokens';
import { useLiquidLayout } from '../foundation/useLiquidLayout';

type PortalKind = 'employee' | 'client' | 'relative';

type PortalNavigationItem = {
  id: string;
  label: string;
  glyph: string;
  route: string;
};

const PORTAL_ROOTS: Record<PortalKind, string> = {
  employee: '/portal/employee',
  client: '/portal/client',
  relative: '/portal/relative',
};

const PORTAL_NAVIGATION: Record<PortalKind, readonly PortalNavigationItem[]> = {
  employee: [
    { id: 'home', label: 'Heute', glyph: '⌂', route: '/portal/employee' },
    { id: 'assignments', label: 'Einsätze', glyph: '◇', route: '/portal/employee/assignments' },
    { id: 'time', label: 'Arbeitszeit', glyph: '◷', route: '/portal/employee/arbeitszeit' },
    { id: 'payroll', label: 'Gehalt', glyph: '€', route: '/portal/employee/payroll' },
    { id: 'messages', label: 'Nachrichten', glyph: '▱', route: '/portal/employee/messages' },
    { id: 'profile', label: 'Profil', glyph: '♙', route: '/portal/employee/profile' },
  ],
  client: [
    { id: 'home', label: 'Übersicht', glyph: '⌂', route: '/portal/client' },
    { id: 'appointments', label: 'Termine', glyph: '□', route: '/portal/client/appointments' },
    { id: 'documents', label: 'Dokumente', glyph: '▤', route: '/portal/client/documents' },
    { id: 'messages', label: 'Nachrichten', glyph: '▱', route: '/portal/client/messages' },
    { id: 'budget', label: 'Budget', glyph: '€', route: '/portal/client/budget' },
    { id: 'profile', label: 'Profil', glyph: '♙', route: '/portal/client/profile' },
  ],
  relative: [
    { id: 'home', label: 'Übersicht', glyph: '⌂', route: '/portal/relative' },
    { id: 'messages', label: 'Nachrichten', glyph: '▱', route: '/portal/relative/messages' },
  ],
};

const transparentContent = { backgroundColor: 'transparent' } as const;

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

function PortalChrome({ kind }: { kind: PortalKind }) {
  const pathname = usePathname();
  const router = useRouter();
  const layout = useLiquidLayout();
  const auth = useAuth();
  const navigation = PORTAL_NAVIGATION[kind];
  const displayName =
    auth.profile?.displayName || auth.portalSession?.displayName || auth.user?.displayName || 'Portal';

  const activeId = useMemo(() => {
    const matching = [...navigation]
      .sort((a, b) => b.route.length - a.route.length)
      .find((item) => pathname === item.route || pathname.startsWith(`${item.route}/`));
    return matching?.id ?? 'home';
  }, [navigation, pathname]);

  if (pathname === PORTAL_ROOTS[kind]) return <PortalStack />;

  const signOut = async () => {
    await auth.signOut();
    router.replace('/auth' as never);
  };

  return (
    <LiquidBackdrop>
      <View style={styles.shell}>
        {!layout.isPhone ? (
          <View style={styles.rail}>
            <LiquidLogo compact />
            <ScrollView contentContainerStyle={styles.railItems} showsVerticalScrollIndicator={false}>
              {navigation.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeId === item.id }}
                  onPress={() => router.push(item.route as never)}
                  style={({ pressed }) => [
                    styles.railItem,
                    activeId === item.id && styles.railItemActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.railGlyph}>{item.glyph}</Text>
                  <Text numberOfLines={1} style={styles.railLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        <View style={styles.main}>
          <View style={styles.topbar}>
            {layout.isPhone ? <LiquidLogo compact /> : (
              <View>
                <Text style={styles.portalKicker}>{kind === 'employee' ? 'MITARBEITENDENPORTAL' : kind === 'client' ? 'KLIENT:INNENPORTAL' : 'ANGEHÖRIGENPORTAL'}</Text>
                <Text style={styles.portalTitle}>CareSuite HealthOS</Text>
              </View>
            )}
            <View style={styles.identity}>
              {!layout.isPhone ? (
                <View style={styles.identityCopy}>
                  <Text numberOfLines={1} style={styles.identityName}>{displayName}</Text>
                  <Text style={styles.identityRole}>Sicher angemeldet</Text>
                </View>
              ) : null}
              <LiquidButton compact label="Abmelden" variant="ghost" onPress={() => void signOut()} />
            </View>
          </View>
          <LiquidSurface solid style={styles.contentFrame} contentStyle={styles.content}>
            <PortalStack />
          </LiquidSurface>
        </View>
      </View>
      {layout.isPhone ? (
        <View style={styles.bottomNav}>
          {navigation.slice(0, 5).map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeId === item.id }}
              onPress={() => router.push(item.route as never)}
              style={({ pressed }) => [styles.bottomItem, pressed && styles.pressed]}
            >
              <Text style={[styles.bottomGlyph, activeId === item.id && styles.bottomGlyphActive]}>{item.glyph}</Text>
              <Text style={[styles.bottomLabel, activeId === item.id && styles.bottomLabelActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </LiquidBackdrop>
  );
}

export function LiquidPortalRouteLayout({ kind }: { kind: PortalKind }) {
  let content: ReactNode = <PortalChrome kind={kind} />;
  content = <RequireRole>{content}</RequireRole>;
  if (kind === 'employee') {
    content = <RequireEmployeePasswordSetup>{content}</RequireEmployeePasswordSetup>;
  }
  return (
    <RequireAuth redirectTo={`/auth/${kind === 'employee' ? 'employee' : kind === 'client' ? 'client' : 'family'}-login` as never}>
      {content}
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
  },
  rail: {
    width: 116,
    paddingHorizontal: 9,
    paddingVertical: 18,
    borderRightWidth: 1,
    borderRightColor: liquidColors.white12,
    backgroundColor: 'rgba(6,21,43,0.9)',
    alignItems: 'center',
    gap: 18,
    zIndex: liquidLayers.dock,
  },
  railItems: {
    gap: 8,
    paddingBottom: 20,
  },
  railItem: {
    width: 96,
    minHeight: 62,
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderRadius: liquidRadius.control,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  railItemActive: {
    borderWidth: 1,
    borderColor: liquidColors.blue400,
    backgroundColor: 'rgba(20,120,255,0.2)',
  },
  railGlyph: {
    color: liquidColors.blue200,
    fontSize: 19,
    lineHeight: 22,
  },
  railLabel: {
    color: liquidColors.white72,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  topbar: {
    minHeight: 74,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: liquidColors.white12,
    backgroundColor: 'rgba(6,21,43,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  portalKicker: {
    color: liquidColors.blue200,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  portalTitle: {
    color: liquidColors.white,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  identity: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  identityCopy: {
    minWidth: 0,
    alignItems: 'flex-end',
  },
  identityName: {
    maxWidth: 180,
    color: liquidColors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  identityRole: {
    color: liquidColors.white56,
    fontSize: 10,
    lineHeight: 13,
  },
  contentFrame: {
    flex: 1,
    minHeight: 0,
    margin: 14,
  },
  content: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'rgba(7,27,53,0.78)',
  },
  bottomNav: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    minHeight: 72,
    paddingHorizontal: 5,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: liquidColors.white18,
    backgroundColor: 'rgba(6,21,43,0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: liquidLayers.overlay,
  },
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bottomGlyph: {
    color: liquidColors.white56,
    fontSize: 20,
    lineHeight: 24,
  },
  bottomGlyphActive: {
    color: liquidColors.blue200,
  },
  bottomLabel: {
    color: liquidColors.white56,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600',
  },
  bottomLabelActive: {
    color: liquidColors.white,
  },
  pressed: {
    opacity: 0.76,
  },
});
