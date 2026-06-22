import { StyleSheet, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { TISecurityNotice } from '@/components/ti';
import { TIVorbereitungHero } from '@/components/ti/TIVorbereitungHero';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing } from '@/theme';

export function EPAVorbereitungScreen() {
  const { can, check, roleLabel } = usePermissions();
  if (!can('ti.epa.view')) {
    return (
      <ScreenShell title="ePA-Vorbereitung">
        <LockedActionBanner message={check('ti.epa.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }
  return (
    <ScreenShell title="ePA-Vorbereitung" subtitle="Elektronische Patientenakte">
      <TIVorbereitungHero
        moduleLabel="ePA"
        title="Vorbereitung ePA-Zugang"
        subtitle="Elektronische Patientenakte"
        description="Einwilligung für ePA ist im Demo ausstehend. Vor Produktivbetrieb: Consent erteilen und ePA-Gateway konfigurieren."
        icon="📁"
        accentColor={colors.violet}
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
