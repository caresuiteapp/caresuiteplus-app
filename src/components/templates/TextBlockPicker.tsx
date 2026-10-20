import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LoadingState } from '@/components/ui';
import { useTextBlocks } from '@/hooks/templates';
import type { TemplateModuleKey } from '@/types/templates';
import { colors, spacing, typography } from '@/theme';

type Props = {
  moduleKey?: TemplateModuleKey;
  value: string | null;
  onChange: (content: string, title: string) => void;
  label?: string;
};

export function TextBlockPicker({ moduleKey, value, onChange, label = 'Textbaustein' }: Props) {
  const [open, setOpen] = useState(false);
  const { textBlocks, loading, error } = useTextBlocks(moduleKey);

  const selected = textBlocks.find((t) => t.content === value);

  if (loading && textBlocks.length === 0) {
    return <LoadingState message="Textbausteine werden geladen…" />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.trigger} onPress={() => setOpen((o) => !o)}>
        <Text style={styles.triggerText} numberOfLines={1}>
          {selected?.title ?? 'Textbaustein wählen…'}
        </Text>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {open ? (
        <View style={styles.list}>
          {textBlocks.map((t) => (
            <Pressable
              key={t.id}
              style={styles.option}
              onPress={() => {
                onChange(t.content, t.title);
                setOpen(false);
              }}
            >
              <Text style={styles.optionTitle}>{t.title}</Text>
              <Text style={styles.optionMeta} numberOfLines={2}>
                {t.content}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textMuted },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.bgPanel,
  },
  triggerText: { ...typography.body, flex: 1 },
  chevron: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.sm },
  list: { borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 8, maxHeight: 240 },
  option: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  optionTitle: { ...typography.body },
  optionMeta: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.danger },
});
