import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HealthOSPageSurface, HealthOSPageZone } from '@/components/layout/HealthOSPageSurface';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { liquidColors, liquidRadius } from '@/liquid-command/foundation/tokens';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  compact?: boolean;
  actionsSlot?: ReactNode;
  filtersSlot?: ReactNode;
  tabsSlot?: ReactNode;
};

export function ClientPortalPageFrame({
  title,
  subtitle,
  eyebrow = 'MEIN KLIENT:INNENPORTAL',
  children,
  compact = false,
  actionsSlot,
  filtersSlot,
  tabsSlot,
}: Props) {
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const small = compact || isPhone;

  return (
    <View style={styles.page} testID="client-portal-page-frame">
      {!small ? (
        <View style={styles.hero}>
          <LinearGradient
            colors={['rgba(17,78,139,0.92)', 'rgba(5,25,54,0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={styles.glow} pointerEvents="none" />
          <View style={styles.heroCopy}>
            <Text style={[type.caption, styles.eyebrow]}>{eyebrow}</Text>
            <Text style={[type.h1, styles.title]}>{title}</Text>
            {subtitle ? <Text style={[type.body, styles.subtitle]}>{subtitle}</Text> : null}
          </View>
        </View>
      ) : null}
      <HealthOSPageSurface padded testID="client-portal-page-surface">
        <HealthOSPageZone kind="actions">{actionsSlot}</HealthOSPageZone>
        <HealthOSPageZone kind="filters">{filtersSlot}</HealthOSPageZone>
        <HealthOSPageZone kind="tabs">{tabsSlot}</HealthOSPageZone>
        <HealthOSPageZone kind="content">
          <View style={styles.content}>{children}</View>
        </HealthOSPageZone>
      </HealthOSPageSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', minHeight: 0, maxWidth: 1640, alignSelf: 'center', gap: careSpacing.md },
  hero: {
    minHeight: 126,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: careSpacing.xl,
    paddingVertical: careSpacing.lg,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    borderRadius: liquidRadius.panel,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 22px 60px rgba(0,18,48,0.26)', backdropFilter: 'blur(24px)' } as unknown as ViewStyle)
      : { shadowColor: '#001530', shadowOpacity: 0.3, shadowRadius: 22, elevation: 8 }),
  },
  glow: {
    position: 'absolute',
    right: -80,
    top: -110,
    width: 290,
    height: 290,
    borderRadius: 999,
    backgroundColor: 'rgba(53,151,255,0.20)',
  },
  heroCopy: { maxWidth: '78%', gap: 4 },
  eyebrow: { color: liquidColors.blue200, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: liquidColors.white, fontWeight: '900' },
  subtitle: { color: liquidColors.white72 },
  content: { flex: 1, width: '100%', minHeight: 0, gap: careSpacing.md },
});
