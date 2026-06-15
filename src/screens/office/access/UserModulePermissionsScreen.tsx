import { StyleSheet, Text } from 'react-native';
import { AccessListHero } from '@/components/access';
import { ScreenShell } from '@/components/layout';
import { InfoBanner, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import {
  isModuleAssignmentLiveReady,
  MODULE_ASSIGNMENT_PREPARED_MESSAGE,
} from '@/lib/modules/modulesModuleConfig';
import { colors, typography } from '@/theme';

const MODULES = [
  'office',
  'assist',
  'pflege',
  'stationaer',
  'beratung',
  'akademie',
  'messages',
  'documents',
  'qm',
  'reporting',
  'ti',
  'settings',
] as const;

const ACTIONS = [
  'sehen',
  'anlegen',
  'bearbeiten',
  'archivieren',
  'exportieren',
  'Einstellungen verwalten',
] as const;

export function UserModulePermissionsScreen() {
  return (
    <ScreenShell title="Modulrechte" subtitle="Zugänge & Benutzer" scroll>
      <AccessListHero variant="module-permissions" itemCount={MODULES.length} />
      {!isModuleAssignmentLiveReady() ? (
        <InfoBanner
          title="Zuordnung demo-funktional"
          message={MODULE_ASSIGNMENT_PREPARED_MESSAGE}
        />
      ) : null}

      <SectionPanel title="Module" subtitle="Vorschau — echte Benutzer-Zuordnung folgt mit Live-Billing">
        {MODULES.map((moduleKey) => (
          <PremiumCard key={moduleKey} accentColor={colors.cyan}>
            <Text style={styles.module}>{moduleKey}</Text>
            <Text style={styles.meta}>{ACTIONS.join(' · ')}</Text>
            <PremiumBadge label="Demo-Vorschau" variant="muted" />
          </PremiumCard>
        ))}
      </SectionPanel>
      <Text style={styles.note}>
        Modulrechte werden pro internem Benutzer in CareSuite+ Office gesetzt und ergänzen die
        Rollenbasis aus dem Bereich Rollen & Rechte.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  module: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textSecondary, marginBottom: 8 },
  note: { ...typography.caption, color: colors.textSecondary, marginTop: 8 },
});
