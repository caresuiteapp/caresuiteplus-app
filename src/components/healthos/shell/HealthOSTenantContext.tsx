import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

type Props = {
  tenantName?: string;
  tenantId?: string;
  moduleLabel?: string;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Presentational tenant / module context chip — parent supplies data, no service imports.
 */
export function HealthOSTenantContext({
  tenantName,
  tenantId,
  moduleLabel,
  trailing,
  style,
  testID = 'healthos-tenant-context',
}: Props) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: careSpacing.sm,
          paddingHorizontal: careSpacing.md,
          paddingVertical: careSpacing.xs,
          borderRadius: 8,
          backgroundColor: 'rgba(0,0,0,0.04)',
        },
        label: { ...careTypography.caption, fontWeight: '600' },
        meta: { ...careTypography.caption, opacity: 0.55 },
      }),
    [],
  );

  if (!tenantName && !moduleLabel) return null;

  return (
    <View style={[styles.root, style]} testID={testID}>
      {moduleLabel ? <Text style={styles.label}>{moduleLabel}</Text> : null}
      {tenantName ? (
        <Text style={styles.label} numberOfLines={1}>
          {tenantName}
        </Text>
      ) : null}
      {tenantId ? (
        <Text style={styles.meta} numberOfLines={1}>
          {tenantId.slice(0, 8)}
        </Text>
      ) : null}
      {trailing}
    </View>
  );
}
