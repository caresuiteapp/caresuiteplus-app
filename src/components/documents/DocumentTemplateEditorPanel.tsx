import { StyleSheet, View } from 'react-native';
import { PremiumCard, PremiumInput } from '@/components/ui';
import { DocumentBlockPicker } from './DocumentBlockPicker';
import { DocumentTextSnippetPicker } from './DocumentTextSnippetPicker';
import { PlaceholderInsertPicker } from './PlaceholderInsertPicker';
import { spacing } from '@/theme';

type Props = {
  title: string;
  htmlTemplate: string;
  cssTemplate: string;
  onTitleChange: (v: string) => void;
  onHtmlChange: (v: string) => void;
  onCssChange: (v: string) => void;
  readOnly?: boolean;
};

/** Reine Editor-Schicht — kein Rendering. */
export function DocumentTemplateEditorPanel({
  title,
  htmlTemplate,
  cssTemplate,
  onTitleChange,
  onHtmlChange,
  onCssChange,
  readOnly,
}: Props) {
  return (
    <View style={styles.wrap}>
      <PremiumCard>
        <PremiumInput label="Titel" value={title} onChangeText={onTitleChange} editable={!readOnly} />
        <PremiumInput
          label="HTML-Vorlage"
          value={htmlTemplate}
          onChangeText={onHtmlChange}
          multiline
          editable={!readOnly}
          hint="Platzhalter: {{company.name}}"
        />
        <PremiumInput
          label="CSS"
          value={cssTemplate}
          onChangeText={onCssChange}
          multiline
          editable={!readOnly}
        />
      </PremiumCard>

      <PlaceholderInsertPicker content={htmlTemplate} onInsert={onHtmlChange} readOnly={readOnly} />
      <DocumentBlockPicker htmlTemplate={htmlTemplate} onInsert={onHtmlChange} readOnly={readOnly} />
      <DocumentTextSnippetPicker htmlTemplate={htmlTemplate} onInsert={onHtmlChange} readOnly={readOnly} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
});
