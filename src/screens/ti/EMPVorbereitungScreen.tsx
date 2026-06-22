import { StyleSheet, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { TISecurityNotice } from '@/components/ti';
import { TIVorbereitungHero } from '@/components/ti/TIVorbereitungHero';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing } from '@/theme';

export function EMPVorbereitungScreen() {
  const { can, check, roleLabel } = usePermissions();
  if (!can('ti.emp.view')) {
    return (
      <ScreenShell title="eMP-Vorbereitung">
        <LockedActionBanner message={check('ti.emp.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }
  return (
    <ScreenShell title="eMP-Vorbereitung" subtitle="Elektronischer Medikationsplan">
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  noticeWrap: { marginTop: spacing.md },
});
