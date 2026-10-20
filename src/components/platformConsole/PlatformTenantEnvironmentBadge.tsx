import { StyleSheet, Text, View } from 'react-native';

import type { PlatformTenantEnvironmentMode } from '@/types/platformConsole';

const ENVIRONMENT_META: Record<PlatformTenantEnvironmentMode, { label: string; bg: string; border: string; text: string }> = {
  production: { label: 'Echt · Produktion', bg: '#DCFCE7', border: '#86EFAC', text: '#166534' },
  pilot: { label: 'Fiktiver Pilot', bg: '#FEF3C7', border: '#FCD34D', text: '#92400E' },
  demo: { label: 'Demo · Testdaten', bg: '#EDE9FE', border: '#C4B5FD', text: '#5B21B6' },
  sandbox: { label: 'Sandbox · Test', bg: '#DBEAFE', border: '#93C5FD', text: '#1E40AF' },
  internal_test: { label: 'Interner Test', bg: '#FCE7F3', border: '#F9A8D4', text: '#9D174D' },
  unclassified: { label: 'Ungeklärt', bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B' },
};

export function PlatformTenantEnvironmentBadge({ mode }: { mode: PlatformTenantEnvironmentMode | string }) {
  const normalized = mode in ENVIRONMENT_META ? mode as PlatformTenantEnvironmentMode : 'unclassified';
  const meta = ENVIRONMENT_META[normalized];
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
      <Text style={[styles.label, { color: meta.text }]}>{meta.label}</Text>
    </View>
  );
}

export function platformTenantEnvironmentLabel(mode: PlatformTenantEnvironmentMode | string): string {
  const normalized = mode in ENVIRONMENT_META ? mode as PlatformTenantEnvironmentMode : 'unclassified';
  return ENVIRONMENT_META[normalized].label;
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  label: { fontSize: 11, fontWeight: '800' },
});
