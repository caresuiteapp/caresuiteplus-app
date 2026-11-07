import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { employeePortalWorkspace as c } from './employeePortalDesign';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  compact?: boolean;
  testID?: string;
};

export function EmployeePortalPageHeader({ title, subtitle, eyebrow, actions, compact, testID }: Props) {
  return (
    <View style={styles.header} testID={testID ?? 'employee-portal-workspace-heading'}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" android_hyphenationFrequency="normal" textBreakStrategy="highQuality"
          style={[styles.title, compact && styles.compactTitle]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

export function EmployeePortalFacts({ items }: {
  items: readonly { id: string; label: string; value: string | number; detail?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.facts}>
      {items.map(({ id, label, value, detail }) => (
        <View key={id} style={styles.fact}>
          <Text style={styles.factValue}>{value}</Text>
          <View style={styles.factCopy}>
            <Text style={styles.factLabel}>{label}</Text>
            {detail ? <Text style={styles.factDetail}>{detail}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  header: {
    width: '100%', minWidth: 0, paddingVertical: 8, gap: 12,
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  copy: { flexGrow: 1, flexBasis: 230, flexShrink: 1, minWidth: 0, gap: 4 },
  eyebrow: { color: c.accent, fontSize: font(11), lineHeight: font(16), fontWeight: '700', letterSpacing: 1.2 },
  title: { color: c.text, fontSize: font(31), lineHeight: font(39), fontWeight: '700', letterSpacing: -0.65 },
  compactTitle: { fontSize: font(24), lineHeight: font(31) },
  subtitle: { color: c.secondary, fontSize: font(14), lineHeight: font(21) },
  actions: { maxWidth: '100%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, minWidth: 0 },
  fact: {
    flexGrow: 1, flexShrink: 1, flexBasis: 148, maxWidth: '100%', minWidth: 0, minHeight: 52,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface,
  },
  factValue: { fontSize: font(19), lineHeight: font(25), color: c.accent, fontWeight: '700', flexShrink: 1 },
  factCopy: { flex: 1, minWidth: 0, gap: 2 },
  factLabel: { fontSize: font(13), lineHeight: font(18), color: c.text, fontWeight: '700' },
  factDetail: { fontSize: font(12), lineHeight: font(17), color: c.secondary },
}));
