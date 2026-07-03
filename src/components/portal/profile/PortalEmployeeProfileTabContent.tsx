import { StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/ui';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import type {
  PortalEmployeePersonnelView,
  PortalEmployeeProfileTabKey,
  PortalProfileField,
} from '@/types/portal/employeePersonnel';
import { PortalProfileInfoRow } from './PortalProfileInfoRow';
import { PORTAL_PROFILE_EMPTY_MESSAGES } from './portalProfileTabs';

type PortalEmployeeProfileTabContentProps = {
  tab: PortalEmployeeProfileTabKey;
  view: PortalEmployeePersonnelView;
};

function FieldsPanel({
  title,
  fields,
  emptyMessage,
}: {
  title: string;
  fields: PortalProfileField[];
  emptyMessage: string;
}) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  if (fields.length === 0) {
    return (
      <GlassCard>
        <EmptyState title={title} message={emptyMessage} />
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <Text style={[type.caption, { color: text.muted, marginBottom: careSpacing.sm }]}>{title}</Text>
      {fields.map((row) => (
        <PortalProfileInfoRow key={`${title}-${row.label}`} label={row.label} value={row.value} />
      ))}
    </GlassCard>
  );
}

export function PortalEmployeeProfileTabContent({ tab, view }: PortalEmployeeProfileTabContentProps) {
  const empty = PORTAL_PROFILE_EMPTY_MESSAGES[tab] ?? 'Keine Daten hinterlegt.';

  switch (tab) {
    case 'overview':
      return <FieldsPanel title="ÜBERSICHT" fields={view.overview} emptyMessage={empty} />;
    case 'master_data':
      return <FieldsPanel title="STAMMDATEN" fields={view.masterData} emptyMessage={empty} />;
    case 'contact':
      return <FieldsPanel title="KONTAKT" fields={view.contact} emptyMessage={empty} />;
    case 'employment':
      return <FieldsPanel title="ANSTELLUNG" fields={view.employment} emptyMessage={empty} />;
    case 'compensation':
      return <FieldsPanel title="VERGÜTUNG & BANK" fields={view.compensation} emptyMessage={empty} />;
    case 'tax_social':
      return <FieldsPanel title="STEUER & SV" fields={view.taxSocial} emptyMessage={empty} />;
    case 'secondary_employment':
      return (
        <FieldsPanel title="MEHRFACHBESCHÄFTIGUNG" fields={view.secondaryEmployment} emptyMessage={empty} />
      );
    case 'roles_permissions':
      return <FieldsPanel title="ROLLEN & RECHTE" fields={view.roles} emptyMessage={empty} />;
    case 'qualifications':
      if (view.qualifications.length === 0) {
        return (
          <GlassCard>
            <EmptyState title="Qualifikationen" message={empty} />
          </GlassCard>
        );
      }
      return (
        <GlassCard>
          {view.qualifications.map((item) => (
            <View key={item.id} style={styles.qualBlock}>
              <PortalProfileInfoRow label="Qualifikation" value={item.title} />
              {item.typeLabel ? (
                <PortalProfileInfoRow label="Art" value={item.typeLabel} />
              ) : null}
              <PortalProfileInfoRow label="Status" value={item.statusLabel} />
              {item.validUntil ? (
                <PortalProfileInfoRow label="Gültig bis" value={item.validUntil} />
              ) : null}
            </View>
          ))}
        </GlassCard>
      );
    case 'documents':
      if (view.documents.length === 0) {
        return (
          <GlassCard>
            <EmptyState title="Dokumente" message={empty} />
          </GlassCard>
        );
      }
      return (
        <GlassCard>
          {view.documents.map((doc) => (
            <View key={doc.id} style={styles.docBlock}>
              <PortalProfileInfoRow label={doc.categoryLabel} value={doc.title} />
              <PortalProfileInfoRow label="Datei" value={doc.fileName} />
              {doc.validUntil ? (
                <PortalProfileInfoRow label="Gültig bis" value={doc.validUntil} />
              ) : null}
            </View>
          ))}
        </GlassCard>
      );
    case 'portal':
      return <FieldsPanel title="PORTAL" fields={view.portal} emptyMessage={empty} />;
    case 'deployability':
      return <FieldsPanel title="EINSATZFÄHIGKEIT" fields={view.deployability} emptyMessage={empty} />;
    case 'work_materials':
      if (view.workMaterials.length === 0) {
        return (
          <GlassCard>
            <EmptyState title="Arbeitsmaterial" message={empty} />
          </GlassCard>
        );
      }
      return (
        <GlassCard>
          {view.workMaterials.map((item) => (
            <View key={item.id} style={styles.materialBlock}>
              <PortalProfileInfoRow label={item.categoryLabel} value={item.itemName} />
              <PortalProfileInfoRow label="Status" value={item.statusLabel} />
              {item.issuedAt ? (
                <PortalProfileInfoRow label="Ausgegeben am" value={item.issuedAt} />
              ) : null}
              {item.returnDueAt ? (
                <PortalProfileInfoRow label="Rückgabe bis" value={item.returnDueAt} />
              ) : null}
            </View>
          ))}
        </GlassCard>
      );
    case 'audit':
      if (view.history.length === 0) {
        return (
          <GlassCard>
            <EmptyState title="Verlauf" message={empty} />
          </GlassCard>
        );
      }
      return (
        <GlassCard>
          {view.history.map((entry) => (
            <View key={entry.id} style={styles.historyBlock}>
              <PortalProfileInfoRow label={entry.occurredAt} value={entry.summary} />
            </View>
          ))}
        </GlassCard>
      );
    default:
      return (
        <GlassCard>
          <EmptyState title="Profil" message={empty} />
        </GlassCard>
      );
  }
}

const styles = StyleSheet.create({
  qualBlock: {
    marginBottom: careSpacing.md,
  },
  docBlock: {
    marginBottom: careSpacing.md,
  },
  materialBlock: {
    marginBottom: careSpacing.md,
  },
  historyBlock: {
    marginBottom: careSpacing.sm,
  },
});
