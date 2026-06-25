import { useEffect, useRef, useState } from 'react';
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
  const formattedValue = value ? formatDate(value) : '';
  const [draft, setDraft] = useState(formattedValue);
  const lastCommittedValue = useRef(value);

  useEffect(() => {
    if (value !== lastCommittedValue.current) {
      lastCommittedValue.current = value;
      setDraft(formattedValue);
    }
  }, [formattedValue, value]);

  return (
    <View style={styles.wrap}>
      <PremiumInput
        label={label ?? 'Datum'}
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          const iso = parseGermanDate(text);
          if (iso) {
            lastCommittedValue.current = iso;
            onChange(iso);
          } else if (!text.trim()) {
            lastCommittedValue.current = '';
            onChange('');
          }
        }}
        onBlur={() => {
          const iso = parseGermanDate(draft);
          if (iso) {
            lastCommittedValue.current = iso;
            onChange(iso);
            setDraft(formatDate(iso));
            return;
          }
          if (!draft.trim()) {
            lastCommittedValue.current = '';
            onChange('');
            return;
          }
          setDraft(formattedValue);
        }}
        placeholder={placeholder}
        error={error}
        keyboardType="numbers-and-punctuation"
      />
      <Text style={styles.hint}>Format: TT.MM.JJJJ</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
