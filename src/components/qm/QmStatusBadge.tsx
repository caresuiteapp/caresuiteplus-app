import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import type { QmComplianceStatus, QmDocumentStatus, MdPackageStatus, QmExportJobStatus } from '@/lib/qm';
import { colors, spacing, typography } from '@/theme';

const DOC_STATUS: Record<QmDocumentStatus, { label: string; variant: 'cyan' | 'orange' | 'green' | 'muted' }> = {
  draft: { label: 'Entwurf', variant: 'muted' },
  in_review: { label: 'In Prüfung', variant: 'orange' },
  approved: { label: 'Freigegeben', variant: 'cyan' },
  published: { label: 'Veröffentlicht', variant: 'green' },
  archived: { label: 'Archiviert', variant: 'muted' },
  superseded: { label: 'Ersetzt', variant: 'muted' },
};

const COMPLIANCE_STATUS: Record<QmComplianceStatus, { label: string; variant: 'cyan' | 'orange' | 'green' | 'muted' }> = {
  open: { label: 'Offen', variant: 'orange' },
  in_progress: { label: 'In Bearbeitung', variant: 'cyan' },
  fulfilled: { label: 'Erfüllt', variant: 'green' },
  overdue: { label: 'Überfällig', variant: 'orange' },
  waived: { label: 'Entbehrlich', variant: 'muted' },
};

const MD_STATUS: Record<MdPackageStatus, { label: string; variant: 'cyan' | 'orange' | 'green' | 'muted' }> = {
  draft: { label: 'Entwurf', variant: 'muted' },
  in_preparation: { label: 'In Vorbereitung', variant: 'cyan' },
  pending_approval: { label: 'Freigabe ausstehend', variant: 'orange' },
  approved: { label: 'Freigegeben', variant: 'green' },
  exported: { label: 'Exportiert', variant: 'green' },
  shared: { label: 'Geteilt', variant: 'cyan' },
  revoked: { label: 'Widerrufen', variant: 'muted' },
};

const EXPORT_STATUS: Record<QmExportJobStatus, { label: string; variant: 'cyan' | 'orange' | 'green' | 'muted' }> = {
  in_preparation: { label: 'In Vorbereitung', variant: 'cyan' },
  generated: { label: 'Generiert (P-READY)', variant: 'green' },
  failed: { label: 'Fehlgeschlagen', variant: 'orange' },
  expired: { label: 'Abgelaufen', variant: 'muted' },
};

type Props =
  | { kind: 'document'; status: QmDocumentStatus }
  | { kind: 'compliance'; status: QmComplianceStatus }
  | { kind: 'md_package'; status: MdPackageStatus }
  | { kind: 'export'; status: QmExportJobStatus };

export function QmStatusBadge(props: Props) {
  const map =
    props.kind === 'document'
      ? DOC_STATUS[props.status]
      : props.kind === 'compliance'
        ? COMPLIANCE_STATUS[props.status]
        : props.kind === 'md_package'
          ? MD_STATUS[props.status]
          : EXPORT_STATUS[props.status];

  return <PremiumBadge label={map.label} variant={map.variant} dot />;
}

export function QmTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    procedure: 'Verfahren',
    work_instruction: 'Arbeitsanweisung',
    checklist: 'Checkliste',
    protocol: 'Protokoll',
    policy: 'Richtlinie',
    form: 'Formular',
    handbook_chapter: 'Handbuch-Kapitel',
  };
  return <Text style={styles.type}>{labels[type] ?? type}</Text>;
}

const styles = StyleSheet.create({
  type: { ...typography.caption, color: colors.textMuted },
});
