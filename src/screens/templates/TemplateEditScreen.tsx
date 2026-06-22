import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { PreparedTemplateBanner, TemplateEditor } from '@/components/templates';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, SuccessState } from '@/components/ui';
import { useTemplateDetail, useTemplateEditor, useTemplateVariables } from '@/hooks/templates';
import { usePermissions } from '@/hooks/usePermissions';
import { spacing } from '@/theme';

export function TemplateEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can, check, roleLabel } = usePermissions();
  const { template, loading, error, refresh } = useTemplateDetail(id);
  const { update, archive, saving, error: saveError } = useTemplateEditor(id);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [archived, setArchived] = useState(false);
  const vars = useTemplateVariables(content);

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setDescription(template.description ?? '');
      setContent(template.content);
      vars.setContent(template.content);
    }
  }, [template?.id]);

  if (!can('office.catalogs.edit')) {
    return (
      <ScreenShell title="Vorlage bearbeiten" subtitle={roleLabel ?? ''}>
        <LockedActionBanner message={check('office.catalogs.edit').reason ?? 'Keine Berechtigung.'} />
      </ScreenShell>
    );
  }

  if (loading && !template) {
    return (
      <ScreenShell title="Vorlage bearbeiten" subtitle="Wird geladen…">
        <LoadingState message="Vorlage wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !template) {
    return (
      <ScreenShell title="Vorlage bearbeiten" subtitle="Fehler">
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  if (!template || template.scope !== 'tenant') {
    return (
      <ScreenShell title="Vorlage bearbeiten" subtitle="Nicht editierbar">
        <ErrorState message="Nur Mandantenvorlagen können bearbeitet werden." onRetry={() => router.back()} />
      </ScreenShell>
    );
  }

  if (archived) {
    return (
      <ScreenShell title="Archiviert" subtitle="Vorlage">
        <SuccessState message="Vorlage wurde archiviert." />
        <PremiumButton title="Zur Übersicht" onPress={() => router.replace('/business/templates' as never)} />
      </ScreenShell>
    );
  }

  const handleSave = async () => {
    const result = await update({
      title: title.trim(),
      description: description.trim() || null,
      content,
      status: 'active',
    });
    if (result.ok) {
      router.replace(`/business/templates/${result.data.id}` as never);
    }
  };

  const handleArchive = async () => {
    const result = await archive();
    if (result.ok) setArchived(true);
  };

  return (
    <ScreenShell title="Vorlage bearbeiten" subtitle={template.title}>
      <PreparedTemplateBanner />
      <TemplateEditor
        title={title}
        description={description}
        content={content}
        moduleKey={template.moduleKey}
        templateType={template.templateType}
        variables={vars.variables}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onContentChange={(v) => {
          setContent(v);
          vars.setContent(v);
        }}
        onVariableChange={vars.setVariable}
      />
      {saveError ? <PremiumButton title={saveError} variant="ghost" disabled /> : null}
      <View style={styles.actions}>
        <PremiumButton title="Speichern" onPress={handleSave} loading={saving} disabled={!title.trim()} />
        <PremiumButton title="Archivieren" variant="secondary" onPress={handleArchive} loading={saving} />
        <PremiumButton title="Abbrechen" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
