import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { DocumentRecommendations } from '@/components/documents/DocumentRecommendations';
import { PflegeDashboardView } from '@/components/dashboard/PflegeDashboardView';
import { usePflegeDashboard } from '@/hooks/usePflegeDashboard';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';
import { canShowDesktopCatalogRoute } from '../navigation/appsWidgetsCatalogModel.shared';
import { buildPflegeWorkspaceGroups, hasPflegeWorkspaceSearch, pflegeEverydayLinks, pflegeWorkspaceColumnCount, searchPflegeWorkspaceGroups } from '../navigation/pflegeWorkspaceLaunchers';
import { LiquidButton, LiquidField, LiquidGlyph, LiquidState, LiquidSurface, LiquidText } from '../components/LiquidPrimitives';
import { liquidColors, liquidRadius, liquidSpace } from '../foundation/tokens';
import { LiquidCommandShell } from '../shell/LiquidCommandShell';

export function PflegeHomeWorkspace({ tenantId }: { tenantId: string | null }) {
  const router = useRouter();
  const dashboard = usePflegeDashboard();
  const { access, isScopeCurrent } = dashboard;
  const latest = useRef({ access, tenantId, isScopeCurrent });
  latest.current = { access, tenantId, isScopeCurrent };
  const { fontScale } = useHydrationSafeWindowDimensions();
  const [query, setQuery] = useState('');
  const [contentWidth, setContentWidth] = useState(0);
  const sameTenant = !!tenantId && access.tenantId === tenantId;
  const canReadHome = sameTenant && isScopeCurrent() && access.can('office.access');
  const groups = canReadHome ? buildPflegeWorkspaceGroups(access) : [];
  const searching = hasPflegeWorkspaceSearch(query);
  const shownGroups = searching ? searchPflegeWorkspaceGroups(groups, query) : groups;
  const found = searching ? shownGroups.reduce((count, group) => count + group.links.length, 0) : 0;
  const shortcutLinks = pflegeEverydayLinks(groups);
  const columns = pflegeWorkspaceColumnCount(contentWidth, fontScale);
  const cardWidth = contentWidth > 0 ? (contentWidth - liquidSpace[4] * (columns - 1)) / columns : undefined;
  const canOpen = (route: string) => {
    const current = latest.current;
    return Boolean(tenantId && isScopeCurrent() && current.isScopeCurrent() &&
      current.tenantId === tenantId && current.access.tenantId === tenantId &&
      current.access.roleKey === access.roleKey && canShowDesktopCatalogRoute(route, current.access));
  };
  const open = (route: string) => {
    if (!canOpen(route)) return;
    router.push(route as never);
  };

  return (
    <LiquidCommandShell
      activeModule="pflege"
      activeArea="home"
      title="Pflege"
      subtitle="Versorgung planen, dokumentieren und im Team abstimmen"
      contextLabel="Ambulante Pflege"
      contextDetail={tenantId ? 'Pflegeakten · Planung · Dokumentation' : 'Mandantenkontext fehlt'}
    >
      {!tenantId ? (
        <LiquidState kind="error" title="Mandantenkontext fehlt" message="Die Pflege-Startseite kann erst nach erfolgreicher Mandantenzuordnung geladen werden." />
      ) : !canReadHome ? (
        access.loading ? <LiquidState kind="loading" title="Pflegezugriff wird geprüft" message="Die verfügbaren Arbeitsbereiche werden geladen." />
          : access.error ? <LiquidState kind="error" title="Pflegezugriff nicht bestätigt" message={access.error}
            actionLabel="Zugriff erneut prüfen" onAction={() => { if (access.tenantId === tenantId) access.refreshPermissions(); }} />
            : <LiquidState kind="locked" title="Keine Pflegebereiche verfügbar" message="Für diesen Mandanten ist kein Pflegezugriff bestätigt." />
      ) : (
        <View style={styles.content}>
          <LiquidSurface solid contentStyle={styles.finder}>
            <View style={styles.introduction}>
              <LiquidText variant="section" accessibilityRole="header">Ihre Pflegebereiche</LiquidText>
              <LiquidText variant="body">Finden Sie einen Arbeitsbereich oder öffnen Sie ihn direkt im Schnellzugriff.</LiquidText>
            </View>
            {groups.length ? <View style={styles.searchRow}>
              <View style={styles.searchField}>
                <LiquidField label="Pflegebereiche suchen" value={query} onChangeText={setQuery}
                  placeholder="Zum Beispiel Mediplan, Wunden oder SIS" autoCorrect={false} autoCapitalize="none"
                  returnKeyType="search" maxLength={100} />
              </View>
              {query.length ? <LiquidButton label="Suche löschen" onPress={() => setQuery('')} variant="ghost" /> : null}
            </View> : null}
            {searching ? <View accessibilityLiveRegion="polite">
              <LiquidText variant="meta">{found === 1 ? '1 Pflegebereich gefunden' : `${found} Pflegebereiche gefunden`}</LiquidText>
            </View> : null}
            {!searching && shortcutLinks.length ? <View style={styles.shortcuts}>
              <LiquidText variant="meta" accessibilityRole="header" style={styles.shortcutTitle}>Schnellzugriff</LiquidText>
              <View style={styles.shortcutRow}>
                {shortcutLinks.map(link => <LiquidButton key={link.id} label={link.label} variant="secondary"
                  onPress={() => open(link.route)} />)}
              </View>
            </View> : null}
          </LiquidSurface>
          {groups.length ? (
            shownGroups.length ? <View style={styles.grid} onLayout={event => setContentWidth(event.nativeEvent.layout.width)}>
              {shownGroups.map(group => (
                <LiquidSurface key={group.title} solid style={[styles.card, { width: cardWidth ?? '100%' }]} contentStyle={styles.cardContent}>
                  <LiquidText variant="section" accessibilityRole="header">{group.title}</LiquidText>
                  <View style={styles.links}>
                    {group.links.map(link => (
                      <Pressable
                        key={link.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${link.label} öffnen`}
                        onPress={() => open(link.route)}
                        style={({ pressed }) => [styles.link, pressed && styles.linkActive]}
                      >
                        <View style={styles.linkText}>
                          <LiquidText variant="body" style={styles.linkTitle}>{link.label}</LiquidText>
                          {link.description ? <LiquidText variant="meta" style={styles.description}>{link.description}</LiquidText> : null}
                        </View>
                        <LiquidGlyph glyph="›" size={19} color={liquidColors.blue300} />
                      </Pressable>
                    ))}
                  </View>
                </LiquidSurface>
              ))}
            </View> : <LiquidState kind="empty" title="Keine passenden Pflegebereiche" message="Versuchen Sie einen anderen Suchbegriff."
              actionLabel="Alle Pflegebereiche anzeigen" onAction={() => setQuery('')} />
          ) : (
            <LiquidState kind="empty" title="Keine Pflegebereiche verfügbar" message="Für die aktuelle Rolle sind keine Arbeitsbereiche freigegeben." />
          )}
          {!searching ? <>
            <View style={styles.dashboard}>
              <View style={styles.heading}>
                <LiquidText variant="section" accessibilityRole="header">Kennzahlen</LiquidText>
                <LiquidButton label="Kennzahlen aktualisieren" icon="↻" variant="secondary" loading={dashboard.refreshing}
                  onPress={() => { if (isScopeCurrent()) void dashboard.refresh(); }} />
              </View>
              <PflegeDashboardView overviewOnly canOpenRoute={canOpen} onOpenRoute={open} stats={dashboard.stats}
                activePlans={dashboard.activePlans} loading={dashboard.loading} error={dashboard.error} refreshError={dashboard.refreshError}
                refreshing={dashboard.refreshing} onRefresh={dashboard.refresh} />
            </View>
            <DocumentRecommendations module="pflege" workflow="care" compact />
          </> : null}
        </View>
      )}
    </LiquidCommandShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: liquidSpace[5], width: '100%', minWidth: 0 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: liquidSpace[3] },
  introduction: { gap: liquidSpace[2], flexGrow: 1, flexShrink: 1, minWidth: 0 },
  finder: { padding: liquidSpace[4], gap: liquidSpace[4], minWidth: 0 },
  searchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: liquidSpace[2], alignItems: 'flex-end', maxWidth: 760 },
  searchField: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0 },
  shortcuts: { gap: liquidSpace[2] },
  shortcutTitle: { fontWeight: '600', color: liquidColors.white88 },
  shortcutRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: liquidSpace[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: liquidSpace[4], width: '100%', minWidth: 0 },
  card: { maxWidth: '100%', minWidth: 0 },
  cardContent: { padding: liquidSpace[4], gap: liquidSpace[3], minWidth: 0 },
  links: { gap: liquidSpace[1], minWidth: 0 },
  link: { flexDirection: 'row', alignItems: 'center', gap: liquidSpace[2], minHeight: 48, paddingVertical: liquidSpace[3], paddingHorizontal: liquidSpace[2], borderRadius: liquidRadius.control, minWidth: 0 },
  linkActive: { backgroundColor: liquidColors.blue500Alpha16 },
  linkText: { flex: 1, minWidth: 0, gap: liquidSpace[1] },
  linkTitle: { fontWeight: '600', flexShrink: 1 },
  description: { color: liquidColors.white72, flexShrink: 1 },
  dashboard: { gap: liquidSpace[4], paddingTop: liquidSpace[4], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: liquidColors.white22 },
});
