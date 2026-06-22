import { StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  EMPLOYEE_HR_AREA_LABELS,
  EMPLOYEE_HR_STATUS_LABELS,
  HR_LEGAL_DISCLAIMER,
} from '@/types/modules/employeeHr';
import type { EmployeeHrCase } from '@/types/modules/employeeHr';
import { createHrCase, listHrCases } from '@/lib/office/employeeHrService';
import { colors, spacing, typography } from '@/theme';

export function EmployeeHrCasesScreen() {
  const { can, check, roleLabel } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const canView = can('office.employees.hr.view');
  const canManage = can('office.employees.hr.manage');
  const officeAccent = moduleColor('office');
  const [items, setItems] = useState<EmployeeHrCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!tenantId) {
      setError('Kein Mandant.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = listHrCases(tenantId, undefined, profile?.roleKey);
    if (result.ok) setItems(result.data);
    else setError(result.error);
    setLoading(false);
  }, [tenantId, profile?.roleKey]);

  useEffect(() => {
    if (canView) refresh();
    else setLoading(false);
  }, [canView, refresh]);

  if (!canView) {
    return (
      <ScreenShell title="Personalvorgänge" subtitle="Mehr → Personal" scroll={false}>
        <LockedActionBanner
          message={check('office.employees.hr.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && items.length === 0) {
    return (
      <ScreenShell title="Personalvorgänge" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Personalvorgänge werden geladen…" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Personalvorgänge"
      subtitle="Mehr → Personal · Mitarbeitergespräche, Abmahnungen, Kündigungen, Zeugnisse"
      rightSlot={
        canManage ? (
          <PremiumButton
            title="+ Vorgang"
            onPress={() => {
              if (!tenantId) return;
              const result = createHrCase(
                {
                  tenantId,
                  employeeId: 'employee-003',
                  areaKey: 'mitarbeitergespraech',
                  conversation: {
                    scheduledAt: new Date().toISOString(),
                    participants: [{ name: 'HR', role: 'Personal' }],
                    topics: 'Neues Gespräch',
                    summary: 'Entwurf',
                  },
                },
                profile?.roleKey,
              );
              if (result.ok) refresh();
            }}
          />
        ) : null
      }
      scroll
    >
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>{HR_LEGAL_DISCLAIMER}</Text>
      </View>

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {items.length === 0 && !error ? (
        <EmptyState
          title="Noch keine Personalvorgänge"
          message="Legen Sie Mitarbeitergespräche, Abmahnungen oder Zeugnisse als Entwurf an."
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {EMPLOYEE_HR_AREA_LABELS[item.areaKey]} · {EMPLOYEE_HR_STATUS_LABELS[item.status]}
                {item.caseNumber ? ` · ${item.caseNumber}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  disclaimer: { marginBottom: spacing.md },
  disclaimerText: { ...typography.caption, color: colors.textMuted },
  list: { gap: spacing.sm },
  row: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    gap: spacing.xs,
  },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textMuted },
});
