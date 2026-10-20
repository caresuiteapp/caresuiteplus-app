import { ScreenShell } from '@/components/layout';
import { PremiumCard, SectionPanel } from '@/components/ui';
import { Text } from 'react-native';

/** WP454 */
export function CatalogTemplateScreen() {
  return (
    <ScreenShell title="Vorlagen" subtitle="WP 454">
      <SectionPanel title="Leistungsvorlagen">
        <PremiumCard><Text>Abrechnungs- und Leistungsvorlagen für Kataloge.</Text></PremiumCard>
      </SectionPanel>
    </ScreenShell>
  );
}
