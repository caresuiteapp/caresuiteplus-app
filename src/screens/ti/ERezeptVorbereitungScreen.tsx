import { StyleSheet, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { TISecurityNotice } from '@/components/ti';
import { TIVorbereitungHero } from '@/components/ti/TIVorbereitungHero';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing } from '@/theme';

export function ERezeptVorbereitungScreen() {
  const { can, check, roleLabel } = usePermissions();
  if (!can('ti.erezept.view')) {
    return (
      <ScreenShell title="E-Rezept-Vorbereitung">
        <LockedActionBanner message={check('ti.erezept.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }
  return (
    <ScreenShell title="E-Rezept-Vorbereitung" subtitle="Elektronisches Rezept">
      <TIVorbereitungHero
        moduleLabel="E-Rezept"
        title="Vorbereitung E-Rezept"
        subtitle="Elektronisches Rezept"
        description="E-Rezept-Workflow ist teilweise verfügbar. Vollständige TI-Anbindung über gematik-konformen Connector geplant."
        icon="📝"
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
