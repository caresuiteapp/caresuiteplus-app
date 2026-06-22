import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/constants';
import {
  buildEmployeeDetailKpis,
  buildEmployeeDetailSubtitle,
} from '@/lib/office/employeeDetailStats';
import { isEmployeeDetailLiveReady } from '@/lib/office/employeeModuleConfig';

import type { RoleKey } from '@/types';
import type { EmployeeDetail } from '@/types/modules/employeeDetail';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type EmployeeDetailHeroProps = {
  employee: EmployeeDetail;
  roleKey: RoleKey;
  isReadOnly: boolean;
};

function statusVariant(status: string) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function EmployeeDetailHero({ employee, roleKey, isReadOnly }: EmployeeDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,159,67,0.35)',
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiItem: {
    flex: 1,
    minWidth: 100,
  },
}),
    [colors, typography, gradients],
  );


  const kpis = buildEmployeeDetailKpis(employee, mode);
  const fullName = `${employee.firstName} ${employee.lastName}`;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>OFFICE · MITARBEITENDE:R</Text>
          <Text style={styles.title}>{fullName}</Text>
          <Text style={styles.meta}>
            {employee.email}
            {employee.phone ? ` · ${employee.phone}` : ''}
          </Text>
          <Text style={styles.subtitle}>{buildEmployeeDetailSubtitle(employee)}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>👤</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[employee.status]}
          variant={statusVariant(employee.status)}
          dot
        />
        {employee.jobTitle ? <PremiumBadge label={employee.jobTitle} variant="cyan" /> : null}
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isReadOnly ? <PremiumBadge label="Lesemodus" variant="muted" /> : null}
        {!isEmployeeDetailLiveReady() ? (
          <PremiumBadge label="Teilweise live" variant="orange" dot />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            subValue={kpi.subValue}
            icon={kpi.icon}
            accentColor={kpi.accentColor}
            style={styles.kpiItem}
          />
        ))}
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

