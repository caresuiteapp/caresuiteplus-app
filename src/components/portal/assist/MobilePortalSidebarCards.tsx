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
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalSidebarData } from '@/hooks/usePortalSidebarData';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';

type MobilePortalSidebarCardsProps = {
  accentColor?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** Mobile scroll cards mirroring desktop PortalRightSidebar content. */
export function MobilePortalSidebarCards({ accentColor = '#FF9500' }: MobilePortalSidebarCardsProps) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
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

  if (!context || !terminology) return null;

  return (
    <>
      <GlassCard style={styles.card}>
        <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>MANDANT</Text>
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

      <GlassCard style={styles.card}>
        <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>PORTAL-STATUS</Text>
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
          <Text style={[type.caption, { color: text.primary, fontWeight: '600' }]}>{lastLoginFormatted}</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>AUF EINEN BLICK</Text>
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
      </GlassCard>

      <View style={styles.section}>
        <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>SCHNELLZUGRIFF</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
        >
          {quickActions.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => navigateQuickAction(action.href)}
              style={[styles.quickPill, webCursor]}
              accessibilityRole="button"
            >
              <Text style={styles.quickIcon}>{action.icon}</Text>
              <Text style={[type.caption, { color: text.primary, fontWeight: '600' }]} numberOfLines={1}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <GlassCard style={styles.card}>
        <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>SUPPORT & HILFE</Text>
        <Pressable onPress={() => setHelpOpen(true)} style={styles.supportLink}>
          <Text style={[type.caption, { color: text.secondary, fontWeight: '600' }]}>❓ Hilfe & Kontakt</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.privacy)} style={styles.supportLink}>
          <Text style={[type.caption, { color: text.secondary, fontWeight: '600' }]}>🔒 Datenschutz</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/portal/client?module=assist&section=hilfe' as never)}
          style={styles.supportLink}
        >
          <Text style={[type.caption, { color: text.secondary, fontWeight: '600' }]}>📋 Betroffenenrechte</Text>
        </Pressable>
      </GlassCard>

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
  card: {
    gap: careSpacing.xs,
    padding: careSpacing.md,
  },
  section: {
    gap: careSpacing.sm,
    width: '100%',
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: careSpacing.xs,
  },
  detailsBtn: {
    alignSelf: 'flex-start',
    marginTop: careSpacing.xs,
    paddingVertical: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: careSpacing.sm,
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
  quickRow: {
    gap: careSpacing.xs,
    paddingRight: careSpacing.md,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.xs,
    minHeight: 44,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.chip,
  },
  quickIcon: {
    fontSize: 16,
  },
  supportLink: {
    paddingVertical: careSpacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
});
