import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import {
  fetchOfficeQuickReplyTemplates,
  OFFICE_QUICK_REPLY_TEMPLATES,
  type OfficeQuickReplyTemplate,
} from '@/lib/office/messagequickreplies';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

type OfficeQuickReplyPickerProps = {
  onSelect: (body: string) => void;
  disabled?: boolean;
};

export function OfficeQuickReplyPicker({ onSelect, disabled }: OfficeQuickReplyPickerProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [templates, setTemplates] = useState<OfficeQuickReplyTemplate[]>([
    ...OFFICE_QUICK_REPLY_TEMPLATES,
  ]);

  useEffect(() => {
    if (!tenantId) return;
    void fetchOfficeQuickReplyTemplates(tenantId, profile?.roleKey).then((result) => {
      if (result.ok && result.data.length > 0) {
        setTemplates(result.data);
      }
    });
  }, [tenantId, profile?.roleKey]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { gap: spacing.xs, paddingHorizontal: spacing.md },
        label: { ...typography.caption, color: c.muted },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        chip: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.capsule,
          borderWidth: 1,
          borderColor: c.border,
          opacity: disabled ? 0.5 : 1,
        },
        chipText: { ...typography.caption, color: c.muted },
      }),
    [c, disabled, typography],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Schnellantworten</Text>
      <View style={styles.chips}>
        {templates.map((template) => (
          <Pressable
            key={template.key}
            disabled={disabled}
            onPress={() => onSelect(template.body)}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{template.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
