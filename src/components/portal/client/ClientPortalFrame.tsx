import { useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useWebFontScaleValue } from '@/design/web/WebFontScaleProvider';
import { PortalTextSizeControls } from '@/components/portal/accessibility/PortalTextSizeControls';
import { PortalReadOnlyAvatar } from '@/components/portal/PortalReadOnlyAvatar';
import { EmployeePortalHeaderStatus } from '@/components/portal/employee/EmployeePortalHeaderStatus';
import { EmployeePortalBackdrop } from '@/components/portal/employee/EmployeePortalBackdrop';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import type { LiquidPortalNavigationItem } from '@/liquid-command/navigation/portalCatalog';
import { ClientPortalArtwork } from './ClientPortalArtwork';
import { ClientPortalMenuContext } from './ClientPortalMenuContext';
import { clientPortalDesign as c, clientPortalLayout, clientRailLabels } from './clientPortalDesign';

type Props = {
  children: ReactNode; overlay?: ReactNode; width: number; displayName: string; weatherOwner: string | null;
  avatarUrl?: string; avatarVersion?: string; navigation: readonly LiquidPortalNavigationItem[];
  activeId: string; unreadCount: number; keyboardVisible: boolean; focus: boolean;
  insets: { top: number; bottom: number }; onNavigate: (route: string) => void; onSignOut: () => Promise<void>;
};

/** One responsive client frame: header, original artwork rail, mobile navigation and all-area menu. */
export function ClientPortalFrame({ children, overlay, width, displayName, weatherOwner, avatarUrl, avatarVersion,
  navigation, activeId, unreadCount, keyboardVisible, focus, insets, onNavigate, onSignOut }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const signingOutRef = useRef(false);
  const { fontScale } = useWindowDimensions();
  const textScale = Math.max(fontScale ?? 1, useWebFontScaleValue());
  const layout = clientPortalLayout(width, textScale);
  const menuStacked = width / textScale < 350;
  const open = (route: string) => { setMenuOpen(false); onNavigate(route); };
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);
  const logout = async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true; setSigningOut(true); setSignOutError(null);
    try { await onSignOut(); } catch { setSignOutError('Abmelden nicht möglich. Bitte versuchen Sie es erneut.'); }
    finally { signingOutRef.current = false; setSigningOut(false); }
  };
  const label = (item: LiquidPortalNavigationItem) => item.id === 'messages' && unreadCount > 0
    ? `${item.label}, ${unreadCount} ungelesene Nachrichten` : item.label;
  const profile = <Pressable accessibilityRole="button" accessibilityLabel={`Profil von ${displayName} öffnen`}
    onPress={() => open('/portal/client/profile')} style={styles.profile}>
    <PortalReadOnlyAvatar name={displayName} avatarUrl={avatarUrl} avatarVersion={avatarVersion} size={layout.phone ? 'md' : 'lg'} accentColor={c.accent.blue} />
    {layout.singleHeaderRow ? <View style={styles.identity}><Text style={styles.name}>{displayName}</Text><Text style={styles.meta}>Mein Profil</Text></View> : null}
  </Pressable>;
  const signOut = <Pressable accessibilityRole="button" accessibilityLabel="Abmelden" disabled={signingOut}
    accessibilityState={{ disabled: signingOut, busy: signingOut }} onPress={() => void logout()}
    style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
    <Ionicons name="log-out-outline" size={21} color={c.accent.blue} /><Text style={styles.controlText}>{signingOut ? 'Wird abgemeldet…' : 'Abmelden'}</Text>
  </Pressable>;
  const railAction = (item: LiquidPortalNavigationItem) => <Pressable key={item.id} accessibilityRole="tab"
    accessibilityLabel={label(item)} accessibilityState={{ selected: activeId === item.id }}
    onPress={() => open(item.route)} {...(Platform.OS === 'web' ? { title: item.label } : {})}
    style={({ pressed }) => [styles.railAction, activeId === item.id && styles.selected, pressed && styles.pressed]}>
    <ClientPortalArtwork id={item.id} label={item.label} size={64} />
    <Text style={[styles.railLabel, activeId === item.id && styles.selectedText]}>{clientRailLabels[item.id] ?? item.label}</Text>
    {item.id === 'messages' && unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
  </Pressable>;
  const compact = navigation.filter(item => ['home', 'appointments', 'messages'].includes(item.id));
  const moreSelected = !compact.some(item => item.id === activeId);
  return <ClientPortalMenuContext.Provider value={() => setMenuOpen(true)}>
    <View style={styles.frame} testID="client-portal-responsive-frame">
      <EmployeePortalBackdrop animated={!focus} />
      {!focus ? <View testID="client-portal-header" style={[styles.header, !layout.singleHeaderRow && styles.headerWrap,
        { paddingTop: Math.max(insets.top, layout.phone ? 10 : 12) }, layout.phone && styles.headerPhone]}>
        <View style={[styles.brandRow, layout.phone && styles.brandRowPhone]}>
          <Pressable accessibilityRole="button" accessibilityLabel="CareSuite HealthOS – Übersicht" onPress={() => open('/portal/client')} style={styles.brand}>
            <Text style={[styles.wordmark, layout.phone && styles.wordmarkPhone]}>CareSuite <Text style={styles.brandAccent}>HealthOS</Text></Text>
            <Text style={styles.kicker}>Klientenportal</Text>
          </Pressable>
          {layout.phone ? profile : null}
        </View>
        <EmployeePortalHeaderStatus owner={weatherOwner} compact={!layout.singleHeaderRow} stacked={layout.phone}
          centered={layout.singleHeaderRow} weatherBelowClock={layout.stackedWeather} portalLabel="KLIENTENPORTAL" />
        {!layout.phone ? <View style={styles.headerActions}>{profile}
          <Pressable accessibilityRole="button" accessibilityLabel="Hilfe öffnen" onPress={() => open('/portal/client/help')} style={styles.help}>
            <Ionicons name="help-circle-outline" size={24} color={c.text.primary} />
          </Pressable>
          <PortalTextSizeControls compact={!layout.singleHeaderRow} appearance="desktop-header" style={styles.textSize} />{signOut}
        </View> : null}
        {signOutError ? <Text accessibilityRole="alert" style={styles.error}>{signOutError}</Text> : null}
      </View> : null}
      <View style={styles.body}>
        {!layout.phone && !focus ? <View style={[styles.rail, { width: layout.railWidth }]} testID="client-portal-symbol-navigation">
          <ScrollView accessibilityRole="tablist" accessibilityLabel="Portalnavigation" style={[styles.railScroll, scrollbar]}
            contentContainerStyle={styles.railItems} showsVerticalScrollIndicator>{navigation.map(railAction)}</ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel="Alle Bereiche öffnen" onPress={() => setMenuOpen(true)} style={styles.all}>
            <Ionicons name="grid-outline" size={27} color={c.accent.blue} /><Text style={styles.railLabel}>Alle</Text>
          </Pressable>
        </View> : null}
        <View testID="client-portal-workspace" style={styles.workspace}>{children}</View>
      </View>
      {layout.phone && !keyboardVisible && !focus ? <View testID="client-portal-bottom-navigation" style={[styles.bottom,
        { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist" accessibilityLabel="Hauptnavigation">
        {compact.map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={label(item)}
          accessibilityState={{ selected: activeId === item.id }} onPress={() => open(item.route)}
          style={({ pressed }) => [styles.bottomAction, activeId === item.id && styles.selected, pressed && styles.pressed]}>
          <Ionicons name={item.id === 'home' ? 'home-outline' : item.id === 'appointments' ? 'calendar-outline' : 'chatbubbles-outline'} size={23} color={activeId === item.id ? c.accent.blue : c.text.secondary} />
          <Text style={[styles.bottomLabel, activeId === item.id && styles.selectedText]}>{item.id === 'messages' ? 'Postfach' : item.label}</Text>
          {item.id === 'messages' && unreadCount > 0 ? <View style={styles.bottomBadge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
        </Pressable>)}
        <Pressable accessibilityRole="tab" accessibilityLabel="Mehr, alle Bereiche" accessibilityState={{ selected: moreSelected, expanded: menuOpen }}
          onPress={() => setMenuOpen(true)} style={[styles.bottomAction, moreSelected && styles.selected]}>
          <Ionicons name="grid-outline" size={23} color={moreSelected ? c.accent.blue : c.text.secondary} /><Text style={styles.bottomLabel}>Mehr</Text>
        </Pressable>
      </View> : null}
      {overlay}
      {menuOpen ? <PortalGlassModal visible title="Alle meine Bereiche" onClose={() => setMenuOpen(false)}>
        <View style={styles.menuGrid}>{navigation.map(item => <Pressable key={item.id} accessibilityRole="button"
          accessibilityLabel={label(item)} onPress={() => open(item.route)} style={[styles.menuItem, menuStacked && styles.menuItemStacked]}>
          <ClientPortalArtwork id={item.id} label={item.label} size={menuStacked ? 48 : 62} /><Text style={[styles.menuLabel, menuStacked && styles.menuLabelStacked]}>{item.label}</Text>
        </Pressable>)}</View>
        <View style={styles.menuTools}><Text style={styles.controlText}>Schriftgröße anpassen</Text><PortalTextSizeControls appearance="desktop-header" style={styles.textSize} />{signOut}
          {signOutError ? <Text accessibilityRole="alert" style={styles.error}>{signOutError}</Text> : null}
        </View>
      </PortalGlassModal> : null}
    </View>
  </ClientPortalMenuContext.Provider>;
}

const scrollbar = Platform.OS === 'web' ? ({ scrollbarWidth: 'thin', scrollbarColor: '#9CD6E980 transparent' } as ViewStyle) : null;
const styles = StyleSheet.create(withCareSuiteTypography({
  frame: { flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', backgroundColor: c.backdropStrong },
  header: { minHeight: 96, paddingHorizontal: 22, paddingBottom: 12, gap: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.header, borderBottomWidth: 1, borderColor: c.border },
  headerWrap: { flexWrap: 'wrap', rowGap: 10 }, headerPhone: { paddingHorizontal: 14, gap: 9 },
  brandRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1 }, brandRowPhone: { width: '100%', justifyContent: 'space-between', gap: 10 },
  brand: { minWidth: 0, flexShrink: 1 }, wordmark: { color: c.text.primary, fontSize: font(31), lineHeight: font(38), letterSpacing: -1.65 },
  wordmarkPhone: { fontSize: font(23), lineHeight: font(30), letterSpacing: -1.2, flexShrink: 1 }, brandAccent: { color: c.accent.blue },
  kicker: { color: c.text.secondary, fontSize: font(12), lineHeight: font(17) },
  headerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, minWidth: 0, flexShrink: 1 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }, identity: { minWidth: 0, maxWidth: 190, gap: 2 },
  name: { color: c.text.primary, fontSize: font(15), lineHeight: font(21), flexShrink: 1 }, meta: { color: c.text.secondary, fontSize: font(13), lineHeight: font(18) },
  help: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.control },
  textSize: { borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.control },
  logout: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 1 },
  controlText: { color: c.text.primary, fontSize: font(15), lineHeight: font(21), flexShrink: 1 }, error: { color: c.accent.danger, fontSize: font(14), lineHeight: font(21), flexBasis: '100%' },
  body: { flex: 1, minHeight: 0, minWidth: 0, flexDirection: 'row' },
  rail: { minHeight: 0, borderRightWidth: 1, borderColor: c.border, backgroundColor: c.rail }, railScroll: { flex: 1, minHeight: 0 }, railItems: { paddingVertical: 12, paddingHorizontal: 6, gap: 6 },
  railAction: { minHeight: 104, paddingHorizontal: 3, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: 'transparent', borderRadius: 17 },
  railLabel: { color: c.text.secondary, fontSize: font(13), lineHeight: font(18), fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  selected: { backgroundColor: 'rgba(83,184,225,0.22)', borderWidth: 1, borderColor: c.borderStrong }, selectedText: { color: c.accent.blue },
  badge: { position: 'absolute', top: 5, right: 5, minWidth: 20, minHeight: 20, paddingHorizontal: 4, borderRadius: 6, backgroundColor: c.accent.blue, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: c.text.onStrong, fontSize: font(11), lineHeight: font(16), fontWeight: '700' },
  all: { minHeight: 72, borderTopWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', gap: 3 },
  workspace: { flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', backgroundColor: 'rgba(30,69,91,0.43)' },
  bottom: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 7, paddingTop: 6, gap: 4, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.rail },
  bottomAction: { flex: 1, minWidth: 0, minHeight: 59, paddingVertical: 6, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: 'transparent', borderRadius: 12 },
  bottomLabel: { color: c.text.secondary, fontSize: font(13), lineHeight: font(18), textAlign: 'center', flexShrink: 1 },
  bottomBadge: { position: 'absolute', top: 1, right: '24%', paddingHorizontal: 4, minWidth: 17, borderRadius: 5, backgroundColor: c.accent.blue },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  menuItem: { flexBasis: '46%', flexGrow: 1, minWidth: 0, minHeight: 114, padding: 10, borderRadius: 15, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: 7 },
  menuLabel: { color: c.text.primary, fontSize: font(15), lineHeight: font(21), textAlign: 'center', flexShrink: 1 },
  menuItemStacked: { flexBasis: '100%', minHeight: 80, flexDirection: 'row', justifyContent: 'flex-start', gap: 13 },
  menuLabelStacked: { textAlign: 'left', flex: 1, minWidth: 0 },
  menuTools: { gap: 12, paddingTop: 14, borderTopWidth: 1, borderColor: c.border }, pressed: { opacity: 0.76 },
}));
