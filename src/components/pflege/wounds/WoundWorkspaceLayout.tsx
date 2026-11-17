import { type ComponentProps, type ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { useWoundEntryStyles } from './woundEntryStyles';
export { CareWorkspaceTabs as WoundTabs } from '@/components/pflege/CareWorkspaceLayout';
export type { CareWorkspaceTab as WoundTab } from '@/components/pflege/CareWorkspaceLayout';

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
