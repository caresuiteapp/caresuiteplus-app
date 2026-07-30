import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useAuth, RequireAuth, RequireEmployeePasswordSetup, RequireRole } from '@/lib/auth';
import {
  LiquidBackdrop,
  LiquidButton,
  LiquidIconButton,
  LiquidGlyph,
  LiquidLogo,
  LiquidSurface,
} from '../components/LiquidPrimitives';
import { liquidColors, liquidLayers, liquidRadius } from '../foundation/tokens';
import { useLiquidLayout } from '../foundation/useLiquidLayout';
import {
  liquidPortalNavigation,
  liquidPortalRoots,
  type ProductPortalKind as PortalKind,
} from '../navigation/portalCatalog';

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

function PortalChrome({ kind, overlay }: { kind: PortalKind; overlay?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const layout = useLiquidLayout();
  const auth = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigation = liquidPortalNavigation[kind];
  const compactNavigation = navigation.filter((item) => item.compact);
  const moreNavigation = navigation.filter((item) => !item.compact);
  const profileRoute =
    kind === 'employee'
      ? '/portal/employee/profile'
      : kind === 'client'
        ? '/portal/client/profile'
        : null;
  const displayName =
    auth.profile?.displayName || auth.portalSession?.displayName || auth.user?.displayName || 'Portal';

  const activeId = useMemo(() => {
    const matching = [...navigation]
      .sort((a, b) => b.route.length - a.route.length)
      .find((item) => pathname === item.route || pathname.startsWith(`${item.route}/`));
    return matching?.id ?? 'home';
  }, [navigation, pathname]);

  if (pathname === liquidPortalRoots[kind]) {
    return (
      <>
        <PortalStack />
        {overlay}
      </>
    );
  }

  const signOut = async () => {
    await auth.signOut();
    router.replace('/auth' as never);
  };

  return (
    <LiquidBackdrop>
      <View style={styles.shell}>
        {layout.isDesktop ? (
          <View style={styles.rail}>
            <LiquidLogo mini />
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
                  <LiquidGlyph
                    active={activeId === item.id}
                    glyph={item.glyph}
                    size={19}
                  />
                  <Text numberOfLines={1} style={styles.railLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        <View style={styles.main}>
          <View style={styles.topbar}>
            {!layout.isDesktop ? <LiquidLogo compact /> : (
              <View style={styles.portalBrand}>
                <Text style={styles.portalKicker}>{kind === 'employee' ? 'MITARBEITENDENPORTAL' : kind === 'client' ? 'KLIENT:INNENPORTAL' : 'ANGEHÖRIGENPORTAL'}</Text>
                <LiquidLogo compact />
              </View>
            )}
            <View style={styles.identity}>
              {layout.isDesktop ? (
                <>
                  <View style={styles.identityCopy}>
                    <Text numberOfLines={1} style={styles.identityName}>{displayName}</Text>
                    <Text style={styles.identityRole}>Sicher angemeldet</Text>
                  </View>
                  <LiquidButton compact label="Abmelden" variant="ghost" onPress={() => void signOut()} />
                </>
              ) : (
                <>
                  <LiquidIconButton
                    label="Nachrichten"
                    glyph="♧"
                    onPress={() => router.push(
                      kind === 'employee'
                        ? '/portal/employee/messages'
                        : kind === 'client'
                          ? '/portal/client/messages'
                          : '/portal/relative/messages' as never,
                    )}
                  />
                  <LiquidIconButton
                    label={profileRoute ? 'Profil' : 'Abmelden'}
                    glyph="♙"
                    onPress={() => profileRoute
                      ? router.push(profileRoute as never)
                      : void signOut()}
                  />
                </>
              )}
            </View>
          </View>
          <LiquidSurface
            solid={layout.isDesktop}
            style={[
              styles.contentFrame,
              !layout.isDesktop && styles.contentFrameCompact,
            ]}
            contentStyle={[
              styles.content,
              !layout.isDesktop && styles.contentCompact,
            ]}
          >
            <PortalStack />
          </LiquidSurface>
        </View>
      </View>
      {!layout.isDesktop ? (
        <>
          <View style={styles.bottomNav}>
            {compactNavigation.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeId === item.id }}
                onPress={() => router.push(item.route as never)}
                style={({ pressed }) => [styles.bottomItem, pressed && styles.pressed]}
              >
                <LiquidGlyph
                  active={activeId === item.id}
                  glyph={item.glyph}
                  size={20}
                />
                <Text style={[styles.bottomLabel, activeId === item.id && styles.bottomLabelActive]}>{item.label}</Text>
              </Pressable>
            ))}
            {moreNavigation.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Weitere Portalbereiche öffnen"
                accessibilityState={{ expanded: moreOpen }}
                onPress={() => setMoreOpen(true)}
                style={({ pressed }) => [styles.bottomItem, pressed && styles.pressed]}
              >
                <LiquidGlyph
                  active={moreNavigation.some((item) => item.id === activeId)}
                  glyph="•••"
                  size={20}
                />
                <Text
                  style={[
                    styles.bottomLabel,
                    moreNavigation.some((item) => item.id === activeId) && styles.bottomLabelActive,
                  ]}
                >
                  Mehr
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Modal
            animationType="fade"
            onRequestClose={() => setMoreOpen(false)}
            transparent
            visible={moreOpen}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menü schließen"
              onPress={() => setMoreOpen(false)}
              style={styles.moreBackdrop}
            >
              <Pressable
                accessibilityRole="menu"
                onPress={(event) => event.stopPropagation()}
                style={styles.morePanel}
              >
                <View style={styles.moreHeader}>
                  <View>
                    <Text style={styles.moreKicker}>PORTALNAVIGATION</Text>
                    <Text style={styles.moreTitle}>Alle Bereiche</Text>
                  </View>
                  <LiquidIconButton label="Schließen" glyph="×" onPress={() => setMoreOpen(false)} />
                </View>
                <ScrollView
                  contentContainerStyle={styles.moreGrid}
                  showsVerticalScrollIndicator={false}
                >
                  {moreNavigation.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="menuitem"
                      onPress={() => {
                        setMoreOpen(false);
                        router.push(item.route as never);
                      }}
                      style={({ pressed }) => [
                        styles.moreItem,
                        activeId === item.id && styles.moreItemActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <LiquidGlyph active={activeId === item.id} glyph={item.glyph} size={21} />
                      <Text style={styles.moreLabel}>{item.label}</Text>
                      <Text style={styles.moreArrow}>›</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      ) : null}
      {overlay}
    </LiquidBackdrop>
  );
}

export function LiquidPortalRouteLayout({
  kind,
  overlay,
}: {
  kind: PortalKind;
  overlay?: ReactNode;
}) {
  let content: ReactNode = <PortalChrome kind={kind} overlay={overlay} />;
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
  portalBrand: {
    gap: 4,
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
  contentFrameCompact: {
    margin: 0,
    marginBottom: 84,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'rgba(7,27,53,0.78)',
  },
  contentCompact: {
    backgroundColor: 'transparent',
  },
  bottomNav: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 68,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: liquidColors.blue600,
    backgroundColor: 'rgba(2,13,31,0.98)',
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
  moreBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
    backgroundColor: 'rgba(0,6,18,0.72)',
  },
  morePanel: {
    maxHeight: '78%',
    padding: 16,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: liquidColors.blue600,
    borderRadius: 22,
    backgroundColor: 'rgba(4,20,43,0.99)',
  },
  moreHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreKicker: {
    color: liquidColors.blue200,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  moreTitle: {
    marginTop: 2,
    color: liquidColors.white,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  moreGrid: {
    gap: 7,
  },
  moreItem: {
    minHeight: 50,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    borderRadius: liquidRadius.control,
    backgroundColor: 'rgba(20,54,91,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  moreItemActive: {
    borderColor: liquidColors.blue400,
    backgroundColor: 'rgba(20,120,255,0.2)',
  },
  moreLabel: {
    flex: 1,
    color: liquidColors.white,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  moreArrow: {
    color: liquidColors.blue200,
    fontSize: 22,
    lineHeight: 24,
  },
});
