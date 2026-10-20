import { StyleSheet, View } from 'react-native';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { EmployeeMobilitySettingsForm } from '@/components/portal/EmployeeMobilitySettingsForm';
import { SectionPanel } from '@/components/ui';
import { spacing } from '@/theme';

type EmployeeMobilityOfficePanelProps = {
  employeeId: string;
};

/** Office Personalakte — view/edit employee mobility (v1). */
export function EmployeeMobilityOfficePanel({ employeeId }: EmployeeMobilityOfficePanelProps) {
  const tenantId = useServiceTenantId();
  if (!tenantId) return null;

  return (
    <SectionPanel title="Mobilität">
      <View style={styles.wrap}>
        <EmployeeMobilitySettingsForm tenantId={tenantId} employeeId={employeeId} showSuccessBanner />
      </View>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
});
