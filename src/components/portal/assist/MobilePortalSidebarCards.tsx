import { useMemo, useState } from 'react';
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
import { PORTAL_MOBILE_CTA_GOLD } from '@/components/portal/assist/MobilePortalKpiCard';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalSidebarData } from '@/hooks/usePortalSidebarData';
import { canAccessPortalFeature } from '@/lib/portal/engine';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';

type MobilePortalSidebarCardsProps = {
  accentColor?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** Mobile scroll cards mirroring desktop PortalRightSidebar content. */
export function MobilePortalSidebarCards({ accentColor = PORTAL_MOBILE_CTA_GOLD }: MobilePortalSidebarCardsProps) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const {
    context,
    kpis,
    lastLoginFormatted,
    terminology,
    moduleLabel,
    releaseLabel,
    navigateQuickAction,
  } = usePortalSidebarData();
  const [mandantOpen, setMandantOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const quickActions = useMemo(() => {
    const actions = [
      { key: 'message', label: 'Nachricht', icon: '💬', href: '/portal/client/messages?compose=1' },
      { key: 'termin', label: 'Termin anfragen', icon: '📅', href: '/portal/client?action=zusatztermin' },
      { key: 'upload', label: 'Upload', icon: '📎', href: '/portal/client?action=upload' },
      { key: 'rueckruf', label: 'Rückrufbitte', icon: '📞', href: '/portal/client?action=rueckruf' },
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

  if (!context || !terminology) return null;

  return (
    <>
      <GlassCard style={styles.card}>
        <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>MANDANT</Text>
        <View style={styles.mandantRow}>
          <View style={styles.mandantIconWrap}>
            <Text style={styles.mandantIcon}>🏢</Text>
          </View>
          <View style={styles.mandantCopy}>
            <Text style={[type.bodyStrong, { color: text.primary }]} numberOfLines={2}>
              {context.tenantName}
            </Text>
            <Text style={[type.caption, { color: text.secondary }]}>{moduleLabel}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => setMandantOpen(true)}
          style={[styles.detailsBtn, webCursor]}
          accessibilityRole="button"
        >
          <Text style={[type.caption, { color: accentColor, fontWeight: '700' }]}>Details →</Text>
        </Pressable>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>PORTAL-STATUS</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusLabelRow}>
            <View style={styles.statusDot} />
            <Text style={[type.caption, { color: text.secondary }]}>Freigabe</Text>
          </View>
          <Text style={[type.caption, { color: text.primary, fontWeight: '700' }]}>{releaseLabel}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={[type.caption, { color: text.secondary }]}>Rolle</Text>
          <Text style={[type.caption, { color: text.primary, fontWeight: '700' }]}>
            {terminology.personLabel}
          </Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>AUF EINEN BLICK</Text>
        {kpis.map((kpi) => (
          <View key={kpi.label} style={styles.glanceRow}>
            <Text style={[type.caption, { color: text.secondary, flex: 1 }]}>{kpi.label}</Text>
            <Text style={[type.caption, { color: text.muted, fontWeight: '700' }]}>{kpi.value ?? 0}</Text>
            <Text style={[type.caption, styles.chevron, { color: text.muted }]}>›</Text>
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
          <Text style={[type.caption, { color: text.secondary, fontWeight: '600' }]}>
            Hilfe & Dokumentation
          </Text>
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
        <Text style={[type.caption, { color: text.muted, marginTop: careSpacing.sm }]}>
          Letzter Login: {lastLoginFormatted}
        </Text>
      </PortalGlassModal>

      <PortalGlassModal visible={helpOpen} onClose={() => setHelpOpen(false)} title="Support & Hilfe">
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.help)} style={styles.supportLink}>
          <Text style={[type.body, { color: text.primary }]}>Hilfe & Dokumentation öffnen</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.privacy)} style={styles.supportLink}>
          <Text style={[type.body, { color: text.primary }]}>Datenschutz</Text>
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
    backgroundColor: 'rgba(20,27,40,0.85)',
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
  mandantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
  },
  mandantIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mandantIcon: {
    fontSize: 18,
  },
  mandantCopy: {
    flex: 1,
    gap: 2,
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
  statusLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },
  glanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: careSpacing.xs,
    gap: careSpacing.sm,
  },
  chevron: {
    fontSize: 16,
    lineHeight: 18,
  },
  quickRow: {
    gap: careSpacing.xs,
    paddingRight: careSpacing.lg,
    paddingLeft: 2,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.xs,
    minHeight: 44,
    paddingHorizontal: careSpacing.md,
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
