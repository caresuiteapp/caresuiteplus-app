import { StyleSheet, Text, View } from 'react-native';
import { PremiumInput } from '@/components/ui';
import { extractTemplateVariables } from '@/lib/templates';
import { spacing, typography } from '@/theme';

type Props = {
  content: string;
  variables: Record<string, string>;
  onChange: (key: string, value: string) => void;
  readOnly?: boolean;
};

export function TemplateVariablePicker({ content, variables, onChange, readOnly }: Props) {
  const keys = extractTemplateVariables(content);
  if (keys.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Variablen</Text>
      {keys.map((key) => (
        <PremiumInput
          key={key}
          label={key}
          value={variables[key] ?? ''}
          onChangeText={(v) => onChange(key, v)}
          editable={!readOnly}
          placeholder={`Wert für {{${key}}}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.h3 },
});
