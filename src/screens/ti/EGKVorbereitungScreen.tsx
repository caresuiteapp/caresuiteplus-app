import { StyleSheet, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { TISecurityNotice } from '@/components/ti';
import { TIVorbereitungHero } from '@/components/ti/TIVorbereitungHero';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing } from '@/theme';

export function EGKVorbereitungScreen() {
  const { can, check, roleLabel } = usePermissions();
  if (!can('ti.egk.view')) {
    return (
      <CareLightPageShell title="eGK-Vorbereitung">
        <LockedActionBanner message={check('ti.egk.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }
  return (
    <CareLightPageShell title="eGK-Vorbereitung" subtitle="Elektronische Gesundheitskarte">
      <TIVorbereitungHero
        moduleLabel="eGK"
        title="Vorbereitung eGK-Auslesen"
        subtitle="Elektronische Gesundheitskarte"
        description="Kartenleser ist im Demo konfiguriert. Produktiv-Integration über TI-Connector und Edge Function ti-provider-proxy."
        icon="💳"
        accentColor={colors.cyan}
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
