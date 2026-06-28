import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useMemo } from 'react';
import { resolveAssignmentCardHoverDetails } from '@/lib/assist/assignmentCardPresentation';
import type { AssignmentListItem } from '@/types/modules/assist';
import { useAuroraAdaptiveText, useAuroraGlassCardStyle } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

type AssignmentCardHoverDetailsProps = {
  assignment: AssignmentListItem;
};

/** Desktop hover overlay — address, contact hints, notes, last documentation. */
export function AssignmentCardHoverDetails({ assignment }: AssignmentCardHoverDetailsProps) {
  const text = useAuroraAdaptiveText();
  const glassStyle = useAuroraGlassCardStyle({ viewContext: 'dashboard', intensity: 'elevated' });
  const details = resolveAssignmentCardHoverDetails(assignment);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: spacing.xs,
          zIndex: 20,
          padding: spacing.sm,
          gap: 4,
          borderRadius: 12,
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
              } as ViewStyle)
            : null),
        },
        title: { ...typography.caption, color: text.muted, fontWeight: '600' },
        line: { ...typography.caption, color: text.secondary },
      }),
    [text.muted, text.secondary],
  );

  const rows = [
    { label: 'Adresse', value: details.address },
    details.phone ? { label: 'Telefon', value: details.phone } : null,
    details.careLevel ? { label: 'Pflegegrad', value: details.careLevel } : null,
    details.birthdayHint ? { label: 'Hinweis', value: details.birthdayHint } : null,
    details.notes ? { label: 'Notizen', value: details.notes } : null,
    details.lastDocumentation
      ? { label: 'Dokumentation', value: details.lastDocumentation }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <View style={[styles.panel, glassStyle]}>
      {rows.map((row) => (
        <View key={row.label}>
          <Text style={styles.title}>{row.label}</Text>
          <Text style={styles.line} numberOfLines={2}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
