import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { LlganViewContext } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { SurfaceContrastProvider, useSurfaceContrastTone } from '@/design/tokens/surfaceContrast';
import { usePortalPremiumTheme } from '@/design/tokens/portalPremium.web';
import { resolveUserFacingSubtitle } from '@/lib/ui/uiVisibility';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';

type Props = { title: string; subtitle?: string; children: ReactNode; headerAlign?: 'left' | 'center';
  headerVariant?: 'default' | 'hero'; accentColor?: string; fillHeight?: boolean;
  surface?: 'glass' | 'open'; viewContext?: LlganViewContext; onDarkSurface?: boolean };
export function SectionPanel({ title, subtitle, children, headerAlign = 'left', headerVariant = 'default',
  accentColor, fillHeight = false, surface = 'glass', onDarkSurface = false }: Props) {
  const tone = useSurfaceContrastTone();
  const portal = usePortalPremiumTheme();
  const dark = onDarkSurface || (tone === 'dark' && !portal.active);
  const open = surface === 'open';
  const userSubtitle = resolveUserFacingSubtitle(subtitle);
  return <SurfaceContrastProvider tone={dark ? 'dark' : 'light'}>
    <View style={[styles.panel, dark && styles.dark, open && styles.open, fillHeight && styles.fill]}
      dataSet={{ csWorkspaceComponent: 'section', csWorkspaceTone: dark ? 'dark' : 'light' }}>
      <View style={[styles.header, open && styles.openHeader, { alignItems: headerAlign === 'center' ? 'center' : 'flex-start', borderBottomColor: dark ? '#31526E' : '#DCE8F2' }]}>
        <View pointerEvents="none" style={[styles.rail, { backgroundColor: accentColor ?? (dark ? '#69D7FF' : '#1477D6') }]} />
        <Text accessibilityRole="header" style={[styles.title, headerVariant === 'hero' && styles.hero, { color: dark ? '#F3F8FF' : '#102B49', textAlign: headerAlign }]}>{title}</Text>
        {userSubtitle ? <Text style={[styles.subtitle, { color: dark ? '#BED6E8' : '#526B82', textAlign: headerAlign }]}>{userSubtitle}</Text> : null}
      </View>
      <View style={[styles.body, open && styles.openBody, fillHeight && styles.fill]}>{children}</View>
    </View>
  </SurfaceContrastProvider>;
}
const styles = StyleSheet.create({
  panel: { width: '100%', minWidth: 0, borderWidth: 1, borderColor: '#CCDBEA', borderRadius: 18, backgroundColor: '#FFFFFF',
    boxShadow: '0 6px 20px rgba(16,43,73,.06)' } as unknown as ViewStyle,
  dark: { backgroundColor: '#0A2747', borderColor: '#31526E' },
  open: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, boxShadow: 'none' } as unknown as ViewStyle,
  fill: { flex: 1, minHeight: 0 },
  header: { minWidth: 0, flexShrink: 0, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 6, borderBottomWidth: 1 },
  rail: { position: 'absolute', top: 0, left: 20, width: 44, height: 2, borderRadius: 2 },
  title: { fontSize: font(20), lineHeight: font(28), fontWeight: '800', maxWidth: '100%' },
  hero: { fontSize: font(28), lineHeight: font(36) },
  subtitle: { fontSize: font(15), lineHeight: font(23), maxWidth: '100%' },
  body: { width: '100%', minWidth: 0, padding: 20, gap: 16 },
  openHeader: { paddingHorizontal: 0 }, openBody: { paddingHorizontal: 0 },
});
