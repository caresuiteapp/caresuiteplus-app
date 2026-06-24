import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import { GlassSurface } from '@/components/ui/effects';
import { EmployeeListAvatar } from './EmployeeListAvatar';
import {
  useCareLightPalette,
  type CareLightResolved,
} from '@/design/tokens/carelightadaptive';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import { spacing } from '@/theme';

type EmployeeCompactRowProps = {
  employee: EmployeeListItem;
  selected?: boolean;
  onPress?: () => void;
};

function statusVariant(status: EmployeeListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

function makeStyles(c: CareLightResolved) {
  return StyleSheet.create({
    rowHost: {
      marginBottom: spacing.xs,
    },
    rowInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: careSpacing.sm,
      paddingVertical: careSpacing.sm,
      paddingHorizontal: careSpacing.md,
      minHeight: 56,
    },
    rowSelected: {
      borderLeftWidth: 3,
      borderLeftColor: c.orange,
      backgroundColor: c.isDark ? 'rgba(255,149,0,0.12)' : 'rgba(255,122,26,0.10)',
    },
    rowLight: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    main: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    name: {
      ...careTypography.bodyStrong,
      color: c.text,
    },
    meta: {
      ...careTypography.caption,
      color: c.muted,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: careSpacing.xs,
      flexShrink: 0,
      alignItems: 'center',
    },
    pressed: {
      opacity: 0.88,
    },
  });
}

export function EmployeeCompactRow({ employee, selected = false, onPress }: EmployeeCompactRowProps) {
  const { isDark, c } = useCareLightPalette();
  const styles = useMemo(() => makeStyles(c), [c]);
  const fullName = `${employee.firstName} ${employee.lastName}`;

  const rowContent = (
    <View style={styles.rowInner}>
      <EmployeeListAvatar
        firstName={employee.firstName}
        lastName={employee.lastName}
        avatarUrl={employee.avatarUrl}
        size="sm"
      />
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {fullName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[resolveEmployeeRoleLabel(employee.jobTitle), employee.email].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[employee.status]}
          variant={statusVariant(employee.status)}
          dot
        />
      </View>
    </View>
  );

  const wrapped = isDark ? (
    <GlassSurface
      radius={careRadius.md}
      glowOpacity={selected ? 0.14 : 0.06}
      style={{ ...(styles.rowHost as import('react-native').ViewStyle), ...(selected ? (styles.rowSelected as import('react-native').ViewStyle) : {}) }}
    >
      {rowContent}
    </GlassSurface>
  ) : (
    <View style={[styles.rowHost, selected ? styles.rowSelected : styles.rowLight]}>
      {rowContent}
    </View>
  );

  if (!onPress) return wrapped;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {({ pressed }) => <View style={pressed ? styles.pressed : undefined}>{wrapped}</View>}
    </Pressable>
  );
}
