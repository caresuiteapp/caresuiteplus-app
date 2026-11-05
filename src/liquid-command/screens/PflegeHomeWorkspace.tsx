import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { DocumentRecommendations } from '@/components/documents/DocumentRecommendations';
import { PflegeDashboardView } from '@/components/dashboard/PflegeDashboardView';
import { usePflegeDashboard } from '@/hooks/usePflegeDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';
import { canShowDesktopCatalogRoute } from '../navigation/appsWidgetsCatalogModel.shared';
import { buildPflegeWorkspaceGroups, pflegeWorkspaceColumnCount } from '../navigation/pflegeWorkspaceLaunchers';
import { LiquidButton, LiquidGlyph, LiquidState, LiquidSurface, LiquidText } from '../components/LiquidPrimitives';
import { liquidColors, liquidRadius, liquidSpace } from '../foundation/tokens';
import { LiquidCommandShell } from '../shell/LiquidCommandShell';

export function PflegeHomeWorkspace({ tenantId }: { tenantId: string | null }) {
  const router = useRouter();
  const dashboard = usePflegeDashboard();
  const access = usePermissions();
  const latest = useRef({ access, tenantId });
  latest.current = { access, tenantId };
  const { fontScale } = useHydrationSafeWindowDimensions();
  const [contentWidth, setContentWidth] = useState(0);
  const groups = tenantId && access.tenantId === tenantId ? buildPflegeWorkspaceGroups(access) : [];
  const columns = pflegeWorkspaceColumnCount(contentWidth, fontScale);
  const cardWidth = contentWidth > 0 ? (contentWidth - liquidSpace[4] * (columns - 1)) / columns : undefined;
  const canOpen = (route: string) => {
    const current = latest.current;
    return Boolean(tenantId && current.tenantId === tenantId && current.access.tenantId === tenantId &&
      current.access.roleKey === access.roleKey && canShowDesktopCatalogRoute(route, current.access));
  };
  const open = (route: string) => {
    if (!canOpen(route)) return;
    router.push(route as never);
  };
  const shortcuts = groups.flatMap(group => group.links).filter(link => [
    '/pflege/klienten', '/pflege/plans', '/pflege/sis', '/pflege/dokumentation',
    '/pflege/uebergaben', '/pflege/leistungsnachweise',
  ].includes(link.route));

  return (
    <LiquidCommandShell
      activeModule="pflege"
      activeArea="home"
      title="Pflege"
      subtitle="Versorgung planen, dokumentieren und im Team abstimmen"
      contextLabel="Ambulante Pflege"
      contextDetail={tenantId ? 'Pflegeakten · Planung · Dokumentation' : 'Mandantenkontext fehlt'}
      aside={shortcuts.length ? (
        <LiquidSurface solid contentStyle={styles.aside}>
          <LiquidText variant="kicker">SCHNELLZUGRIFF</LiquidText>
          <LiquidText variant="section">Im Pflegealltag</LiquidText>
          {shortcuts.map(link => (
            <LiquidButton key={link.id} label={link.label} variant="secondary" fullWidth onPress={() => open(link.route)} />
          ))}
        </LiquidSurface>
      ) : undefined}
    >
      {!tenantId ? (
        <LiquidState kind="error" title="Mandantenkontext fehlt" message="Die Pflege-Startseite kann erst nach erfolgreicher Mandantenzuordnung geladen werden." />
      ) : (
        <View style={styles.content}>
          <View style={styles.heading}>
            <View style={styles.introduction}>
              <LiquidText variant="section" accessibilityRole="header">Ihre Pflegebereiche</LiquidText>
              <LiquidText variant="body">Öffnen Sie die für Ihre Rolle verfügbaren Arbeitsbereiche.</LiquidText>
            </View>
            <LiquidButton label="Aktualisieren" icon="↻" variant="secondary" onPress={() => void dashboard.refresh()} />
          </View>
          {groups.length ? (
            <View style={styles.grid} onLayout={event => setContentWidth(event.nativeEvent.layout.width)}>
              {groups.map(group => (
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
            </View>
          ) : (
            <LiquidState kind="empty" title="Keine Pflegebereiche verfügbar" message="Für die aktuelle Rolle wurden noch keine Pflegebereiche bestätigt. Die Rechte werden beim Öffnen erneut geprüft." />
          )}
          <PflegeDashboardView overviewOnly canOpenRoute={canOpen} onOpenRoute={open} stats={dashboard.stats} activePlans={dashboard.activePlans} loading={dashboard.loading} error={dashboard.error} onRefresh={dashboard.refresh} />
          <DocumentRecommendations module="pflege" workflow="care" compact />
        </View>
      )}
    </LiquidCommandShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: liquidSpace[5], width: '100%', minWidth: 0 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: liquidSpace[3] },
  introduction: { gap: liquidSpace[2], flexGrow: 1, flexShrink: 1, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: liquidSpace[4], width: '100%', minWidth: 0 },
  card: { maxWidth: '100%', minWidth: 0 },
  cardContent: { padding: liquidSpace[4], gap: liquidSpace[3], minWidth: 0 },
  links: { gap: liquidSpace[1], minWidth: 0 },
  link: { flexDirection: 'row', alignItems: 'center', gap: liquidSpace[2], minHeight: 48, paddingVertical: liquidSpace[3], paddingHorizontal: liquidSpace[2], borderRadius: liquidRadius.control, minWidth: 0 },
  linkActive: { backgroundColor: liquidColors.blue500Alpha16 },
  linkText: { flex: 1, minWidth: 0, gap: liquidSpace[1] },
  linkTitle: { fontWeight: '600', flexShrink: 1 },
  description: { color: liquidColors.white72, flexShrink: 1 },
  aside: { padding: liquidSpace[4], gap: liquidSpace[3] },
});
