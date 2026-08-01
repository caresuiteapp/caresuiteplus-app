import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  liquidPortalLoginRoutes,
  liquidPortalRoots,
  type ProductPortalKind as PortalKind,
} from '../navigation/portalCatalog';
import { PortalTextSizeControls } from '@/components/portal/accessibility/PortalTextSizeControls';
import { webScaledFontMetric } from '@/design/web/webFontSize';

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

function PortalChrome({ kind, overlay }: { kind: PortalKind; overlay?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const layout = useLiquidLayout();
  const insets = useSafeAreaInsets();
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
    router.replace('/' as never);
  };

  return (
    <LiquidBackdrop>
      <View style={styles.shell}>
        {layout.isDesktop ? (
          <View style={[styles.rail, kind === 'client' && styles.clientRail]}>
            {kind === 'client' ? <LiquidLogo mini /> : <LiquidLogo compact />}
            <ScrollView contentContainerStyle={styles.railItems} showsVerticalScrollIndicator={false}>
              {navigation.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeId === item.id }}
                  onPress={() => router.replace(item.route as never)}
                  style={({ pressed }) => [
                    styles.railItem,
                    kind === 'client' && styles.clientRailItem,
                    activeId === item.id && styles.railItemActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <LiquidGlyph
                    active={activeId === item.id}
                    glyph={item.glyph}
                    size={19}
                  />
                  <Text numberOfLines={1} style={[styles.railLabel, kind === 'client' && styles.clientRailLabel]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sicher abmelden"
              onPress={() => void signOut()}
              style={({ pressed }) => [styles.railLogout, kind === 'client' && styles.clientRailLogout, pressed && styles.pressed]}
            >
              <LiquidGlyph glyph="↪" size={19} />
              <Text style={[styles.railLabel, kind === 'client' && styles.clientRailLabel]}>Abmelden</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.main}>
          <View style={[styles.topbar, !layout.isDesktop && { paddingTop: Math.max(insets.top, 10) }]}>
            {!layout.isDesktop ? <LiquidLogo compact /> : (
              <View style={styles.portalBrand}>
                <Text style={styles.portalKicker}>{kind === 'employee' ? 'MITARBEITENDENPORTAL' : kind === 'client' ? 'KLIENT:INNENPORTAL' : 'ANGEHÖRIGENPORTAL'}</Text>
                <Text style={styles.portalTitle}>
                  {kind === 'employee' ? 'Mein Arbeitsbereich' : kind === 'client' ? 'Meine Versorgung' : 'Freigegebene Informationen'}
                </Text>
              </View>
            )}
            <View style={styles.identity}>
              {layout.isDesktop ? (
                <>
                  {kind === 'client' ? <PortalTextSizeControls /> : null}
                  <View style={styles.identityCopy}>
                    <Text numberOfLines={1} style={styles.identityName}>{displayName}</Text>
                    <Text style={styles.identityRole}>Sicher angemeldet</Text>
                  </View>
                  <LiquidButton compact label="Abmelden" variant="ghost" onPress={() => void signOut()} />
                </>
              ) : (
                <>
                  {kind === 'client' ? <PortalTextSizeControls compact /> : null}
                  <LiquidIconButton
                    label="Nachrichten"
                    glyph="♧"
                    onPress={() => router.replace(
                      kind === 'employee'
                        ? '/portal/employee/messages'
                        : kind === 'client'
                          ? '/portal/client/messages'
                          : '/portal/relative/messages' as never,
                    )}
                  />
                  {kind !== 'client' ? (
                    <LiquidIconButton
                      label={profileRoute ? 'Profil' : 'Abmelden'}
                      glyph="♙"
                      onPress={() => profileRoute
                        ? router.replace(profileRoute as never)
                        : void signOut()}
                    />
                  ) : null}
                </>
              )}
            </View>
          </View>
          <LiquidSurface
            solid={layout.isDesktop}
            style={[
              styles.contentFrame,
              !layout.isDesktop && styles.contentFrameCompact,
              !layout.isDesktop && { marginBottom: 84 + insets.bottom },
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
          <View style={[styles.bottomNav, { bottom: Math.max(insets.bottom, 12) }]}>
            {compactNavigation.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeId === item.id }}
                onPress={() => router.replace(item.route as never)}
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
                  {kind === 'client' ? (
                    <View style={styles.moreAccessibility}>
                      <Text style={styles.moreAccessibilityLabel}>LESBARKEIT & ZOOM</Text>
                      <PortalTextSizeControls />
                    </View>
                  ) : null}
                  {moreNavigation.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="menuitem"
                      onPress={() => {
                        setMoreOpen(false);
                        router.replace(item.route as never);
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
                  <Pressable
                    accessibilityRole="menuitem"
                    accessibilityLabel="Sicher abmelden"
                    onPress={() => {
                      setMoreOpen(false);
                      void signOut();
                    }}
                    style={({ pressed }) => [styles.moreItem, styles.moreLogout, pressed && styles.pressed]}
                  >
                    <LiquidGlyph glyph="↪" size={21} />
                    <Text style={styles.moreLabel}>Abmelden</Text>
                    <Text style={styles.moreArrow}>›</Text>
                  </Pressable>
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
    <RequireAuth redirectTo={liquidPortalLoginRoutes[kind] as never}>
      {content}
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    flexDirection: 'row',
  },
  rail: {
    // The compact CareSuite logo is 224 px wide. Reserve its real width plus
    // the rail padding so it cannot overlap the portal heading.
    width: 252,
    paddingHorizontal: 14,
    paddingVertical: 20,
    borderRightWidth: 1,
    borderRightColor: liquidColors.white12,
    backgroundColor: 'rgba(6,21,43,0.9)',
    alignItems: 'stretch',
    gap: 18,
    zIndex: liquidLayers.dock,
  },
  clientRail: {
    width: 214,
    paddingHorizontal: 12,
    alignItems: 'stretch',
  },
  railItems: {
    gap: 6,
    paddingBottom: 20,
    paddingTop: 12,
  },
  railItem: {
    width: '100%',
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: liquidRadius.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  clientRailItem: {
    width: '100%',
    minHeight: 50,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 11,
  },
  railItemActive: {
    borderWidth: 1,
    borderColor: liquidColors.blue400,
    backgroundColor: 'rgba(20,120,255,0.2)',
  },
  railLogout: {
    width: '100%',
    minHeight: 50,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: liquidColors.white12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  clientRailLogout: {
    width: '100%',
    minHeight: 50,
    paddingHorizontal: 13,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 11,
  },
  railGlyph: {
    color: liquidColors.blue200,
    fontSize: 19,
    lineHeight: 22,
  },
  railLabel: {
    flex: 1,
    color: liquidColors.white72,
    fontSize: webScaledFontMetric(13),
    lineHeight: webScaledFontMetric(17),
    fontWeight: '700',
    textAlign: 'left',
  },
  clientRailLabel: {
    flexShrink: 1,
    fontSize: webScaledFontMetric(13),
    lineHeight: webScaledFontMetric(18),
    textAlign: 'left',
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
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
    fontSize: webScaledFontMetric(10),
    lineHeight: webScaledFontMetric(13),
    fontWeight: '800',
    letterSpacing: 1,
  },
  portalBrand: {
    gap: 4,
  },
  portalTitle: {
    color: liquidColors.white,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.35,
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
    fontSize: webScaledFontMetric(12),
    lineHeight: webScaledFontMetric(16),
    fontWeight: '700',
  },
  identityRole: {
    color: liquidColors.white56,
    fontSize: webScaledFontMetric(10),
    lineHeight: webScaledFontMetric(13),
  },
  contentFrame: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    margin: 14,
    overflow: 'hidden',
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
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
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
    minHeight: 48,
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
    fontSize: webScaledFontMetric(9),
    lineHeight: webScaledFontMetric(12),
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
    fontSize: webScaledFontMetric(10),
    lineHeight: webScaledFontMetric(13),
    fontWeight: '800',
    letterSpacing: 1,
  },
  moreTitle: {
    marginTop: 2,
    color: liquidColors.white,
    fontSize: webScaledFontMetric(20),
    lineHeight: webScaledFontMetric(25),
    fontWeight: '800',
  },
  moreGrid: {
    gap: 7,
  },
  moreAccessibility: {
    marginBottom: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: liquidColors.white12,
    gap: 7,
  },
  moreAccessibilityLabel: {
    color: liquidColors.blue200,
    fontSize: webScaledFontMetric(10),
    lineHeight: webScaledFontMetric(13),
    fontWeight: '800',
    letterSpacing: 1,
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
  moreLogout: {
    marginTop: 7,
    borderColor: liquidColors.blue300Alpha32,
  },
  moreLabel: {
    flex: 1,
    color: liquidColors.white,
    fontSize: webScaledFontMetric(14),
    lineHeight: webScaledFontMetric(18),
    fontWeight: '700',
  },
  moreArrow: {
    color: liquidColors.blue200,
    fontSize: webScaledFontMetric(22),
    lineHeight: webScaledFontMetric(24),
  },
});
