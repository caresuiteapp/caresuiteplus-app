import { StyleSheet, View } from 'react-native';
import { DocumentModuleTemplatesPanel } from '@/components/documents/DocumentModuleTemplatesPanel';
import { SectionPanel } from '@/components/ui';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { spacing } from '@/theme';

export type ModuleDocumentsSectionProps = {
  targetModule: string;
  targetArea: string;
  triggerEvent?: string;
  clientId?: string | null;
  employeeId?: string | null;
  assignmentId?: string | null;
  assistOnly?: boolean;
  title?: string;
  subtitle?: string;
  collapsed?: boolean;
};

/** Wiederverwendbarer Dokumente-Block für Modul-Screens (Office, Pflege, Beratung, …). */
export function ModuleDocumentsSection(props: ModuleDocumentsSectionProps) {
  const tenantId = useServiceTenantId();

  if (props.collapsed) return null;

  return (
    <View style={styles.wrap}>
      <SectionPanel title={props.title ?? 'Dokumente & Vorlagen'} subtitle={props.subtitle}>
        <DocumentModuleTemplatesPanel
          tenantId={tenantId}
          targetModule={props.targetModule}
          targetArea={props.targetArea}
          triggerEvent={props.triggerEvent}
          clientId={props.clientId}
          employeeId={props.employeeId}
          assignmentId={props.assignmentId}
          assistOnly={props.assistOnly}
          title={props.title}
          subtitle={props.subtitle}
        />
      </SectionPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, marginBottom: spacing.lg },
});
