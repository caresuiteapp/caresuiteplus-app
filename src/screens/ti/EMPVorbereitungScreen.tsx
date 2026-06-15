import { StyleSheet, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { TISecurityNotice } from '@/components/ti';
import { TIVorbereitungHero } from '@/components/ti/TIVorbereitungHero';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing } from '@/theme';

export function EMPVorbereitungScreen() {
  const { can, check, roleLabel } = usePermissions();
  if (!can('ti.emp.view')) {
    return (
      <CareLightPageShell title="eMP-Vorbereitung">
        <LockedActionBanner message={check('ti.emp.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }
  return (
    <CareLightPageShell title="eMP-Vorbereitung" subtitle="Elektronischer Medikationsplan">
      <TIVorbereitungHero
        moduleLabel="eMP"
        title="Vorbereitung eMP"
        subtitle="Elektronischer Medikationsplan"
        description="eMP-Integration folgt in Phase 2. Medikationspläne werden mandantenisoliert in emp_medication_plans gespeichert."
        icon="💊"
        accentColor={colors.orange}
      />
      <View style={styles.noticeWrap}>
        <TISecurityNotice />
      </View>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  noticeWrap: { marginTop: spacing.md },
});
