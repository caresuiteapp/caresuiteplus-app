import { AuroraDetailHeader } from '@/components/aurora';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import type { WorkflowStatus } from '@/types/core/base';
import { StyleSheet, Text, View } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { careTypography } from '@/design/tokens/typography';

type ClientRecordHeroProps = {
  firstName: string;
  lastName: string;
  careLevel: string | null;
  city: string | null;
  status: WorkflowStatus;
  careContexts: ClientCareContext[];
  archiveError?: string | null;
  showEdit?: boolean;
  onEdit?: () => void;
};

function statusVariant(status: WorkflowStatus): 'green' | 'red' | 'pink' | 'muted' {
  switch (status) {
    case 'aktiv':
    case 'abgeschlossen':
      return 'green';
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red';
    case 'in_bearbeitung':
    case 'entwurf':
      return 'pink';
    default:
      return 'muted';
  }
}

export function ClientRecordHero({
  firstName,
  lastName,
  careLevel,
  city,
  status,
  careContexts,
  archiveError,
  showEdit = false,
  onEdit,
}: ClientRecordHeroProps) {
  const fullName = `${firstName} ${lastName}`.trim();
  const badges = [
    ...(careLevel ? [{ label: formatCareLevel(careLevel), variant: 'pink' as const }] : []),
    ...(city ? [{ label: city, variant: 'muted' as const }] : []),
    { label: WORKFLOW_STATUS_LABELS[status], variant: statusVariant(status) },
    ...careContexts.map((ctx) => ({
      label: getCatalogLabel('leistungsart', ctx),
      variant: 'cyan' as const,
    })),
  ];

  return (
    <View style={styles.wrap}>
      <AuroraDetailHeader
        recordLabel="Klient:innenakte"
        title={fullName}
        badges={badges}
        avatarIcon="👤"
        primaryActionLabel={showEdit && onEdit ? 'Stammdaten bearbeiten' : undefined}
        onPrimaryAction={onEdit}
      />
      {archiveError ? <Text style={styles.error}>{archiveError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: careSpacing.sm },
  error: {
    ...careTypography.caption,
    color: careSuiteAuroraTheme.text.primary,
    paddingHorizontal: careSpacing.sm,
  },
});
