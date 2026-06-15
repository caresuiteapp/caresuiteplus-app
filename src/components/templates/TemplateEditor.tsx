import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard, PremiumInput } from '@/components/ui';
import type { CareSuiteTemplate, TemplateModuleKey, TemplateType } from '@/types/templates';
import { TemplatePreview } from './TemplatePreview';
import { TemplateVariablePicker } from './TemplateVariablePicker';
import { spacing, typography } from '@/theme';

type Props = {
  title: string;
  description: string;
  content: string;
  moduleKey: TemplateModuleKey;
  templateType: TemplateType;
  variables: Record<string, string>;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onVariableChange: (key: string, value: string) => void;
  readOnly?: boolean;
  template?: CareSuiteTemplate | null;
};

export function TemplateEditor({
  title,
  description,
  content,
  variables,
  onTitleChange,
  onDescriptionChange,
  onContentChange,
  onVariableChange,
  readOnly,
}: Props) {
  return (
    <View style={styles.wrap}>
      <PremiumCard>
        <PremiumInput
          label="Titel"
          value={title}
          onChangeText={onTitleChange}
          editable={!readOnly}
        />
        <PremiumInput
          label="Beschreibung"
          value={description}
          onChangeText={onDescriptionChange}
          editable={!readOnly}
        />
        <PremiumInput
          label="Inhalt"
          value={content}
          onChangeText={onContentChange}
          multiline
          editable={!readOnly}
          hint="Variablen: {{name}}"
        />
      </PremiumCard>
      <TemplateVariablePicker
        content={content}
        variables={variables}
        onChange={onVariableChange}
        readOnly={readOnly}
      />
      <PremiumCard>
        <Text style={styles.section}>Vorschau</Text>
        <TemplatePreview content={content} variables={variables} />
      </PremiumCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  section: { ...typography.h3, marginBottom: spacing.sm },
});
