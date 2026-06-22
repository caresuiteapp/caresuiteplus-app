import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { PreparedTemplateBanner, TemplateEditor } from '@/components/templates';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useTemplateEditor, useTemplateVariables } from '@/hooks/templates';
import { usePermissions } from '@/hooks/usePermissions';
import { createTemplate } from '@/lib/templates/templateService';
import type { TemplateModuleKey, TemplateType } from '@/types/templates';
import { spacing } from '@/theme';

export function TemplateCreateScreen() {
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const { create, saving, error } = useTemplateEditor();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('{{clientName}} — ');
  const vars = useTemplateVariables(content);

  const moduleKey: TemplateModuleKey = 'office';
  const templateType: TemplateType = 'documentation_text';

  if (!can('office.catalogs.edit')) {
    return (
      <ScreenShell title="Neue Vorlage" subtitle={roleLabel ?? ''}>
        <LockedActionBanner message={check('office.catalogs.edit').reason ?? 'Keine Berechtigung.'} />
      </ScreenShell>
    );
  }

  if (saving) {
    return (
      <ScreenShell title="Neue Vorlage" subtitle="Speichern…">
        <LoadingState message="Vorlage wird gespeichert…" />
      </ScreenShell>
    );
  }

  const handleSave = async () => {
    const result = await create({
      moduleKey,
      templateType,
      title: title.trim(),
      description: description.trim() || null,
      content,
      variables: vars.variables ? Object.keys(vars.variables) : undefined,
      status: 'draft',
    });
    if (result.ok) {
      router.replace(`/business/templates/${result.data.id}` as never);
    }
  };

  const isEmpty = !title.trim() && !description.trim() && content.trim() === '{{clientName}} — ';

  return (
    <ScreenShell title="Neue Vorlage" subtitle="Mandantenvorlage anlegen">
      <PreparedTemplateBanner />
      {isEmpty ? (
        <EmptyState title="Neue Vorlage" message="Titel und Inhalt unten erfassen und speichern." />
      ) : null}
      <TemplateEditor
        title={title}
        description={description}
        content={content}
        moduleKey={moduleKey}
        templateType={templateType}
        variables={vars.variables}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onContentChange={(v) => {
          setContent(v);
          vars.setContent(v);
        }}
        onVariableChange={vars.setVariable}
      />
      {error ? <ErrorState title="Speichern" message={error} /> : null}
      <View style={styles.actions}>
        <PremiumButton title="Speichern" onPress={handleSave} loading={saving} disabled={!title.trim()} />
        <PremiumButton title="Abbrechen" variant="secondary" onPress={() => router.back()} />
      </View>
    </ScreenShell>
  );
}

void createTemplate;

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
