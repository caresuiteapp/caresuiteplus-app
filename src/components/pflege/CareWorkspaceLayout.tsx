import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';

type Icon = ComponentProps<typeof Feather>['name'];
export type CareWorkspaceTab<T extends string> = { key: T; label: string; icon: Icon; count?: number };

export function CareWorkspaceTabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: readonly CareWorkspaceTab<T>[];
  value: T;
  onChange?: (value: T) => void;
  label: string;
}) {
  const styles = useWorkspaceStyles();
  const { c } = useCareLightPalette();
  return (
    <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel={label}>
      {tabs.map(tab => {
        const chosen = value === tab.key;
        return (
          <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: chosen, disabled: !onChange }}
            disabled={!onChange} onPress={() => onChange?.(tab.key)}
            style={({ pressed }) => [styles.tab, chosen && styles.tabActive, pressed && styles.tabPressed]}>
            <Feather name={tab.icon} size={16} color={chosen ? c.cyan : c.muted} accessible={false} />
            <Text style={[styles.tabText, chosen && styles.tabTextActive]}>{tab.label}</Text>
            {tab.count !== undefined ? <Text style={styles.tabCount}>{tab.count}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function CareWorkspaceHeader({ title, subtitle, icon, status, children }: {
  title: string;
  subtitle?: string;
  icon: Icon;
  status?: string;
  children?: ReactNode;
}) {
  const styles = useWorkspaceStyles();
  return (
    <LinearGradient colors={['#102941', '#123E64', '#195277']} start={{x: 0, y: 0.15}} end={{x: 1, y: 0.85}} style={styles.hero}>
      <View style={styles.heroIcon}><Feather name={icon} size={23} color="#F1F9FF" accessible={false} /></View>
      <View style={styles.heroText}>
        <Text accessibilityRole="header" style={styles.heroTitle}>{title}</Text>
        {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
        {status ? <Text style={styles.heroBadge}>{status}</Text> : null}
      </View>
      {children ? <View style={styles.heroActions}>{children}</View> : null}
    </LinearGradient>
  );
}

export function CareWorkspaceColumns({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const [wide, setWide] = useState(false);
  return (
    <View onLayout={event => setWide(event.nativeEvent.layout.width >= 960)}
      style={[columnStyles.root, wide && columnStyles.wide]}>
      <View style={[columnStyles.content, wide && columnStyles.main]}>{children}</View>
      {aside ? <View style={[columnStyles.content, wide && columnStyles.aside]}>{aside}</View> : null}
    </View>
  );
}

const columnStyles = StyleSheet.create({
  root: { minWidth: 0, gap: spacing.md },
  wide: { flexDirection: 'row', alignItems: 'flex-start' },
  content: { minWidth: 0, gap: spacing.md },
  main: { flex: 1 },
  aside: { width: 290, flexShrink: 0 },
});

function useWorkspaceStyles() {
  const { c } = useCareLightPalette();
  return useMemo(() => StyleSheet.create({
    hero: { minWidth: 0, gap: 14, borderRadius: 20, padding: 18, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
      borderWidth: 1, borderColor: '#2B6287' },
    heroIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(230,246,255,0.13)', alignItems: 'center', justifyContent: 'center' },
    heroText: { minWidth: 180, flexBasis: 220, flexGrow: 1, flexShrink: 1, gap: 5 },
    heroTitle: { ...typography.h2, color: '#FFFFFF', fontWeight: '700' },
    heroSubtitle: { ...typography.body, color: '#D9ECFC' },
    heroBadge: { ...typography.caption, alignSelf: 'flex-start', color: '#E4F6FF', backgroundColor: 'rgba(219,243,255,0.15)',
      borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4, fontWeight: '700' },
    heroActions: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
    tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 5, minWidth: 0, maxWidth: '100%', backgroundColor: c.surfaceAlt,
      borderColor: c.border, borderWidth: 1, borderRadius: 15 },
    tab: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 7, borderRadius: 11,
      paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: 'transparent', minWidth: 0, maxWidth: '100%' },
    tabActive: { backgroundColor: c.surface, borderColor: c.border },
    tabPressed: { backgroundColor: c.surface },
    tabText: { ...typography.body, color: c.muted, flexShrink: 1, fontWeight: '600' },
    tabTextActive: { color: c.text, fontWeight: '700' },
    tabCount: { ...typography.caption, color: c.text, backgroundColor: c.surfaceAlt, paddingHorizontal: 7, paddingVertical: 2,
      borderRadius: 8, fontWeight: '700' },
  }), [c]);
}
