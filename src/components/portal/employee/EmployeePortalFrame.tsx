import { useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { LiquidPortalNavigationItem } from '@/liquid-command/navigation/portalCatalog';
import { PortalTextSizeControls } from '@/components/portal/accessibility/PortalTextSizeControls';
import { PortalReadOnlyAvatar } from '@/components/portal/PortalReadOnlyAvatar';
import { employeePortalWorkspaceLabels } from '@/lib/portal/employee/employeePortalWorkspaces';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { EmployeePortalArtwork } from './EmployeePortalArtwork';
import { EmployeePortalMenuContext } from './EmployeePortalMenuContext';
import { useEmployeePortalWorkspaceContext } from './EmployeePortalWorkspaceContext';
import { employeePortalDesign as c, employeePortalLayout, employeePortalWorkspace, employeeRailIds } from './employeePortalDesign';

type Props = {
  children: ReactNode; overlay?: ReactNode; width: number; displayName: string;
  avatarUrl?: string; avatarVersion?: string;
  navigation: readonly LiquidPortalNavigationItem[]; activeId: string; unreadCount: number;
  lightWorkspace?: boolean;
  keyboardVisible: boolean; focus: boolean; insets: { top: number; bottom: number };
  onNavigate: (route: string) => void; onSignOut: () => Promise<void>;
};

/** Shared native/Web chrome: one header and a narrow left rail at every width. */
export function EmployeePortalFrame({ children, overlay, width, displayName, avatarUrl, avatarVersion, navigation, activeId, unreadCount, lightWorkspace, keyboardVisible, focus, insets, onNavigate, onSignOut }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const layout = employeePortalLayout(width);
  const workspace = useEmployeePortalWorkspaceContext();
  const moduleLabel = workspace?.selected ? employeePortalWorkspaceLabels[workspace.selected] : workspace?.loading ? 'Wird geladen…' : 'Persönlicher Bereich';
  const stackModule = width < 820;
  const moduleTrigger = workspace ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`Arbeitsmodul wählen. ${moduleLabel}`}
      accessibilityState={{ expanded: moduleOpen, busy: workspace.loading }} onPress={() => setModuleOpen(true)}
      testID="employee-portal-module-switcher" style={[styles.moduleTrigger, stackModule && styles.moduleTriggerPhone]}>
      <View style={styles.moduleCopy}><Text style={styles.kicker}>ARBEITSMODUL</Text><Text style={styles.moduleValue}>{moduleLabel}</Text></View>
      <Ionicons name="chevron-down" size={17} color={c.accent} />
    </Pressable>
  ) : null;
  const railItems = employeeRailIds.flatMap(id => navigation.filter(item => item.id === id));
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);
  const label = (item: LiquidPortalNavigationItem) => item.id === 'messages' && unreadCount > 0 ? `${item.label}, ${unreadCount} ungelesene Nachrichten` : item.label;
  const open = (route: string) => { setMenuOpen(false); onNavigate(route); };
  const logout = async () => {
    setSigningOut(true); setSignOutError(null);
    try { await onSignOut(); } catch { setSignOutError('Abmelden nicht möglich. Bitte erneut versuchen.'); }
    finally { setSigningOut(false); }
  };
  const railAction = (item: LiquidPortalNavigationItem) => (
    <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={label(item)} accessibilityState={{ selected: activeId === item.id }}
      accessibilityHint={item.label} {...(Platform.OS === 'web' ? { title: item.label } : {})}
      onPress={() => open(item.route)} style={({ pressed }) => [styles.railButton, layout.phone && styles.railButtonPhone, activeId === item.id && styles.selected, pressed && styles.pressed]}>
      <EmployeePortalArtwork id={item.id} label={item.label} size={layout.phone ? 35 : 40} />
      {item.id === 'messages' && unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
    </Pressable>
  );

  return <EmployeePortalMenuContext.Provider value={() => setMenuOpen(true)}><View style={styles.frame} testID="employee-portal-responsive-frame">
    {!focus ? <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }, layout.phone && styles.headerPhone]} testID="employee-portal-header">
      <Pressable accessibilityRole="button" accessibilityLabel="CareSuite HealthOS – Heute" onPress={() => open('/portal/employee')} style={styles.brand}>
        <Text style={[styles.wordmark, layout.phone && styles.wordmarkPhone]}>CareSuite <Text style={styles.brandAccent}>HealthOS</Text></Text>
        <Text style={styles.kicker}>MITARBEITENDENPORTAL</Text>
      </Pressable>
      {!stackModule ? moduleTrigger : null}
      <View style={styles.headerActions}>
        <PortalTextSizeControls compact={layout.phone} appearance="desktop-header" />
        {!layout.phone ? <Pressable accessibilityRole="button" accessibilityLabel="Hilfe öffnen" onPress={() => open('/portal/employee/help')} style={styles.headerButton}><Ionicons name="help-circle-outline" size={23} color={c.text} /></Pressable> : null}
        {width >= 1100 ? <View style={styles.identity}><Text style={styles.identityName}>{displayName}</Text><Text style={styles.secondary}>Mein Arbeitsbereich</Text></View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Profil von ${displayName} öffnen`} onPress={() => open('/portal/employee/profile')}>
          <PortalReadOnlyAvatar name={displayName} avatarUrl={avatarUrl} avatarVersion={avatarVersion} size="md" accentColor={c.accent} />
        </Pressable>
      </View>
      {stackModule ? moduleTrigger : null}
    </View> : null}
    <View style={styles.body}>
      <View style={[styles.rail, { width: layout.railWidth }]} testID="employee-portal-symbol-navigation">
        <ScrollView style={styles.railScroll} contentContainerStyle={styles.railContent} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
          {railItems.map(railAction)}
          <View style={styles.railDivider} />
          {navigation.find(item => item.id === 'leave') ? railAction(navigation.find(item => item.id === 'leave')!) : null}
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Weitere Portalbereiche öffnen" accessibilityState={{ expanded: menuOpen }}
          {...(Platform.OS === 'web' ? { title: 'Alle Bereiche' } : {})} onPress={() => setMenuOpen(true)}
          style={[styles.railButton, layout.phone && styles.railButtonPhone, !railItems.some(item => item.id === activeId) && activeId !== 'leave' && styles.selected]}>
          <Ionicons name="grid-outline" size={22} color={c.accent} />
        </Pressable>
      </View>
      <View style={[styles.workspace, lightWorkspace && styles.lightWorkspace]} testID="employee-portal-workspace">{children}</View>
    </View>
    <View testID="portal-navigation-footer" style={[styles.footer, { paddingBottom: keyboardVisible ? 0 : insets.bottom }]}>{overlay}</View>
    {workspace ? <Modal visible={moduleOpen} transparent animationType="fade" onRequestClose={() => setModuleOpen(false)}>
      <View style={[styles.menuBackdrop, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.menu} accessibilityViewIsModal testID="employee-portal-modules">
          <View style={styles.menuHeader}>
            <Text accessibilityRole="header" style={styles.menuTitle}>Arbeitsmodul wählen</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Modulauswahl schließen" onPress={() => setModuleOpen(false)} style={styles.headerButton}>
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.menuScroll} contentContainerStyle={styles.menuContent}>
            <Text style={styles.secondary}>Die Auswahl wird für Ihr Konto auf diesem Gerät gespeichert.</Text>
            {workspace.loading ? <Text style={styles.menuLabel}>Ihre Freigaben werden geprüft…</Text> : null}
            {!workspace.loading && !workspace.error && !workspace.available.length ? <Text style={styles.menuLabel}>Für Ihr Konto ist derzeit kein Arbeitsmodul verfügbar.</Text> : null}
            {workspace.error ? <Pressable accessibilityRole="button" onPress={workspace.retry} style={styles.menuItem}><Text style={styles.error}>{workspace.error} Erneut prüfen</Text></Pressable> : null}
            {workspace.preferenceError ? <Text accessibilityRole="alert" style={styles.error}>Die Auswahl konnte auf diesem Gerät nicht gespeichert werden.</Text> : null}
            {!workspace.loading ? workspace.available.map(key => <Pressable key={key} accessibilityRole="button"
              accessibilityState={{ selected: key === workspace.selected }}
              onPress={() => { workspace.select(key); setModuleOpen(false); }}
              style={[styles.menuItem, key === workspace.selected && styles.selected]}>
              <Text style={styles.menuLabel}>{employeePortalWorkspaceLabels[key]}</Text>
              {key === workspace.selected ? <Ionicons name="checkmark" size={20} color={c.accent} /> : null}
            </Pressable>) : null}
          </ScrollView>
        </View>
      </View>
    </Modal> : null}
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
      <View style={[styles.menuBackdrop, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.menu} accessibilityViewIsModal testID="employee-portal-all-areas">
          <View style={styles.menuHeader}><Text accessibilityRole="header" style={styles.menuTitle}>Alle Bereiche</Text><Pressable accessibilityRole="button" accessibilityLabel="Menü schließen" onPress={() => setMenuOpen(false)} style={styles.headerButton}><Ionicons name="close" size={24} color={c.text} /></Pressable></View>
          <ScrollView style={styles.menuScroll} contentContainerStyle={styles.menuContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            {navigation.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={label(item)} accessibilityState={{ selected: activeId === item.id }} onPress={() => open(item.route)} style={({ pressed }) => [styles.menuItem, activeId === item.id && styles.selected, pressed && styles.pressed]}>
              <EmployeePortalArtwork id={item.id} label={item.label} size={40} /><Text style={styles.menuLabel}>{item.label}</Text><Ionicons name="chevron-forward" size={17} color={c.accent} />
            </Pressable>)}
            <View style={styles.menuTextSize}><Text style={styles.secondary}>Schriftgröße</Text><PortalTextSizeControls appearance="desktop-header" /></View>
            {signOutError ? <Text accessibilityRole="alert" style={styles.error}>{signOutError}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Sicher abmelden" disabled={signingOut} onPress={() => void logout()} style={[styles.menuItem, styles.logout]}><Ionicons name="log-out-outline" size={23} color={c.accent} /><Text style={styles.menuLabel}>{signingOut ? 'Wird abgemeldet…' : 'Abmelden'}</Text></Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View></EmployeePortalMenuContext.Provider>;
}

const styles = StyleSheet.create(withCareSuiteTypography({
  frame: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: c.canvas },
  header: { flexShrink: 0, minHeight: 80, paddingHorizontal: 24, paddingBottom: 12, borderBottomWidth: 1, borderColor: c.line, backgroundColor: c.header, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  headerPhone: { minHeight: 72, paddingHorizontal: 10, gap: 8 },
  brand: { minWidth: 0, flexShrink: 1, gap: 4 }, wordmark: { color: c.text, fontSize: font(27), lineHeight: font(34), letterSpacing: -1 }, wordmarkPhone: { fontSize: font(19), lineHeight: font(27) }, brandAccent: { color: c.accent },
  kicker: { color: c.muted, fontSize: font(9), lineHeight: font(14), letterSpacing: 1.2 },
  headerActions: { minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, marginLeft: 'auto' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line },
  identity: { maxWidth: 200, gap: 2, alignItems: 'flex-end' }, identityName: { color: c.text, fontSize: font(13), lineHeight: font(19) }, secondary: { color: c.muted, fontSize: font(12), lineHeight: font(18) },
  moduleTrigger: { minWidth: 140, maxWidth: '100%', minHeight: 44, flexShrink: 0, paddingVertical: 5, paddingHorizontal: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.panel, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  moduleTriggerPhone: { width: '100%', minWidth: 0 },
  moduleCopy: { flexShrink: 1, minWidth: 0 },
  moduleValue: { color: c.text, fontSize: font(15), lineHeight: font(21), fontWeight: '700' },
  body: { flex: 1, minHeight: 0, minWidth: 0, flexDirection: 'row' },
  rail: { flexShrink: 0, minHeight: 0, paddingVertical: 10, alignItems: 'center', backgroundColor: c.rail, borderRightWidth: 1, borderColor: c.line },
  railScroll: { flex: 1, width: '100%', minHeight: 0 }, railContent: { alignItems: 'center', gap: 10, paddingBottom: 12, paddingTop: 4 },
  railButton: { width: 50, height: 50, flexShrink: 0, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', position: 'relative' }, railButtonPhone: { width: 44, height: 44, borderRadius: 10 },
  railDivider: { height: 1, width: 34, backgroundColor: c.line, marginVertical: 4 },
  selected: { backgroundColor: c.selected, borderColor: '#3787A8' }, pressed: { opacity: 0.75 },
  workspace: { flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', backgroundColor: c.canvas },
  lightWorkspace: { backgroundColor: employeePortalWorkspace.canvas },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#086B8A', paddingHorizontal: 4, minWidth: 18, borderRadius: 8, alignItems: 'center' }, badgeText: { color: c.text, fontSize: font(10), lineHeight: font(15) },
  footer: { flexShrink: 0, backgroundColor: c.rail },
  menuBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, backgroundColor: 'rgba(0,10,24,0.78)' },
  menu: { width: '100%', maxWidth: 560, maxHeight: '100%', flexShrink: 1, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: c.panel, overflow: 'hidden' },
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 12, borderBottomWidth: 1, borderColor: c.line }, menuTitle: { color: c.text, fontSize: font(22), lineHeight: font(29), flexShrink: 1 },
  menuScroll: { flexShrink: 1, minHeight: 0 }, menuContent: { gap: 6, padding: 12 },
  menuItem: { minHeight: 54, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 12 }, menuLabel: { flex: 1, minWidth: 0, color: c.text, fontSize: font(15), lineHeight: font(22) },
  menuTextSize: { gap: 10, alignItems: 'flex-start', padding: 12 }, logout: { borderTopColor: c.line }, error: { color: c.danger, fontSize: font(14), lineHeight: font(21), padding: 12 },
}));
