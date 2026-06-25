import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { withAlpha } from '@/design/tokens/motion';
import { careSpacing } from '@/design/tokens/spacing';
import { AuroraGradientButton } from './AuroraGradientButton';
import { AuroraSecondaryButton } from './AuroraSecondaryButton';
import { AuroraBadge } from './AuroraBadge';
import { auroraHeroWrapperStyle, auroraSharedStyles, AURORA_HERO_COLORS } from './auroraShared';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';

export type AuroraPageHeaderProps = {
  moduleLabel?: string;
  title: string;
  subtitle?: string;
  description?: string;
  roleBadge?: string;
  avatarInitials?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  badges?: { label: string; variant?: 'default' | 'cyan' | 'pink' | 'muted' | 'green' | 'red' }[];
  children?: ReactNode;
  style?: ViewStyle;
};

export function AuroraPageHeader({
  moduleLabel,
  title,
  subtitle,
  description,
  roleBadge,
  avatarInitials,
  primaryActionLabel,
  onPrimaryAction,
  badges = [],
  children,
  style,
}: AuroraPageHeaderProps) {
  const { typography } = useLegacyTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        topRow: { flexDirection: 'row', gap: careSpacing.md },
        textCol: { flex: 1, gap: 2 },
        eyebrow: {
          ...typography.caption,
          color: withAlpha('#FFFFFF', 0.85),
          letterSpacing: 1.4,
          fontWeight: '700',
        },
        title: { ...typography.h2, color: '#FFFFFF', fontWeight: '800' },
        subtitle: { ...typography.bodyStrong, color: withAlpha('#FFFFFF', 0.92) },
        description: { ...typography.caption, color: withAlpha('#FFFFFF', 0.75) },
        avatar: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: withAlpha('#FFFFFF', 0.16),
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: withAlpha('#FFFFFF', 0.4),
        },
        avatarText: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
        badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
      }),
    [typography],
  );

  return (
    <View style={[auroraHeroWrapperStyle(), style]}>
      <LinearGradient
        colors={[...AURORA_HERO_COLORS]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={auroraSharedStyles.heroGradient}
      />
      <View style={auroraSharedStyles.heroOrbA} pointerEvents="none" />
      <View style={auroraSharedStyles.heroOrbB} pointerEvents="none" />
      <LinearGradient
        colors={[withAlpha('#FFFFFF', 0.22), 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={auroraSharedStyles.heroSheen}
        pointerEvents="none"
      />
      <View style={auroraSharedStyles.heroContent}>
        <View style={styles.topRow}>
          <View style={styles.textCol}>
            {/* eyebrow / moduleLabel removed per user request */}
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
          {avatarInitials ? (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarInitials.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.badgeRow}>
          {roleBadge ? <AuroraBadge label={roleBadge} variant="pink" dot /> : null}
          {badges.map((b) => (
            <AuroraBadge key={b.label} label={b.label} variant={b.variant ?? 'default'} />
          ))}
        </View>
        {primaryActionLabel && onPrimaryAction ? (
          <AuroraGradientButton label={primaryActionLabel} onPress={onPrimaryAction} fullWidth />
        ) : null}
        {children}
      </View>
    </View>
  );
}

/** Dashboard module start pages. */
export const AuroraHeroHeader = AuroraPageHeader;

/** Module context header with optional KPI slot. */
export function AuroraModuleHeader(props: AuroraPageHeaderProps & { kpiSlot?: ReactNode }) {
  return (
    <AuroraPageHeader {...props}>
      {props.kpiSlot}
      {props.children}
    </AuroraPageHeader>
  );
}

/** Record/detail header — Aktenkopf. */
export type AuroraDetailHeaderProps = {
  recordLabel: string;
  title: string;
  badges?: { label: string; variant?: 'default' | 'cyan' | 'pink' | 'muted' | 'green' | 'red' }[];
  avatarIcon?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  style?: ViewStyle;
};

export function AuroraDetailHeader({
  recordLabel,
  title,
  badges = [],
  avatarIcon = '👤',
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  style,
}: AuroraDetailHeaderProps) {
  return (
    <AuroraPageHeader
      moduleLabel={recordLabel}
      title={title}
      badges={badges}
      avatarInitials={avatarIcon}
      style={style}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm }}>
        {primaryActionLabel && onPrimaryAction ? (
          <AuroraGradientButton label={primaryActionLabel} onPress={onPrimaryAction} />
        ) : null}
        {secondaryActionLabel && onSecondaryAction ? (
          <AuroraSecondaryButton label={secondaryActionLabel} onPress={onSecondaryAction} />
        ) : null}
      </View>
    </AuroraPageHeader>
  );
}

export function AuroraModalHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 4, marginBottom: careSpacing.sm }}>
      <Text style={{ color: careSuiteAuroraTheme.text.primary, fontSize: 20, fontWeight: '800' }}>{title}</Text>
      {subtitle ? <Text style={{ color: careSuiteAuroraTheme.text.secondary, fontSize: 14 }}>{subtitle}</Text> : null}
    </View>
  );
}

export const AuroraBottomSheetHeader = AuroraModalHeader;
