import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import type { CsvImportType } from '@/types/csv';
import { buildTemplateCsv, getTemplateFileName } from '@/lib/csv/csvTemplates';
import { triggerCsvDownload } from '@/lib/csv/csvDownload';
import { typography } from '@/theme';

type Props = {
  importType: CsvImportType;
  disabled?: boolean;
};

export function CsvTemplateDownloadCard({ importType, disabled }: Props) {
  const text = useAuroraAdaptiveText();
  const label =
    importType === 'clients' ? 'Klient:innen-Vorlage herunterladen' : 'Mitarbeiter:innen-Vorlage herunterladen';

  return (
    <SectionPanel
      title={importType === 'clients' ? 'Klient:innen-Vorlage' : 'Mitarbeiter:innen-Vorlage'}
      subtitle="UTF-8 · Semikolon-getrennt · mit Beispielzeile"
    >
      <Text style={[styles.lead, { color: text.secondary }]}>
        Nutzen Sie die Standardvorlage, um Pflichtfelder und Spaltenbezeichnungen korrekt zu übernehmen.
      </Text>
      <PremiumButton
        title={label}
        variant="secondary"
        disabled={disabled}
        onPress={() => triggerCsvDownload(buildTemplateCsv(importType), getTemplateFileName(importType))}
      />
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  lead: { ...typography.body, marginBottom: careSpacing.sm },
});
