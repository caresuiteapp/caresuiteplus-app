import { StyleSheet, Text } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import type { TemplateStatus } from '@/types/templates';
import { colors, typography } from '@/theme';

const STATUS_VARIANT: Record<TemplateStatus, 'green' | 'orange' | 'muted' | 'red'> = {
  active: 'green',
  draft: 'orange',
  archived: 'muted',
  disabled: 'red',
};

const STATUS_LABEL: Record<TemplateStatus, string> = {
  active: 'Aktiv',
  draft: 'Entwurf',
  archived: 'Archiviert',
  disabled: 'Deaktiviert',
};

type Props = { status: TemplateStatus };

export function TemplateStatusBadge({ status }: Props) {
  return <PremiumBadge label={STATUS_LABEL[status]} variant={STATUS_VARIANT[status]} />;
}

export function TemplateStatusLabel({ status }: Props) {
  return <Text style={styles.label}>{STATUS_LABEL[status]}</Text>;
}

const styles = StyleSheet.create({
  label: { ...typography.caption, color: colors.textMuted },
});
