import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { ClientPortalArtwork } from './ClientPortalArtwork';
import { clientPortalDesign as c, clientPortalActiveId } from './clientPortalDesign';
import { liquidPortalNavigation } from '@/liquid-command/navigation/portalCatalog';

type Props = { title: string; subtitle?: string; eyebrow?: string; compact?: boolean; actions?: ReactNode; artworkId?: string };
export function ClientPortalPageHero({ title, subtitle, eyebrow = 'Meine Versorgung', compact, actions, artworkId }: Props) {
  const pathname = usePathname();
  const { isPhone, width } = useDeviceClass();
  const phone = isPhone || width < 640;
  const id = artworkId ?? clientPortalActiveId(pathname, liquidPortalNavigation.client);
  return <View style={[styles.hero, phone && styles.phone, compact && styles.compact]} testID="client-portal-page-hero">
    <View style={styles.copy}><Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={[styles.title, phone && styles.titlePhone]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
    {!phone ? <ClientPortalArtwork id={id} label={title} size={144} /> : null}
  </View>;
}
const styles = StyleSheet.create(withCareSuiteTypography({
  hero: { width: '100%', minWidth: 0, minHeight: 176, padding: 26, borderWidth: 1, borderColor: c.border, borderRadius: 22, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: 22 },
  phone: { padding: 20, minHeight: 0, borderRadius: 20 }, compact: { minHeight: 0 }, copy: { flex: 1, minWidth: 0, gap: 8 },
  eyebrow: { color: c.accent.blue, fontSize: font(13), lineHeight: font(19), fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { color: c.text.primary, fontSize: font(38), lineHeight: font(46), fontWeight: '700', letterSpacing: -1.2, flexShrink: 1 },
  titlePhone: { fontSize: font(29), lineHeight: font(36), letterSpacing: -0.8 }, subtitle: { color: c.text.secondary, fontSize: font(16), lineHeight: font(24), maxWidth: 840 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingTop: 7, minWidth: 0 },
}));
