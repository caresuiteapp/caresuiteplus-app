import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthHero } from '@/design/components';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { careSpacing } from '@/design/tokens/spacing';
import type { StatusKind } from '@/design/components/StatusBadge';
import { shouldShowDemoHints, sanitizeUiText } from '@/lib/ui/uiVisibility';

type AuthLoginHeroProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon?: string;
  portalLabel: string;
  portalVariant?: 'orange' | 'cyan' | 'green' | 'muted' | 'red';
  hint?: string;
};

const PORTAL_ACCENT: Record<NonNullable<AuthLoginHeroProps['portalVariant']>, string> = {
  orange: galaxyPalette.careOrange,
  cyan: galaxyPalette.galaxyCyan,
  green: galaxyPalette.success,
  muted: galaxyPalette.textMuted,
  red: galaxyPalette.danger,
};

export function AuthLoginHero({
  eyebrow,
  title,
  subtitle,
  icon = '🔐',
  portalLabel,
  portalVariant = 'orange',
  hint,
}: AuthLoginHeroProps) {
  const accent = PORTAL_ACCENT[portalVariant];
  const badges = useMemo(() => {
    const items: { kind: StatusKind; label?: string }[] = [
      { kind: 'info', label: sanitizeUiText(portalLabel) },
    ];
    if (shouldShowDemoHints()) {
      items.push({ kind: 'info', label: 'Demo-Modus' });
    }
    return items;
  }, [portalLabel]);

  return (
    <AuthHero
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      iconEmoji={icon}
      accentColor={accent}
      badges={badges.map((b) => ({
        ...b,
        kind: b.kind,
      }))}
      footer={
        hint ? (
          <View style={styles.hintWrap}>
            <Text style={styles.hint} numberOfLines={4}>
              {hint}
            </Text>
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  hintWrap: { marginTop: careSpacing.md },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: galaxyPalette.textMuted,
    flexShrink: 1,
  },
});
