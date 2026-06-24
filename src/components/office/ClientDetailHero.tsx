import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  buildClientDetailKpis,
  buildClientDetailSubtitle,
  type ClientDetailHeroInput,
} from '@/lib/office/clientDetailStats';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { SENSITIVITY_LABELS } from '@/types/portal/visibility';
import { designTokens, spacing } from '@/theme';

type ClientDetailHeroProps = {
  client: ClientDetailHeroInput;
  roleKey: RoleKey;
  isReadOnly: boolean;
  canViewSensitive: boolean;
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

export function ClientDetailHero({
  client,
  roleKey,
  isReadOnly,
  canViewSensitive,
}: ClientDetailHeroProps) {
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
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  meta: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
  },
  subtitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
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


  const kpis = buildClientDetailKpis(client, mode);
  const fullName = `${client.firstName} ${client.lastName}`;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{fullName}</Text>
          <Text style={styles.meta}>
            {client.careLevel ? `Pflegegrad ${formatCareLevel(client.careLevel)}` : 'Kein Pflegegrad'}
            {client.city ? ` · ${client.city}` : ''}
          </Text>
          <Text style={styles.subtitle}>{buildClientDetailSubtitle(client)}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>👤</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[client.status]}
          variant={statusVariant(client.status)}
          dot
        />
        {canViewSensitive ? (
          <PremiumBadge label={SENSITIVITY_LABELS[client.sensitivity]} variant="cyan" />
        ) : null}
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isReadOnly ? <PremiumBadge label="Lesemodus" variant="muted" /> : null}
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

