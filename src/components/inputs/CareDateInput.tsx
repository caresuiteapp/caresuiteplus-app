import { createElement, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { PremiumInput } from '@/components/ui/PremiumInput';
import type { LlganViewContext } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { formatDate, parseGermanDate } from '@/lib/formatters/dateTimeFormatters';
import { colors, spacing, typography } from '@/theme';

type Props = {
  label?: string;
  value: string;
  onChange: (isoDate: string) => void;
  error?: string;
  placeholder?: string;
  viewContext?: LlganViewContext;
  showFormatHint?: boolean;
};

function toIsoDateValue(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return parseGermanDate(trimmed) ?? '';
}

function WebNativeDateInput({
  inputRef,
  value,
  onChange,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (iso: string) => void;
}) {
  if (Platform.OS !== 'web') return null;

  return createElement('input', {
    ref: inputRef,
    type: 'date',
    value: value || '',
    lang: 'de-DE',
    'aria-hidden': true,
    tabIndex: -1,
    onChange: (event: { target: { value: string } }) => {
      onChange(event.target.value);
    },
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0,
      pointerEvents: 'none',
      border: 'none',
      padding: 0,
    },
  });
}

export function CareDateInput({
  label,
  value,
  onChange,
  error,
  placeholder = 'TT.MM.JJJJ',
  viewContext,
  showFormatHint = true,
}: Props) {
  const formattedValue = value ? formatDate(value) : '';
  const germanDisplay = formattedValue;
  const [draft, setDraft] = useState(formattedValue);
  const lastCommittedValue = useRef(value);
  const webDateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (value !== lastCommittedValue.current) {
      lastCommittedValue.current = value;
      setDraft(formattedValue);
    }
  }, [formattedValue, value]);

  const commitIso = useCallback(
    (iso: string) => {
      lastCommittedValue.current = iso;
      onChange(iso);
      setDraft(iso ? formatDate(iso) : '');
    },
    [onChange],
  );

  const openWebDatePicker = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const el = webDateInputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker();
        return;
      }
    } catch {
      // showPicker can throw if not triggered by user gesture in some browsers
    }
    el.click();
  }, []);

  return (
    <View style={styles.wrap}>
      <PremiumInput
        label={label ?? 'Datum'}
        value={draft}
        viewContext={viewContext}
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
        onFocus={Platform.OS === 'web' ? openWebDatePicker : undefined}
        placeholder={placeholder}
        error={error}
        keyboardType="numbers-and-punctuation"
      />
      <WebNativeDateInput
        inputRef={webDateInputRef}
        value={toIsoDateValue(value)}
        onChange={commitIso}
      />
      {showFormatHint ? (
        <Text style={styles.hint}>
          {germanDisplay ? `${germanDisplay} · ` : ''}Format: TT.MM.JJJJ
        </Text>
      ) : germanDisplay ? (
        <Text style={styles.hint}>{germanDisplay}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
