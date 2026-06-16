import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard, PremiumInput } from '@/components/ui';
import {
  assertCanFinalizeDocument,
  createEmptyDocumentContext,
  renderTemplate,
  type DocumentTemplateTypeKey,
} from '@/features/documents/templateEngine';
import { DocumentPreviewValidationPanel } from './DocumentPreviewValidationPanel';
import { PlaceholderInsertPicker } from './PlaceholderInsertPicker';
import { spacing, typography } from '@/theme';

type Props = {
  title: string;
  htmlTemplate: string;
  cssTemplate?: string;
  documentType: DocumentTemplateTypeKey;
  tenantId: string;
  entityId: string;
  onTitleChange: (v: string) => void;
  onHtmlChange: (v: string) => void;
  onCssChange?: (v: string) => void;
  readOnly?: boolean;
  onFinalize?: () => void;
};

export function DocumentTemplateEditor({
  title,
  htmlTemplate,
  cssTemplate = '',
  documentType,
  tenantId,
  entityId,
  onTitleChange,
  onHtmlChange,
  onCssChange,
  readOnly,
  onFinalize,
}: Props) {
  const context = useMemo(
    () =>
      createEmptyDocumentContext({
        tenantId,
        entityType: documentType === 'invoice' ? 'invoice' : documentType === 'contract' ? 'contract' : 'service_record',
        entityId,
      }),
    [tenantId, entityId, documentType],
  );

  const renderResult = useMemo(
    () =>
      renderTemplate(
        { htmlTemplate, cssTemplate, requiredFields: [] },
        { context, documentType },
      ),
    [htmlTemplate, cssTemplate, context, documentType],
  );

  const finalizeCheck = useMemo(
    () =>
      assertCanFinalizeDocument({
        documentType,
        context,
        templateVersion: { htmlTemplate, cssTemplate, requiredFields: [] },
      }),
    [documentType, context, htmlTemplate, cssTemplate],
  );

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
        {onCssChange ? (
          <PremiumInput
            label="CSS"
            value={cssTemplate}
            onChangeText={onCssChange}
            multiline
            editable={!readOnly}
          />
        ) : null}
      </PremiumCard>

      <PlaceholderInsertPicker content={htmlTemplate} onInsert={onHtmlChange} readOnly={readOnly} />

      <PremiumCard>
        <Text style={styles.section}>HTML-Vorschau (Auszug)</Text>
        <Text style={styles.preview} numberOfLines={12}>
          {renderResult.html.replace(/<[^>]+>/g, ' ').slice(0, 800)}
        </Text>
      </PremiumCard>

      <DocumentPreviewValidationPanel
        renderResult={renderResult}
        finalizeBlocked={!finalizeCheck.allowed}
        onFinalize={onFinalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  section: { ...typography.h3, marginBottom: spacing.sm },
  preview: { ...typography.caption, fontFamily: 'monospace' },
});
