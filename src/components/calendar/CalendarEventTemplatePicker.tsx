import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CalendarEventTemplate, CalendarModuleKey } from '@/types/calendar';
import { SYSTEM_CALENDAR_TEMPLATES } from '@/data/calendar/defaultTemplates';
import { auroraGlass, useActiveGlassTokens, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useInteractiveTextColor } from '@/design/tokens/carelightadaptive';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { LoadingState, PremiumButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { listTemplates, seedSystemCalendarTemplates } from '@/lib/calendar/calendarTemplateService';

type CalendarEventTemplatePickerProps = {
  moduleKey: CalendarModuleKey;
  selectedId?: string | null;
  onSelect: (template: CalendarEventTemplate) => void;
  onContinueWithoutTemplate?: () => void;
  accentColor?: string;
};

const MODULE_LABELS: Partial<Record<CalendarModuleKey, string>> = {
  office: 'Office',
  assist: 'Assist',
  pflege: 'Pflege',
  stationaer: 'Stationär',
  beratung: 'Beratung',
  akademie: 'Akademie',
};

export function CalendarEventTemplatePicker({
  moduleKey,
  selectedId,
  onSelect,
  onContinueWithoutTemplate,
  accentColor = '#62F3FF',
}: CalendarEventTemplatePickerProps) {
  const text = useAuroraAdaptiveText();
  const glass = useActiveGlassTokens();
  const activeLabelColor = useInteractiveTextColor(accentColor);
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [templates, setTemplates] = useState<CalendarEventTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<CalendarModuleKey | 'all'>(
    moduleKey === 'all' ? 'all' : moduleKey,
  );
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    const result = await listTemplates(moduleKey, tenantId, profile?.roleKey);
    if (result.ok) {
      setTemplates(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadTemplates();
  }, [moduleKey, tenantId, profile?.roleKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (moduleFilter !== 'all' && t.moduleKey !== moduleFilter) return false;
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q)
        || (t.description?.toLowerCase().includes(q) ?? false)
        || t.templateKey.toLowerCase().includes(q)
      );
    });
  }, [templates, search, moduleFilter]);

  const systemTemplates = filtered.filter((t) => t.isSystem);
  const tenantTemplates = filtered.filter((t) => !t.isSystem);

  const availableModules = useMemo(() => {
    const keys = new Set(templates.map((t) => t.moduleKey));
    return Array.from(keys) as CalendarModuleKey[];
  }, [templates]);

  const handleSeed = async () => {
    if (!tenantId) return;
    setSeeding(true);
    const result = await seedSystemCalendarTemplates(tenantId);
    setSeeding(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await loadTemplates();
  };

  if (loading) return <LoadingState message="Vorlagen werden geladen…" />;

  return (
    <View style={styles.wrap}>
      <TextInput
        style={[styles.search, { color: text.primary, borderColor: auroraGlass.border }]}
        value={search}
        onChangeText={setSearch}
        placeholder="Vorlage suchen…"
        placeholderTextColor={text.muted}
      />

      {moduleKey === 'all' && availableModules.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <Pressable
            onPress={() => setModuleFilter('all')}
            style={[
              styles.filterChip,
              moduleFilter === 'all' && { borderColor: accentColor, backgroundColor: glass.chipActive },
            ]}
          >
            <Text style={{ color: moduleFilter === 'all' ? activeLabelColor : text.primary, fontSize: 12, fontWeight: '700' }}>
              Alle
            </Text>
          </Pressable>
          {availableModules.map((key) => (
            <Pressable
              key={key}
              onPress={() => setModuleFilter(key)}
              style={[
                styles.filterChip,
                moduleFilter === key && { borderColor: accentColor, backgroundColor: glass.chipActive },
              ]}
            >
              <Text style={{ color: moduleFilter === key ? activeLabelColor : text.primary, fontSize: 12, fontWeight: '700' }}>
                {MODULE_LABELS[key] ?? key}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: text.primary }]}>Keine Vorlagen gefunden</Text>
          <Text style={[styles.emptyMessage, { color: text.muted }]}>
            {templates.length === 0
              ? 'Es sind noch keine Kalender-Vorlagen vorhanden. Sie können Standardvorlagen anlegen oder ohne Vorlage fortfahren.'
              : 'Keine Vorlage passt zu Ihrer Suche. Passen Sie den Filter an oder fahren Sie ohne Vorlage fort.'}
          </Text>
          <View style={styles.emptyActions}>
            {templates.length === 0 ? (
              <PremiumButton
                title={seeding ? 'Wird erstellt…' : 'Standardvorlagen erstellen'}
                onPress={handleSeed}
                disabled={seeding || !tenantId}
              />
            ) : null}
            {onContinueWithoutTemplate ? (
              <PremiumButton
                title="Ohne Vorlage fortfahren"
                variant="secondary"
                onPress={onContinueWithoutTemplate}
              />
            ) : null}
          </View>
        </View>
      ) : (
        <>
          {systemTemplates.length > 0 ? (
            <>
              <Text style={[styles.category, { color: text.muted }]}>Systemvorlagen</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
                {systemTemplates.map((template) => renderChip(template))}
              </ScrollView>
            </>
          ) : null}
          {tenantTemplates.length > 0 ? (
            <>
              <Text style={[styles.category, { color: text.muted }]}>Mandantenvorlagen</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
                {tenantTemplates.map((template) => renderChip(template))}
              </ScrollView>
            </>
          ) : null}
          {onContinueWithoutTemplate ? (
            <PremiumButton
              title="Ohne Vorlage fortfahren"
              variant="ghost"
              onPress={onContinueWithoutTemplate}
            />
          ) : null}
        </>
      )}
    </View>
  );

  function renderChip(template: CalendarEventTemplate) {
    const active = selectedId === template.id;
    return (
      <Pressable
        key={template.id}
        onPress={() => onSelect(template)}
        style={[
          styles.chip,
          active && { borderColor: accentColor, backgroundColor: glass.chipActive },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.label, { color: active ? activeLabelColor : text.primary }]}>
          {template.label}
        </Text>
        {template.description ? (
          <Text style={[styles.desc, { color: text.muted }]} numberOfLines={2}>
            {template.description}
          </Text>
        ) : null}
        <Text style={[styles.meta, { color: text.muted }]}>
          {MODULE_LABELS[template.moduleKey] ?? template.moduleKey}
          {template.isSystem ? ' · System' : ''}
        </Text>
      </Pressable>
    );
  }
}

/** Fallback count for tests — all system templates from defaultTemplates.ts */
export function getDefaultTemplateCount(): number {
  return SYSTEM_CALENDAR_TEMPLATES.length;
}

const styles = StyleSheet.create({
  wrap: { gap: careSpacing.sm },
  search: {
    fontSize: 14,
    borderWidth: 1,
    borderRadius: careRadius.md,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    backgroundColor: auroraGlass.input,
  },
  filterRow: { marginBottom: careSpacing.xs },
  filterChip: {
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 6,
    marginRight: careSpacing.xs,
    borderRadius: careRadius.full,
    borderWidth: 1,
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.chip,
  },
  category: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: careSpacing.xs,
  },
  scroll: { marginBottom: careSpacing.sm },
  chip: {
    width: 150,
    padding: careSpacing.sm,
    marginRight: careSpacing.sm,
    borderRadius: careRadius.md,
    borderWidth: 1,
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.chip,
  },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  desc: { fontSize: 11, lineHeight: 15 },
  meta: { fontSize: 10, marginTop: 4 },
  empty: {
    padding: careSpacing.lg,
    borderRadius: careRadius.md,
    borderWidth: 1,
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.card,
    gap: careSpacing.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyMessage: { fontSize: 13, lineHeight: 18 },
  emptyActions: { gap: careSpacing.sm, marginTop: careSpacing.sm },
  error: { color: '#F87171', fontSize: 13 },
});
