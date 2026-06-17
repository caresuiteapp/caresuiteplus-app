import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import { CareLightButton } from '@/components/ui/CareLightButton';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import type { WorkflowStatus } from '@/types/core/base';

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

function statusVariant(status: WorkflowStatus) {
  switch (status) {
    case 'aktiv':
    case 'abgeschlossen':
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

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Klient:innenakte</Text>
          <Text style={styles.title}>{fullName}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
      </View>

      <View style={styles.badges}>
        {careLevel ? (
          <PremiumBadge label={formatCareLevel(careLevel)} variant="orange" dot />
        ) : null}
        {city ? <PremiumBadge label={city} variant="muted" /> : null}
        <PremiumBadge label={WORKFLOW_STATUS_LABELS[status]} variant={statusVariant(status)} dot />
        {careContexts.map((ctx) => (
          <PremiumBadge key={ctx} label={getCatalogLabel('leistungsart', ctx)} variant="cyan" />
        ))}
      </View>

      {showEdit && onEdit ? (
        <View style={styles.actions}>
          <CareLightButton
            title="Stammdaten bearbeiten"
            variant="secondary"
            accentColor={careLightColors.orange}
            onPress={onEdit}
            style={styles.editButton}
          />
        </View>
      ) : null}

      {archiveError ? <Text style={styles.error}>{archiveError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: careLightColors.surface,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: careLightColors.border,
    padding: careSpacing.md,
    gap: careSpacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: careSpacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...careTypography.caption,
    color: careLightColors.orange,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    ...careTypography.h2,
    color: careLightColors.navy,
    fontSize: 24,
    fontWeight: '800',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,122,26,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,122,26,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    marginTop: careSpacing.xs,
  },
  editButton: {
    borderColor: careLightColors.orange,
    minWidth: 140,
  },
  error: {
    ...careTypography.caption,
    color: careLightColors.danger,
  },
});
