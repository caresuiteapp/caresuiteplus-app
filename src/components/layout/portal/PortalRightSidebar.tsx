import { useState } from 'react';
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
import {
  auroraGlass,
  darkGlassSurfaceText,
  lightSurfaceText,
  useAuroraGlassActive,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalSidebarData } from '@/hooks/usePortalSidebarData';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';

type PortalRightSidebarProps = {
  accentColor?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** Client portal context panel — mandant, status, KPIs, quick access, support. */
export function PortalRightSidebar({ accentColor = '#FF9500' }: PortalRightSidebarProps) {
  const router = useRouter();
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const cardText = auroraActive && isLight ? lightSurfaceText : darkGlassSurfaceText;
  const panelText = darkGlassSurfaceText;
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const {
    context,
    kpis,
    quickActions,
    lastLoginFormatted,
    terminology,
    moduleLabel,
    releaseLabel,
    navigateQuickAction,
  } = usePortalSidebarData();
  const [mandantOpen, setMandantOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  if (!context || !terminology || width < 1200) {
    return null;
  }

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        <GlassCard style={styles.card}>
          <Text style={[type.caption, styles.sectionEyebrow, { color: cardText.muted }]}>MANDANT</Text>
          <Text style={[type.bodyStrong, { color: cardText.primary }]} numberOfLines={2}>
            {context.tenantName}
          </Text>
          <Text style={[type.caption, { color: cardText.secondary }]}>{moduleLabel}</Text>
          <Pressable
            onPress={() => setMandantOpen(true)}
            style={[styles.detailsBtn, webCursor]}
            accessibilityRole="button"
          >
            <Text style={[type.caption, { color: accentColor, fontWeight: '700' }]}>Details</Text>
          </Pressable>
        </GlassCard>

        <View style={styles.section}>
          <Text style={[type.caption, styles.sectionEyebrow, { color: panelText.muted }]}>PORTAL-STATUS</Text>
          <View style={styles.statusRow}>
            <Text style={[type.caption, { color: panelText.secondary }]}>Freigabe</Text>
            <Text style={[type.caption, { color: panelText.primary, fontWeight: '700' }]}>{releaseLabel}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[type.caption, { color: panelText.secondary }]}>Rolle</Text>
            <Text style={[type.caption, { color: panelText.primary, fontWeight: '700' }]}>
              {terminology.personLabel}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[type.caption, { color: panelText.secondary }]}>Modul</Text>
            <Text style={[type.caption, { color: panelText.primary, fontWeight: '700' }]}>{moduleLabel}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[type.caption, { color: panelText.secondary }]}>Letzter Login</Text>
            <Text style={[type.caption, { color: panelText.primary, fontWeight: '600' }]}>
              {lastLoginFormatted}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[type.caption, styles.sectionEyebrow, { color: panelText.muted }]}>
            HEUTE AUF EINEN BLICK
          </Text>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={styles.kpiList}>
            {kpis.map((kpi) => (
              <View key={kpi.label} style={styles.kpiRow}>
                <Text style={[type.caption, { color: panelText.secondary, flex: 1 }]}>{kpi.label}</Text>
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
          <Text style={[type.caption, styles.sectionEyebrow, { color: panelText.muted }]}>SCHNELLZUGRIFF</Text>
          <View style={styles.actionList}>
            {quickActions.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => navigateQuickAction(action.href)}
                style={[styles.actionBtn, webCursor]}
                accessibilityRole="button"
              >
                <Text style={styles.actionIcon}>{action.icon}</Text>
                <Text style={[type.caption, { color: panelText.primary, fontWeight: '600' }]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.supportSection]}>
          <Text style={[type.caption, styles.sectionEyebrow, { color: panelText.muted }]}>
            SUPPORT & HILFE
          </Text>
          <Pressable onPress={() => setHelpOpen(true)} style={styles.supportLink}>
            <Text style={[type.caption, { color: panelText.secondary, fontWeight: '600' }]}>
              ❓ Hilfe & Kontakt
            </Text>
          </Pressable>
          <Pressable onPress={() => openExternal(SUPPORT_LINKS.privacy)} style={styles.supportLink}>
            <Text style={[type.caption, { color: panelText.secondary, fontWeight: '600' }]}>
              🔒 Datenschutz
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push('/portal/client/help' as never)} style={styles.supportLink}>
            <Text style={[type.caption, { color: panelText.secondary, fontWeight: '600' }]}>
              📋 Betroffenenrechte
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <PortalGlassModal visible={mandantOpen} onClose={() => setMandantOpen(false)} title="Mandant">
        <Text style={[type.body, { color: cardText.primary, fontWeight: '700' }]}>{context.tenantName}</Text>
        <Text style={[type.body, { color: cardText.secondary, marginTop: careSpacing.sm }]}>
          {moduleLabel} · {terminology.greetingLabel}
        </Text>
        <Text style={[type.caption, { color: cardText.muted, marginTop: careSpacing.md }]}>
          Informationen zu Ihrem Pflegebüro — rein informativ, ohne Verwaltungsfunktionen.
        </Text>
      </PortalGlassModal>

      <PortalGlassModal visible={helpOpen} onClose={() => setHelpOpen(false)} title="Support & Hilfe">
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.help)} style={styles.supportLink}>
          <Text style={[type.body, { color: panelText.primary }]}>Hilfe & Dokumentation öffnen</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setHelpOpen(false);
            router.push('/portal/client/help' as never);
          }}
          style={styles.supportLink}
        >
          <Text style={[type.body, { color: panelText.primary }]}>Kontakt zum Pflegebüro</Text>
        </Pressable>
      </PortalGlassModal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 280,
    height: '100%',
    minHeight: 0,
    backgroundColor: auroraGlass.panel,
    borderLeftWidth: 1,
    borderLeftColor: auroraGlass.border,
    ...(Platform.OS === 'web'
      ? ({ overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'stable' } as unknown as ViewStyle)
      : null),
  },
  content: {
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
