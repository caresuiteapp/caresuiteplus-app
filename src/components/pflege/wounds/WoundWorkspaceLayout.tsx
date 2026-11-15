import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ScreenShell } from '@/components/layout';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import { useWoundEntryStyles } from './woundEntryStyles';

export function WoundPage({ children, form, ...props }: ComponentProps<typeof ScreenShell> & { form?: boolean }) {
  const styles = useWoundEntryStyles();
  return <ScreenShell {...props} compactHeader>
    <View style={[styles.content, form && styles.formWidth]}>{children}</View>
  </ScreenShell>;
}

export function WoundSection({ title, subtitle, actions, style, children }: {
  title: string; subtitle?: string; actions?: ReactNode; style?: StyleProp<ViewStyle>; children: ReactNode;
}) {
  const styles = useWoundEntryStyles();
  return <View style={[styles.panel, style]}>
    <View style={styles.toolbar}>
      <View style={styles.sectionHeading}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
      </View>
      {actions}
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>;
}

export function WoundFacts({ values }: { values: readonly (readonly [label: string, value: string])[] }) {
  const styles = useWoundEntryStyles();
  return <View style={styles.columns}>
    {values.map(([label, value]) => <View key={label} style={[styles.fact, value.length > 110 && styles.narrativeFact]}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>)}
  </View>;
}

type TabIcon = ComponentProps<typeof Feather>['name'];
export type WoundTab<T extends string> = { key: T; label: string; icon: TabIcon };

export function WoundTabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: readonly WoundTab<T>[]; value: T; onChange?: (tab: T) => void; label: string;
}) {
  const { c } = useCareLightPalette();
  const styles = useMemo(() => StyleSheet.create({
    tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4, minWidth: 0, maxWidth: '100%',
      backgroundColor: c.surfaceAlt, borderColor: c.border, borderWidth: 1, borderRadius: 14 },
    tab: { flexDirection: 'row', alignItems: 'center', minHeight: 40, gap: 6,
      borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 0, maxWidth: '100%' },
    chosen: { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 },
    pressed: { backgroundColor: c.surface },
    label: { ...typography.caption, color: c.muted, flexShrink: 1, fontWeight: '600' },
    chosenLabel: { color: c.text, fontWeight: '700' },
  }), [c]);
  return <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.tabs}>
    {tabs.map(tab => {
      const selected = value === tab.key;
      return <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected, disabled: !onChange }}
        disabled={!onChange} onPress={() => onChange?.(tab.key)}
        style={({ pressed }) => [styles.tab, selected && styles.chosen, pressed && styles.pressed]}>
        <Feather name={tab.icon} size={15} color={selected ? c.text : c.muted} accessible={false} />
        <Text style={[styles.label, selected && styles.chosenLabel]}>{tab.label}</Text>
      </Pressable>;
    })}
  </View>;
}
