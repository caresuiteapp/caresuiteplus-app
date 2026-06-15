import { StyleSheet, Text, View } from 'react-native';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { PremiumButton, PremiumCard } from '@/components/ui';
import type { MdAuditPackage, MdAuditPackageItem } from '@/lib/qm';
import { QmStatusBadge } from './QmStatusBadge';
import { colors, spacing, typography } from '@/theme';

type Props = {
  pkg: MdAuditPackage;
  items: MdAuditPackageItem[];
  canApprove: boolean;
  canShare: boolean;
  onConfirmDatenschutz?: () => void;
  onApprove?: () => void;
  onShare?: () => void;
  loading?: boolean;
};

export function MdPackageBuilder({
  pkg,
  items,
  canApprove,
  canShare,
  onConfirmDatenschutz,
  onApprove,
  onShare,
  loading,
}: Props) {
  const step =
    !pkg.datenschutzConfirmed ? 1 :
    pkg.status === 'pending_approval' ? 2 :
    pkg.status === 'approved' || pkg.status === 'shared' ? 3 : 0;

  return (
    <View style={styles.wrap}>
      <PreparedModeBanner hint="PDF-Export und QR-Freigabe sind P-READY — kein echter Download." />
      <PremiumCard accentColor={colors.cyan}>
        <Text style={styles.title}>{pkg.title}</Text>
        <QmStatusBadge kind="md_package" status={pkg.status} />
        <Text style={styles.meta}>{items.length} Dokumente · Prüfjahr {pkg.inspectionYear}</Text>
      </PremiumCard>

      {step === 1 && canApprove && onConfirmDatenschutz && (
        <PremiumButton
          title="Datenschutz bestätigen"
          onPress={onConfirmDatenschutz}
          loading={loading}
          fullWidth
        />
      )}
      {step === 2 && canApprove && onApprove && (
        <PremiumButton title="Mappe freigeben & Export starten" onPress={onApprove} loading={loading} fullWidth />
      )}
      {step === 3 && canShare && onShare && pkg.status !== 'shared' && (
        <PremiumButton title="Freigabe-Token erstellen" onPress={onShare} loading={loading} fullWidth />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
