import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import type { CsvClientExportFilters, CsvEmployeeExportFilters } from '@/types/csv';
import { CsvSecurityNotice } from './CsvSecurityNotice';
import { typography } from '@/theme';

type ClientProps = {
  kind: 'clients';
  onExport: (filters: CsvClientExportFilters) => Promise<void>;
  loading?: boolean;
};

type EmployeeProps = {
  kind: 'employees';
  onExport: (filters: CsvEmployeeExportFilters) => Promise<void>;
  loading?: boolean;
};

export function CsvExportPanel(props: ClientProps | EmployeeProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      if (props.kind === 'clients') {
        await props.onExport({
          statusFilter: statusFilter as CsvClientExportFilters['statusFilter'],
          city: city || null,
          scopes: ['basis', 'kontakt'],
        });
      } else {
        await props.onExport({
          statusFilter: statusFilter as CsvEmployeeExportFilters['statusFilter'],
          city: city || null,
          scopes: ['basis', 'kontakt', 'beschaeftigung'],
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const statusOptions =
    props.kind === 'clients'
      ? [
          ['all', 'Alle Klient:innen'],
          ['active', 'Nur aktive'],
          ['inactive', 'Nur inaktive'],
          ['archived', 'Nur archivierte'],
        ]
      : [
          ['all', 'Alle Mitarbeiter:innen'],
          ['active', 'Nur aktive'],
          ['inactive', 'Nur inaktive'],
          ['terminated', 'Nur ausgeschiedene'],
        ];

  return (
    <View style={styles.wrap}>
      <CsvSecurityNotice variant="export" />
      <SectionPanel title="Exportfilter" subtitle="Datenumfang vor dem Export eingrenzen">
        <Text style={styles.label}>Status</Text>
        <View style={styles.chips}>
          {statusOptions.map(([value, label]) => (
            <PremiumButton
              key={value}
              title={label}
              variant={statusFilter === value ? 'primary' : 'secondary'}
              onPress={() => setStatusFilter(value)}
            />
          ))}
        </View>
        <PremiumInput label="Ort" value={city} onChangeText={setCity} placeholder="z. B. Dortmund" />
      </SectionPanel>
      <PremiumButton
        title={props.kind === 'clients' ? 'Klient:innen exportieren' : 'Mitarbeiter:innen exportieren'}
        onPress={handleExport}
        disabled={loading || props.loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: careSpacing.md },
  label: { ...typography.caption, marginBottom: careSpacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs, marginBottom: careSpacing.md },
});
