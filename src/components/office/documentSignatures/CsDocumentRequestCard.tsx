import { StyleSheet, Text, View } from 'react-native';
import type { CsDocumentRequestListItem } from '@/types/documents/csTemplateDatabase';
import {
  CS_DOCUMENT_PRIORITY_LABELS,
  resolveCsDocumentRequestStatusLabel,
} from '@/types/documents/csTemplateDatabase';
import { PremiumBadge, PremiumButton, PremiumCard } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

type Props = {
  item: CsDocumentRequestListItem;
  onOpen?: () => void;
  openLabel?: string;
  compact?: boolean;
  portalLabels?: boolean;
};

export function CsDocumentRequestCard({
  item,
  onOpen,
  openLabel = 'Öffnen',
  compact = false,
  portalLabels = false,
}: Props) {
  const text = useAuroraAdaptiveText();
  const styles = StyleSheet.create({
    title: { ...typography.body, fontWeight: '600', color: text.primary },
    meta: { ...typography.caption, color: text.muted, marginTop: spacing.xs },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
    flag: { ...typography.caption, color: text.secondary, marginTop: spacing.xs },
  });

  const priorityVariant =
    item.priority === 'urgent' || item.priority === 'high'
      ? 'orange'
      : item.priority === 'low'
        ? 'muted'
        : 'blue';

  return (
    <PremiumCard>
      <Text style={styles.title}>{item.title}</Text>
      {!compact ? (
        <Text style={styles.meta}>
          {item.sourceTemplateKey ?? 'Dokument'} · Fällig {item.dueDate ? new Date(item.dueDate).toLocaleDateString('de-DE') : '—'}
        </Text>
      ) : null}
      <View style={styles.row}>
        <PremiumBadge
          label={resolveCsDocumentRequestStatusLabel(item.status, portalLabels)}
          variant="muted"
        />
        <PremiumBadge label={CS_DOCUMENT_PRIORITY_LABELS[item.priority]} variant={priorityVariant} />
        {item.requiredBeforeService ? (
          <PremiumBadge label="Pflicht vor Einsatz" variant="red" />
        ) : null}
        {item.pendingSignatureRoles.length > 0 ? (
          <PremiumBadge label={`Signatur: ${item.pendingSignatureRoles.join(', ')}`} variant="orange" />
        ) : null}
      </View>
      {onOpen ? (
        <View style={{ marginTop: spacing.sm }}>
          <PremiumButton title={openLabel} size="sm" variant="secondary" onPress={onOpen} />
        </View>
      ) : null}
    </PremiumCard>
  );
}
