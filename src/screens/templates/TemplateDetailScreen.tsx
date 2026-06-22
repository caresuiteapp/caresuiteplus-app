import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import {
  PreparedTemplateBanner,
  TemplateEditor,
  TemplateModuleBadge,
  TemplateStatusBadge,
  TemplateUsagePanel,
} from '@/components/templates';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useTemplateDetail, useTemplateEditor, useTemplateVariables } from '@/hooks/templates';
import { usePermissions } from '@/hooks/usePermissions';
import { logTemplateUsage } from '@/lib/templates';
import { useAuth } from '@/lib/auth/context';
import { spacing, typography } from '@/theme';

export function TemplateDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const { template, loading, error, refresh, tenantId } = useTemplateDetail(id);
  const { duplicateFromSystem, archive, saving } = useTemplateEditor(id);
  const vars = useTemplateVariables(template?.content ?? '');

  if (!can('office.catalogs.view')) {
    return (
      <ScreenShell title="Vorlage" subtitle={roleLabel ?? ''}>
        <LockedActionBanner message={check('office.catalogs.view').reason ?? 'Keine Berechtigung.'} />
      </ScreenShell>
    );
  }

  if (loading && !template) {
    return (
      <ScreenShell title="Vorlage" subtitle="Wird geladen…">
        <LoadingState message="Vorlage wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !template) {
    return (
      <ScreenShell title="Vorlage" subtitle="Fehler">
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  if (!template) {
    return (
      <ScreenShell title="Vorlage" subtitle="Nicht gefunden">
        <ErrorState message="Vorlage nicht gefunden." onRetry={() => router.back()} />
      </ScreenShell>
    );
  }

  const handleDuplicate = async () => {
    const result = await duplicateFromSystem(template.id);
    if (result.ok) {
      router.replace(`/business/templates/${result.data.id}/edit` as never);
    }
  };

  const handleLogUsage = async () => {
    if (!tenantId) return;
    await logTemplateUsage(tenantId, template.id, template.moduleKey, 'detail_view', profile?.roleKey);
  };

  return (
    <ScreenShell title={template.title} subtitle={template.scope === 'system' ? 'Systemvorlage' : 'Mandant'}>
      <PreparedTemplateBanner />
      <View style={styles.badges}>
        <TemplateModuleBadge moduleKey={template.moduleKey} />
        <TemplateStatusBadge status={template.status} />
      </View>
      {template.description ? <Text style={styles.desc}>{template.description}</Text> : null}
      <TemplateUsagePanel template={template} />
      <TemplateEditor
        title={template.title}
        description={template.description ?? ''}
        content={template.content}
        moduleKey={template.moduleKey}
        templateType={template.templateType}
        variables={vars.variables}
        onTitleChange={() => {}}
        onDescriptionChange={() => {}}
        onContentChange={() => {}}
        onVariableChange={vars.setVariable}
        readOnly
        template={template}
      />
      <View style={styles.actions}>
        {template.scope === 'system' && can('office.catalogs.edit') ? (
          <PremiumButton title="Als Mandantenvorlage kopieren" onPress={handleDuplicate} loading={saving} />
        ) : null}
        {template.scope === 'tenant' && can('office.catalogs.edit') ? (
          <PremiumButton
            title="Bearbeiten"
            variant="secondary"
            onPress={() => router.push(`/business/templates/${template.id}/edit` as never)}
          />
        ) : null}
        <PremiumButton title="Nutzung protokollieren" variant="secondary" onPress={handleLogUsage} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  desc: { ...typography.body, marginBottom: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
