import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SpaceKpiIcon } from '@/components/icons/space';
import { spatialCare, spatialCareColors } from '@/design/tokens/spatialCareSuite';
import { careSpacing } from '@/design/tokens/spacing';

type SurfaceProps = { children: ReactNode; style?: StyleProp<ViewStyle>; accentColor?: string; compact?: boolean };

export function SpatialPortalSurface({ children, style, accentColor = spatialCareColors.cyanLight, compact = false }: SurfaceProps) {
  return (
    <View style={[styles.surface, compact && styles.surfaceCompact, style]}>
      <LinearGradient colors={['rgba(63,64,101,0.94)', 'rgba(25,27,53,0.98)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      <View style={[styles.edgeGlow, { backgroundColor: accentColor }]} pointerEvents="none" />
      <View style={styles.sheen} pointerEvents="none" />
      <View style={styles.orbLarge} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

type SectionProps = SurfaceProps & { title: string; subtitle?: string };

export function SpatialPortalSection({ title, subtitle, children, accentColor, style }: SectionProps) {
  return (
    <SpatialPortalSurface accentColor={accentColor} style={style}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.spatialObject} pointerEvents="none">
          <View style={styles.spatialObjectCore} />
          <View style={styles.spatialObjectRing} />
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </SpatialPortalSurface>
  );
}

type MetricProps = { label: string; value: string | number; subValue?: string; icon?: string; accentColor?: string };

export function SpatialPortalMetric({ label, value, subValue, icon, accentColor = spatialCareColors.cyanLight }: MetricProps) {
  return (
    <View style={styles.metric}>
      <LinearGradient colors={['rgba(117,116,151,0.52)', 'rgba(45,47,78,0.72)']} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.metricRim, { backgroundColor: accentColor }]} />
      {icon ? (
        <View style={[styles.iconStage, { borderColor: `${accentColor}8A` }]}>
          <View style={[styles.iconGlow, { backgroundColor: `${accentColor}22` }]} />
          <SpaceKpiIcon icon={icon} accentColor={accentColor} size={30} active frame="rail" />
        </View>
      ) : null}
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: accentColor }]}>{value}</Text>
      {subValue ? <Text style={styles.metricMeta}>{subValue}</Text> : null}
    </View>
  );
}

export function SpatialPortalPearlState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.pearlState}>
      <LinearGradient colors={['rgba(244,241,249,0.98)', 'rgba(211,205,225,0.96)']} style={StyleSheet.absoluteFillObject} />
      <Text style={styles.pearlTitle}>{title}</Text>
      <Text style={styles.pearlMessage}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    width: '100%', position: 'relative', overflow: 'hidden', borderRadius: 26,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)', backgroundColor: spatialCare.stageStrong,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 24px 64px rgba(4,7,25,0.34)', backdropFilter: 'blur(30px) saturate(130%)' } as unknown as ViewStyle) : { shadowColor: '#050718', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 }),
  },
  surfaceCompact: { borderRadius: 20 },
  content: { position: 'relative', zIndex: 2 },
  edgeGlow: { position: 'absolute', left: 0, top: 26, bottom: 26, width: 4, borderRadius: 5, shadowColor: spatialCareColors.cyanLight, shadowOpacity: 0.8, shadowRadius: 14 },
  sheen: { position: 'absolute', left: 22, right: 22, top: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.46)' },
  orbLarge: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -58, top: -90, backgroundColor: 'rgba(130,229,255,0.09)' },
  sectionHeader: { minHeight: 86, paddingHorizontal: careSpacing.lg, paddingVertical: careSpacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  sectionHeading: { flex: 1, minWidth: 0, gap: 3 },
  sectionTitle: { color: '#FFFFFF', fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.35 },
  sectionSubtitle: { color: 'rgba(255,255,255,0.66)', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  sectionBody: { padding: careSpacing.md, gap: careSpacing.sm },
  spatialObject: { width: 48, height: 48, marginLeft: careSpacing.sm, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] },
  spatialObjectCore: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(105,232,255,0.22)', borderWidth: 1, borderColor: 'rgba(170,246,255,0.92)', shadowColor: spatialCareColors.cyanLight, shadowOpacity: 0.9, shadowRadius: 15 },
  spatialObjectRing: { position: 'absolute', width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(105,232,255,0.30)' },
  metric: { minHeight: 146, flex: 1, minWidth: '46%', padding: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', overflow: 'hidden', gap: 4 },
  metricRim: { position: 'absolute', top: 0, left: 32, right: 32, height: 2, opacity: 0.88 },
  iconStage: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  iconGlow: { ...StyleSheet.absoluteFillObject },
  metricLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  metricValue: { fontSize: 25, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6 },
  metricMeta: { color: 'rgba(255,255,255,0.70)', fontSize: 12, lineHeight: 17, fontWeight: '500' },
  pearlState: { position: 'relative', overflow: 'hidden', minHeight: 138, padding: careSpacing.lg, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.74)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pearlTitle: { color: '#17182D', fontSize: 20, lineHeight: 25, fontWeight: '800', textAlign: 'center' },
  pearlMessage: { color: 'rgba(23,24,45,0.72)', fontSize: 14, lineHeight: 20, fontWeight: '500', textAlign: 'center' },
});
