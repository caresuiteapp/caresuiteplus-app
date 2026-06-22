import { ScrollView, StyleSheet, Text } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { PlaceholderRegistryPanel } from '@/components/documents';
import { ScreenShell } from '@/components/layout';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { PLACEHOLDER_GROUP_LABELS, SYSTEM_PLACEHOLDER_SEEDS } from '@/features/documents/templateEngine';
import { colors, spacing, typography } from '@/theme';

export function PlaceholderManagementScreen() {
  const { can, check, roleLabel } = usePermissions();

  if (!can('office.catalogs.view')) {
    return (
      <ScreenShell title="Platzhalter" subtitle={roleLabel ?? 'Vorlagen'}>
        <LockedActionBanner
          message={check('office.catalogs.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  const groupCount = Object.keys(PLACEHOLDER_GROUP_LABELS).length;

  return (
    <ScreenShell
      title="Platzhalterverwaltung"
      subtitle="Zentrale Registry für Vorlagen & Dokumente"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <InfoBanner
          variant="info"
          message="Systemplatzhalter sind mandantenübergreifend definiert. Mandantenplatzhalter ergänzen die Registry pro Mandant (template_placeholders)."
        />

        <PremiumCard style={styles.stats}>
          <Text style={styles.statLine}>{SYSTEM_PLACEHOLDER_SEEDS.length} Systemplatzhalter</Text>
          <Text style={styles.statLine}>{groupCount} Gruppen</Text>
        </PremiumCard>

        <PlaceholderRegistryPanel />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  stats: { gap: spacing.xs },
  statLine: { ...typography.body, color: colors.textMuted },
});
