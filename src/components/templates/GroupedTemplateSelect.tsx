import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useAuroraGlassSelectStyles } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useTemplates } from '@/hooks/templates/useTemplates';
import type { ComposeRecipientType } from '@/lib/communication/composeRecipients';
import {
  COMPOSE_TEMPLATE_AUDIENCES,
  defaultAudienceTabForRecipient,
  defaultAudiencesForRecipient,
  normalizeTemplateAudience,
  type ComposeTemplateAudience,
} from '@/lib/templates/composeTemplateAudiences';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing, radius } from '@/theme';
import type { CareSuiteTemplate } from '@/types/templates';

type GroupedTemplateSelectProps = {
  recipientType: ComposeRecipientType;
  value: string;
  onChange: (templateId: string, content: string, subject?: string) => void;
  label?: string;
  style?: ViewStyle;
};

type AudienceTab = ComposeTemplateAudience | 'all';

const PICKER_MAX_WIDTH = 640;
const PICKER_MAX_HEIGHT = 520;

function groupTemplates(templates: CareSuiteTemplate[]) {
  const groups: Record<ComposeTemplateAudience, CareSuiteTemplate[]> = {
    klient: [],
    mitarbeiter: [],
    team: [],
    intern: [],
  };

  for (const template of templates) {
    const audience = normalizeTemplateAudience(template.categoryKey);
    if (audience) {
      groups[audience].push(template);
    }
  }

  for (const key of Object.keys(groups) as ComposeTemplateAudience[]) {
    groups[key].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'de'));
  }

  return groups;
}

export function GroupedTemplateSelect({
  recipientType,
  value,
  onChange,
  label = 'Nachrichtenvorlage',
  style,
}: GroupedTemplateSelectProps) {
  const baseStyles = useAuroraGlassSelectStyles();
  const { colors, typography } = useLegacyTheme();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AudienceTab>(() =>
    defaultAudienceTabForRecipient(recipientType),
  );

  const { templates, loading, error: loadError } = useTemplates({
    moduleKey: 'communication',
    templateType: 'message',
    status: 'active',
  });

  const grouped = useMemo(() => groupTemplates(templates), [templates]);
  const preferredAudiences = useMemo(
    () => defaultAudiencesForRecipient(recipientType),
    [recipientType],
  );
  useEffect(() => {
    setActiveTab(defaultAudienceTabForRecipient(recipientType));
  }, [recipientType]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        sectionHeader: {
          ...typography.caption,
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          paddingHorizontal: careSpacing.md,
          paddingTop: careSpacing.sm,
          paddingBottom: careSpacing.xs,
          backgroundColor: `${colors.violet}08`,
        },
        tabs: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          marginBottom: spacing.sm,
        },
        tab: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.capsule,
          borderWidth: 1,
          borderColor: colors.borderSoft,
        },
        tabActive: {
          backgroundColor: `${colors.violet}22`,
          borderColor: colors.violet,
        },
        tabText: { ...typography.caption, color: colors.textSecondary },
        tabTextActive: { color: colors.violet, fontWeight: '700' },
        hint: { ...typography.caption, color: colors.textMuted, opacity: 0.85 },
        pickerSheet: {
          ...baseStyles.modalSheet,
          maxWidth: PICKER_MAX_WIDTH,
          width: '100%',
        },
        pickerScroll: {
          maxHeight: PICKER_MAX_HEIGHT,
        },
        emptySection: {
          ...typography.caption,
          color: colors.textMuted,
          paddingHorizontal: careSpacing.md,
          paddingVertical: careSpacing.sm,
        },
        categoryMeta: {
          ...typography.caption,
          color: colors.textMuted,
          paddingHorizontal: careSpacing.md,
          paddingBottom: careSpacing.xs,
        },
      }),
    [baseStyles.modalSheet, colors, typography],
  );

  const selectedTemplate = templates.find((t) => t.id === value);
  const selectedLabel = selectedTemplate?.title ?? 'Vorlage wählen…';

  const visibleSections = useMemo(() => {
    if (activeTab !== 'all') {
      return [{ audience: activeTab, items: grouped[activeTab] }];
    }
    return preferredAudiences.map((audience) => ({
      audience,
      items: grouped[audience],
    }));
  }, [activeTab, grouped, preferredAudiences]);

  const handleSelect = (template: CareSuiteTemplate) => {
    onChange(template.id, template.content, template.description ?? undefined);
    setOpen(false);
  };

  const tabLabel = (audience: ComposeTemplateAudience) => {
    const base = COMPOSE_TEMPLATE_AUDIENCES.find((a) => a.key === audience)?.label ?? audience;
    return `${base} (${grouped[audience].length})`;
  };

  const renderOption = (template: CareSuiteTemplate) => {
    const selected = template.id === value;
    const categoryTag = template.tags[1];
    return (
      <Pressable
        key={template.id}
        onPress={() => handleSelect(template)}
        style={({ pressed }) => [
          baseStyles.option,
          selected ? baseStyles.optionSelected : null,
          pressed ? baseStyles.optionPressed : null,
        ]}
        accessibilityRole="menuitem"
        accessibilityState={{ selected }}
      >
        <Text style={[baseStyles.optionLabel, selected ? baseStyles.optionLabelSelected : null]}>
          {template.title}
        </Text>
        {categoryTag ? <Text style={styles.categoryMeta}>{categoryTag}</Text> : null}
      </Pressable>
    );
  };

  if (loadError) {
    return (
      <View style={[baseStyles.wrap, style]}>
        <Text style={baseStyles.label}>{label}</Text>
        <Text style={styles.hint}>Keine Vorlagen verfügbar.</Text>
      </View>
    );
  }

  return (
    <View style={[baseStyles.wrap, style]}>
      <Text style={baseStyles.label}>{label}</Text>

      <View style={styles.tabs}>
        {recipientType === 'internal' || recipientType === 'office' ? (
          <Pressable
            onPress={() => setActiveTab('all')}
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              Intern & Team
            </Text>
          </Pressable>
        ) : null}
        {(activeTab === 'all' ? preferredAudiences : COMPOSE_TEMPLATE_AUDIENCES.map((a) => a.key)).map(
          (item) => {
            const active = activeTab === item;
            return (
              <Pressable
                key={item}
                onPress={() => setActiveTab(item)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tabLabel(item)}</Text>
              </Pressable>
            );
          },
        )}
      </View>

      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [baseStyles.trigger, pressed ? baseStyles.triggerPressed : null]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}: ${selectedLabel}`}
      >
        <Text style={baseStyles.triggerText} numberOfLines={1}>
          {loading && !value ? 'Vorlagen werden geladen…' : selectedLabel}
        </Text>
        <Text style={baseStyles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={baseStyles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.pickerSheet} onPress={(event) => event.stopPropagation()}>
            <Text style={baseStyles.modalTitle}>{label}</Text>
            <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
              {visibleSections.map((section) => {
                const sectionLabel = tabLabel(section.audience);
                return (
                  <View key={section.audience}>
                    {activeTab === 'all' || visibleSections.length > 1 ? (
                      <Text style={styles.sectionHeader}>{sectionLabel}</Text>
                    ) : null}
                    {section.items.length === 0 ? (
                      <Text style={styles.emptySection}>Keine Vorlagen in dieser Kategorie.</Text>
                    ) : (
                      section.items.map(renderOption)
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} style={baseStyles.modalClose}>
              <Text style={baseStyles.modalCloseText}>Schließen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
