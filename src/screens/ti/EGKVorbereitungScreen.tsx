import { StyleSheet, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { TISecurityNotice } from '@/components/ti';
import { TIVorbereitungHero } from '@/components/ti/TIVorbereitungHero';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing } from '@/theme';

export function EGKVorbereitungScreen() {
  const { can, check, roleLabel } = usePermissions();
  if (!can('ti.egk.view')) {
    return (
      <ScreenShell title="eGK-Vorbereitung">
        <LockedActionBanner message={check('ti.egk.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }
  return (
    <ScreenShell title="eGK-Vorbereitung" subtitle="Elektronische Gesundheitskarte">
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  noticeWrap: { marginTop: spacing.md },
});
