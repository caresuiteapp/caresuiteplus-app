import { StyleSheet, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { TISecurityNotice } from '@/components/ti';
import { TIVorbereitungHero } from '@/components/ti/TIVorbereitungHero';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing } from '@/theme';

export function EPAVorbereitungScreen() {
  const { can, check, roleLabel } = usePermissions();
  if (!can('ti.epa.view')) {
    return (
      <CareLightPageShell title="ePA-Vorbereitung">
        <LockedActionBanner message={check('ti.epa.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }
  return (
    <CareLightPageShell title="ePA-Vorbereitung" subtitle="Elektronische Patientenakte">
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
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  noticeWrap: { marginTop: spacing.md },
});
