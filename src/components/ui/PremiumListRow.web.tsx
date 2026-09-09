import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSurfaceContrastTone } from '@/design/tokens/surfaceContrast';
import { usePortalPremiumTheme } from '@/design/tokens/portalPremium.web';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';

type Props = { title: string; subtitle?: string; leading?: React.ReactNode; trailing?: React.ReactNode;
  showChevron?: boolean; showDivider?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle>; multiline?: boolean };
export function PremiumListRow({ title, subtitle, leading, trailing, showChevron = false,
  showDivider = false, onPress, style, multiline = false }: Props) {
  const tone = useSurfaceContrastTone();
  const portal = usePortalPremiumTheme();
  const dark = tone === 'dark' || (tone === 'adaptive' && !portal.active);
  const content = <>
    {leading ? <View style={styles.leading}>{leading}</View> : null}
    <View style={styles.copy}>
      <Text style={[styles.title, { color: dark ? '#F3F8FF' : '#102B49' }]}>{title}</Text>
      {subtitle ? <Text numberOfLines={multiline ? undefined : 3} style={[styles.subtitle, { color: dark ? '#BED6E8' : '#526B82' }]}>{subtitle}</Text> : null}
    </View>
    {showChevron ? <Text style={[styles.chevron, { color: dark ? '#81DCFF' : '#075EB8' }]}>›</Text> : null}
  </>;
  return <View style={[styles.root, showDivider && { borderBottomWidth: 1, borderBottomColor: dark ? '#31526E' : '#D6E3EF' }, style]}
    dataSet={{ csWorkspaceComponent: 'list-row', csWorkspaceTone: dark ? 'dark' : 'light' }}>
    {onPress ? <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
      style={({ pressed }) => [styles.main, pressed && { opacity: 0.8 }]}>{content}</Pressable> : <View style={styles.main}>{content}</View>}
    {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
  </View>;
}
const styles = StyleSheet.create({
  root: { width: '100%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 8, paddingVertical: 10 },
  main: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8 },
  leading: { flexShrink: 0, maxWidth: '35%' }, copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: font(16), lineHeight: font(24), fontWeight: '700' },
  subtitle: { fontSize: font(14), lineHeight: font(22) },
  chevron: { fontSize: font(24), fontWeight: '500', paddingHorizontal: 4 },
  trailing: { minWidth: 0, maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
