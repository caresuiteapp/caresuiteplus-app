import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumInput } from '@/components/ui/PremiumInput';
import { formatDate, parseGermanDate } from '@/lib/formatters/dateTimeFormatters';
import { colors, spacing, typography } from '@/theme';

type Props = {
  label?: string;
  value: string;
  onChange: (isoDate: string) => void;
  error?: string;
  placeholder?: string;
};

export function CareDateInput({ label, value, onChange, error, placeholder = 'TT.MM.JJJJ' }: Props) {
  const [draft, setDraft] = useState(() => (value ? formatDate(value) : ''));

  useEffect(() => {
    setDraft(value ? formatDate(value) : '');
  }, [value]);

  const commitDraft = (text: string) => {
    const iso = parseGermanDate(text);
    if (iso) {
      onChange(iso);
      setDraft(formatDate(iso));
      return;
    }
    if (!text.trim()) {
      onChange('');
      setDraft('');
      return;
    }
    setDraft(value ? formatDate(value) : '');
  };

  return (
    <View style={styles.wrap}>
      <PremiumInput
        label={label ?? 'Datum'}
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          const iso = parseGermanDate(text);
          if (iso) onChange(iso);
          else if (!text.trim()) onChange('');
        }}
        onBlur={() => commitDraft(draft)}
        placeholder={placeholder}
        error={error}
        keyboardType="default"
        inputMode="text"
      />
      <Text style={styles.hint}>Format: TT.MM.JJJJ</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
