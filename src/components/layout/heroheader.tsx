import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CareSuiteLogo, CareSuiteWordmark } from '@/components/brand';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type HeroHeaderProps = {
  title: string;
  subtitle?: string;
};

/** Public start-page hero — logo, claim, safe typography. */
export function HeroHeader({ title, subtitle }: HeroHeaderProps) {
  const { isPhone, isDesktopOrWide, width } = useDeviceClass();
  const type = useMemo(() => resolveGalaxyTypography(width), [width]);

  return (
    <View style={styles.hero}>
      {isPhone ? (
        <View style={styles.logoTop}>
          <CareSuiteLogo size="xl" />
        </View>
      ) : (
        <CareSuiteWordmark size={isDesktopOrWide ? 'lg' : 'md'} />
      )}
      <Text style={[type.h2, styles.claim]} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[type.body, styles.claimSub]} numberOfLines={3}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

type AuthHeroHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon?: string;
  footer?: ReactNode;
};

/** Simplified auth hero without KPI/debug panels. */
export function AuthHeroHeader({ eyebrow, title, subtitle, icon = '🔐', footer }: AuthHeroHeaderProps) {
  const { width } = useDeviceClass();
  const type = useMemo(() => resolveGalaxyTypography(width), [width]);

  return (
    <View style={styles.authHero}>
      <View style={styles.authTop}>
        <View style={styles.authText}>
          <Text style={type.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text style={type.h2} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[type.body, styles.authSub]} numberOfLines={4}>
            {subtitle}
          </Text>
        </View>
        <Text style={styles.authIcon}>{icon}</Text>
      </View>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: careSpacing.md, marginBottom: careSpacing.sm },
  logoTop: { alignItems: 'center', marginBottom: careSpacing.xs },
  claim: { flexShrink: 1, minWidth: 0 },
  claimSub: { flexShrink: 1, minWidth: 0 },
  authHero: {
    gap: careSpacing.md,
    padding: careSpacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  authTop: { flexDirection: 'row', gap: careSpacing.md, alignItems: 'flex-start', minWidth: 0 },
  authText: { flex: 1, gap: 4, minWidth: 0 },
  authSub: { flexShrink: 1, minWidth: 0 },
  authIcon: { fontSize: 28, flexShrink: 0 },
});
