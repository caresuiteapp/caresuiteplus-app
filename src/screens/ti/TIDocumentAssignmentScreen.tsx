import { StyleSheet, Text } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { TISecurityNotice } from '@/components/ti';
import { PremiumCard } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

export function TIDocumentAssignmentScreen() {
  const { can, check, roleLabel } = usePermissions();
  if (!can('ti.kim.view')) {
    return (
      <CareLightPageShell title="Dokumentenzuordnung">
        <LockedActionBanner message={check('ti.kim.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }
  return (
    <CareLightPageShell title="Dokumentenzuordnung" subtitle="KIM-Anhänge → Klient:innen">
      <PremiumCard accentColor={colors.cyan}>
        <Text style={styles.title}>Manuelle Dokumentenzuordnung</Text>
        <Text style={styles.meta}>
          OCR/KI schlägt Zuordnungen vor — Bestätigung erfolgt immer manuell durch autorisierte Nutzer:innen.
        </Text>
      </PremiumCard>
      <TISecurityNotice />
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong },
  meta: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
});
