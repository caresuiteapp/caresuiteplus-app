import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { EmptyState, PremiumBadge, PremiumButton, PremiumDataTable, SectionPanel } from '@/components/ui';
import type { DocumentEngineTemplateListItem } from '@/types/documents/documentEngine';
import { colors, spacing } from '@/theme';

type DocumentTemplateListPanelProps = {
  title: string;
  templates: DocumentEngineTemplateListItem[];
  loading?: boolean;
};

function statusVariant(status: string): 'success' | 'warning' | 'muted' {
  if (status === 'active') return 'success';
  if (status === 'draft') return 'warning';
  return 'muted';
}

export function DocumentTemplateListPanel({ title, templates, loading }: DocumentTemplateListPanelProps) {
  const router = useRouter();
  const tableText = useTableTextStyles();

  if (!loading && templates.length === 0) {
    return (
      <SectionPanel title={title}>
        <EmptyState title="Keine Vorlagen" message="In diesem Bereich sind keine Dokumentvorlagen hinterlegt." />
      </SectionPanel>
    );
  }

  return (
    <SectionPanel title={title} subtitle={loading ? 'Wird geladen…' : `${templates.length} Vorlagen`}>
      <PremiumDataTable
        data={templates}
        keyExtractor={(item) => item.id}
        emptyMessage="Keine Vorlagen"
        columns={[
          {
            key: 'number',
            label: 'Nummer',
            width: 72,
            render: (item) => (
              <Text style={tableText.cellText}>{item.templateNumber ?? '—'}</Text>
            ),
          },
          {
            key: 'name',
            label: 'Name',
            flex: 1.6,
            render: (item) => <Text style={tableText.name}>{item.name}</Text>,
          },
          {
            key: 'category',
            label: 'Kategorie',
            flex: 1,
            render: (item) => <Text style={tableText.cellText}>{item.category ?? '—'}</Text>,
          },
          {
            key: 'module',
            label: 'Modul',
            flex: 1,
            render: (item) => (
              <Text style={tableText.cellText} numberOfLines={1}>
                {item.moduleScope.length > 0 ? item.moduleScope.join(', ') : '—'}
              </Text>
            ),
          },
          {
            key: 'target',
            label: 'Zielakte',
            flex: 1,
            render: (item) => (
              <Text style={tableText.cellText} numberOfLines={1}>
                {item.targetRecordType ?? item.defaultStorageArea ?? '—'}
              </Text>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            flex: 0.9,
            render: (item) => (
              <PremiumBadge
                label={item.templateStatus}
                variant={statusVariant(item.templateStatus)}
                dot
              />
            ),
          },
          {
            key: 'pdf',
            label: 'PDF',
            width: 52,
            align: 'center',
            render: (item) => (
              <Text style={tableText.cellText}>{item.isPdfEnabled ? '✓' : '—'}</Text>
            ),
          },
          {
            key: 'assist',
            label: 'Assist',
            width: 56,
            align: 'center',
            render: (item) => (
              <Text style={tableText.cellText}>{item.isAssistAllowed ? '✓' : '—'}</Text>
            ),
          },
          {
            key: 'actions',
            label: 'Aktionen',
            width: 280,
            align: 'right',
            render: (item) => (
              <View style={styles.actions}>
                <PremiumButton
                  title="Vorschau"
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    router.push(`/business/templates/live-preview?templateId=${item.id}` as never)
                  }
                />
                <PremiumButton
                  title="Editor"
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    router.push(`/business/templates/document-editor/${item.id}` as never)
                  }
                />
                <PremiumButton
                  title="PDF-Test"
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    router.push(`/business/templates/live-preview?templateId=${item.id}` as never)
                  }
                />
              </View>
            ),
          },
        ]}
      />
      {templates.some((t) => t.scope !== 'tenant') ? (
        <Text style={styles.scopeHint}>
          System- und Importvorlagen ({templates.filter((t) => t.scope !== 'tenant').length}) sind schreibgeschützt.
        </Text>
      ) : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-end',
  },
  scopeHint: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
