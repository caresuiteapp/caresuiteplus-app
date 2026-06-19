import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalContext } from '@/hooks/usePortalContext';
import { fetchAssistDashboardData } from '@/lib/portal/assist/portalAssistDashboardService';
import {
  canAccessPortalFeature,
  resolveCombinedModuleLabel,
  resolvePortalTerminology,
} from '@/lib/portal/engine';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import type { AssistDashboardData } from '@/types/portal/assist';

type PortalRightSidebarProps = {
  accentColor?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

function formatLoginTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

async function fetchClientLastLogin(tenantId: string, clientId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('client_portal_access')
    .select('last_login_at')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[PortalRightSidebar] last login:', error.message);
    }
    return null;
  }

  return data?.last_login_at ? String(data.last_login_at) : null;
}

/** Client portal context panel — mandant, status, KPIs, quick access, support. */
export function PortalRightSidebar({ accentColor = '#FF9500' }: PortalRightSidebarProps) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const { context } = usePortalContext();
  const [dashboard, setDashboard] = useState<AssistDashboardData | null>(null);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [mandantOpen, setMandantOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const loadSidebarData = useCallback(async () => {
    if (!context) return;

    const loginPromise = fetchClientLastLogin(context.tenantId, context.clientId);
    if (context.primaryModule === 'assist') {
      const result = await fetchAssistDashboardData(context);
      if (result.ok) setDashboard(result.data);
    }
    setLastLogin(await loginPromise);
  }, [context]);

  useEffect(() => {
    void loadSidebarData();
  }, [loadSidebarData]);

  const kpis = useMemo(() => {
    if (dashboard) {
      return [
        { label: 'Termine', value: dashboard.kpis.appointments },
        { label: 'Nachrichten', value: dashboard.kpis.messages },
        { label: 'Dokumente', value: dashboard.kpis.documents },
        { label: 'Anfragen offen', value: dashboard.kpis.openRequests },
      ];
    }
    if (!context) return [];
    return [
      { label: 'Termine', value: context.metrics.upcomingAppointments },
      { label: 'Nachrichten', value: context.metrics.openMessages },
      { label: 'Dokumente', value: context.metrics.documents },
    ];
  }, [context, dashboard]);

  const quickActions = useMemo(() => {
    const actions = [
      { key: 'message', label: 'Nachricht', icon: '💬', href: '/portal/client/messages?compose=1' },
      { key: 'termin', label: 'Terminänderung', icon: '📅', href: '/portal/client?action=termin_aendern' },
      { key: 'zusatztermin', label: 'Zusatztermin', icon: '➕', href: '/portal/client?action=zusatztermin' },
      { key: 'upload', label: 'Upload', icon: '📎', href: '/portal/client?action=upload' },
      { key: 'rueckruf', label: 'Rückruf', icon: '📞', href: '/portal/client?action=rueckruf' },
    ];
    if (context && canAccessPortalFeature(context, 'assist', 'nachweise')) {
      actions.push({
        key: 'nachweise',
        label: 'Nachweise',
        icon: '📋',
        href: '/portal/client?action=nachweise',
      });
    }
    return actions;
  }, [context]);

  if (!context || width < 1200) {
    return null;
  }

  const terminology = resolvePortalTerminology(context.primaryModule);
  const moduleLabel = resolveCombinedModuleLabel(context.activeModuleKeys);
  const releaseLabel =
    context.visibleFeatures.length > 0 ? 'Freigabe aktiv' : 'Freigabe ausstehend';

  return (
    <>
      <View style={styles.root}>
        <GlassCard style={styles.card}>
          <Text style={[type.caption, styles.sectionEyebrow, { color: text.muted }]}>MANDANT</Text>
          <Text style={[type.bodyStrong, { color: text.primary }]} numberOfLines={2}>
            {context.tenantName}
          </Text>
          <Text style={[type.caption, { color: text.secondary }]}>{moduleLabel}</Text>
          <Pressable
            onPress={() => setMandantOpen(true)}
            style={[styles.detailsBtn, webCursor]}
            accessibilityRole="button"
          >
            <Text style={[type.caption, { color: accentColor, fontWeight: '700' }]}>Details</Text>
          </Pressable>
        </GlassCard>

        <View style={styles.section}>
          <Text style={[type.caption, styles.sectionEyebrow, { color: text.muted }]}>PORTAL-STATUS</Text>
          <View style={styles.statusRow}>
            <Text style={[type.caption, { color: text.secondary }]}>Freigabe</Text>
            <Text style={[type.caption, { color: text.primary, fontWeight: '700' }]}>{releaseLabel}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[type.caption, { color: text.secondary }]}>Rolle</Text>
            <Text style={[type.caption, { color: text.primary, fontWeight: '700' }]}>
              {terminology.personLabel}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[type.caption, { color: text.secondary }]}>Modul</Text>
            <Text style={[type.caption, { color: text.primary, fontWeight: '700' }]}>{moduleLabel}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[type.caption, { color: text.secondary }]}>Letzter Login</Text>
            <Text style={[type.caption, { color: text.primary, fontWeight: '600' }]}>
              {formatLoginTime(lastLogin)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[type.caption, styles.sectionEyebrow, { color: text.muted }]}>
            HEUTE AUF EINEN BLICK
          </Text>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={styles.kpiList}>
            {kpis.map((kpi) => (
              <View key={kpi.label} style={styles.kpiRow}>
                <Text style={[type.caption, { color: text.secondary, flex: 1 }]}>{kpi.label}</Text>
                <View style={[styles.kpiBadge, { backgroundColor: auroraGlass.chipActive }]}>
                  <Text style={[type.caption, { color: accentColor, fontWeight: '800' }]}>
                    {kpi.value ?? 0}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={[type.caption, styles.sectionEyebrow, { color: text.muted }]}>SCHNELLZUGRIFF</Text>
          <View style={styles.actionList}>
            {quickActions.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => router.push(action.href as never)}
                style={[styles.actionBtn, webCursor]}
                accessibilityRole="button"
              >
                <Text style={styles.actionIcon}>{action.icon}</Text>
                <Text style={[type.caption, { color: text.primary, fontWeight: '600' }]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.supportSection]}>
          <Text style={[type.caption, styles.sectionEyebrow, { color: text.muted }]}>
            SUPPORT & HILFE
          </Text>
          <Pressable onPress={() => setHelpOpen(true)} style={styles.supportLink}>
            <Text style={[type.caption, { color: text.secondary, fontWeight: '600' }]}>
              ❓ Hilfe & Kontakt
            </Text>
          </Pressable>
          <Pressable onPress={() => openExternal(SUPPORT_LINKS.privacy)} style={styles.supportLink}>
            <Text style={[type.caption, { color: text.secondary, fontWeight: '600' }]}>
              🔒 Datenschutz
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push('/portal/client?module=assist&section=hilfe' as never)} style={styles.supportLink}>
            <Text style={[type.caption, { color: text.secondary, fontWeight: '600' }]}>
              📋 Betroffenenrechte
            </Text>
          </Pressable>
        </View>
      </View>

      <PortalGlassModal visible={mandantOpen} onClose={() => setMandantOpen(false)} title="Mandant">
        <Text style={[type.body, { color: text.primary, fontWeight: '700' }]}>{context.tenantName}</Text>
        <Text style={[type.body, { color: text.secondary, marginTop: careSpacing.sm }]}>
          {moduleLabel} · {terminology.greetingLabel}
        </Text>
        <Text style={[type.caption, { color: text.muted, marginTop: careSpacing.md }]}>
          Informationen zu Ihrem Pflegebüro — rein informativ, ohne Verwaltungsfunktionen.
        </Text>
      </PortalGlassModal>

      <PortalGlassModal visible={helpOpen} onClose={() => setHelpOpen(false)} title="Support & Hilfe">
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.help)} style={styles.supportLink}>
          <Text style={[type.body, { color: text.primary }]}>Hilfe & Dokumentation öffnen</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setHelpOpen(false);
            router.push('/portal/client?module=assist&section=hilfe' as never);
          }}
          style={styles.supportLink}
        >
          <Text style={[type.body, { color: text.primary }]}>Kontakt zum Pflegebüro</Text>
        </Pressable>
      </PortalGlassModal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 280,
    backgroundColor: auroraGlass.panel,
    borderLeftWidth: 1,
    borderLeftColor: auroraGlass.border,
    paddingHorizontal: careSpacing.md,
    paddingTop: careSpacing.lg,
    paddingBottom: careSpacing.lg,
    gap: careSpacing.md,
  },
  card: {
    gap: careSpacing.xs,
    padding: careSpacing.md,
  },
  section: {
    gap: careSpacing.xs,
  },
  sectionEyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: careSpacing.xs,
  },
  detailsBtn: {
    alignSelf: 'flex-start',
    marginTop: careSpacing.xs,
    paddingVertical: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: careSpacing.sm,
  },
  kpiList: {
    maxHeight: 140,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: careSpacing.xs,
    gap: careSpacing.sm,
  },
  kpiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 28,
    alignItems: 'center',
  },
  actionList: {
    gap: careSpacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.chip,
    minHeight: 44,
  },
  actionIcon: {
    fontSize: 16,
  },
  supportSection: {
    marginTop: 'auto',
  },
  supportLink: {
    paddingVertical: careSpacing.xs,
  },
});
