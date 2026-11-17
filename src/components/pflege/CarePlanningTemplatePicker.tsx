import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { ErrorState, FilterChipGroup, InfoBanner, PremiumButton, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import {
  carePlanningModels, planningDomains, planningGroups,
  type CarePlanningDomain, type CarePlanningModel, type CarePlanningSetting,
} from '@/lib/pflege/carePlanningModels';
import {
  carePlanningStarterTemplates, personalizePlanningText, planningTemplateKinds, searchPlanningTemplates,
  type CarePlanningTemplate, type PlanningTemplateKind,
} from '@/lib/pflege/carePlanningTemplates';
import { fetchOwnPlanningTemplates, saveOwnPlanningTemplate } from '@/lib/pflege/carePlanningTemplateService';
import { colors, radius, spacing, typography } from '@/theme';

export type PlanningTemplateTarget = {
  label: string;
  kinds: readonly PlanningTemplateKind[];
  onInsert: (template: CarePlanningTemplate) => void;
};

export function CarePlanningTemplatePicker({ target, model, setting, tenantId, role, actorId, clientName, canEditLibrary, effectivePermissions, onClose }: {
  target: PlanningTemplateTarget;
  model: CarePlanningModel;
  setting: CarePlanningSetting;
  tenantId: string;
  role: RoleKey | null | undefined;
  actorId?: string;
  clientName: string;
  canEditLibrary: boolean;
  effectivePermissions?: readonly PermissionKey[];
  onClose: () => void;
}) {
  const scope = { tenantId, role, setting, permission: { effectivePermissions } };
  const templates = useAsyncQuery(() => fetchOwnPlanningTemplates(scope, model),
    [tenantId, actorId, role, setting, model, effectivePermissions], { enabled: !!tenantId && !!actorId, retryCount: 0,
      queryKey: `pflegebausteine:${tenantId}:${actorId}:${role}` });
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [kind, setKind] = useState('all');
  const [shown, setShown] = useState(20);
  const [insertions, setInsertions] = useState(0);
  const [editing, setEditing] = useState<CarePlanningTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const groups = planningGroups[model];
  const selectedDomains = groups.find(candidate => candidate.label === group)?.domains as readonly CarePlanningDomain[] | undefined;
  const library = templates.error || templates.refreshError ? [] : templates.data ?? [];
  const results = useMemo(() => searchPlanningTemplates([...library, ...carePlanningStarterTemplates], {
    model, setting, kinds: target.kinds.filter(candidate => kind === 'all' || candidate === kind), query: search,
  }).filter(item => !selectedDomains || selectedDomains.includes(item.domain)),
  [kind, library, model, search, selectedDomains, setting, target.kinds]);

  function newTemplate() {
    const firstKind = target.kinds.find(item => item === kind) ?? target.kinds[0];
    setError('');
    setEditing({ id: Crypto.randomUUID(), model, setting, kind: firstKind,
      domain: selectedDomains?.[0] ?? 'communication', title: '', text: '' });
  }

  async function saveTemplate() {
    if (!editing || saving || !canEditLibrary) return;
    setSaving(true);
    setError('');
    try {
      const result = await saveOwnPlanningTemplate(scope, editing);
      if (!result.ok) setError(result.error);
      else {
        setEditing(null);
        await templates.refresh();
      }
    } catch {
      setError('Die Vorlage konnte nicht bestätigt werden. Bitte den Katalog neu laden.');
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (!saving) onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.title}>{target.label}</Text>
              <Text style={styles.caption}>{carePlanningModels.find(item => item.key === model)?.label} · {setting === 'ambulant' ? 'Ambulante Pflege' : 'Stationäre Pflege'}</Text>
            </View>
            <PremiumButton title="Schließen" size="sm" variant="secondary" disabled={saving} onPress={close} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {editing ? (
              <>
                <Text style={styles.title}>{editing.updatedAt ? 'Eigene Vorlage bearbeiten' : 'Eigene Vorlage anlegen'}</Text>
                <Text style={styles.caption}>{'Für wiederverwendbare Texte kann {{person}} als Platz für den Namen stehen.'}</Text>
                <FilterChipGroup wrap options={target.kinds.map(key => ({ key, label: planningTemplateKinds[key] }))}
                  value={editing.kind} onChange={saving ? undefined : next => setEditing({ ...editing, kind: next })} />
                <FilterChipGroup wrap options={Object.entries(planningDomains).map(([key, label]) => ({ key, label }))}
                  value={editing.domain} onChange={saving ? undefined : next => {
                    if (Object.hasOwn(planningDomains, next)) setEditing({ ...editing, domain: next as CarePlanningDomain });
                  }} />
                <PremiumInput label="Bezeichnung der Vorlage" value={editing.title} onChangeText={title => setEditing({ ...editing, title })} maxLength={160} editable={!saving} />
                <PremiumInput label="Wiederverwendbarer Text" value={editing.text} onChangeText={text => setEditing({ ...editing, text })} maxLength={4000} editable={!saving} multiline />
                {error ? <ErrorState presentation="inline" message={error} /> : null}
                <View style={styles.controls}>
                  <PremiumButton title="Vorlage speichern" disabled={saving || !editing.title.trim() || !editing.text.trim()} loading={saving} onPress={saveTemplate} />
                  <PremiumButton title="Zur Auswahl" variant="secondary" disabled={saving} onPress={() => setEditing(null)} />
                </View>
              </>
            ) : (
              <>
                <PremiumInput label="Textbausteine durchsuchen" value={search} onChangeText={value => { setSearch(value); setShown(20); }} />
                <FilterChipGroup wrap options={[{ key: 'all', label: 'Alle Bereiche' }, ...groups.map(item => ({ key: item.label, label: item.label }))]}
                  value={group} onChange={next => { setGroup(next); setShown(20); }} />
                {target.kinds.length > 1 ? <FilterChipGroup wrap options={[
                  { key: 'all', label: 'Alle Textarten' }, ...target.kinds.map(key => ({ key, label: planningTemplateKinds[key] })),
                ]} value={kind} onChange={next => { setKind(next); setShown(20); }} /> : null}
                <Text style={styles.caption} accessibilityLiveRegion="polite">{results.length} Vorschläge{insertions ? ` · ${insertions} übernommen` : ''}</Text>
                {templates.error || templates.refreshError ? <InfoBanner presentation="inline" variant="warning"
                  title="Eigene Vorlagen sind derzeit nicht erreichbar" message="Die redaktionellen Formulierungsvorschläge stehen zur Auswahl." /> : null}
                {canEditLibrary ? <PremiumButton title="Eigene Vorlage anlegen" size="sm" variant="secondary" onPress={newTemplate} /> : null}
                {results.slice(0, shown).map(item => (
                  <View key={item.id} style={styles.option}>
                    <Text style={styles.optionTitle}>{item.title}</Text>
                    <Text style={styles.body}>{personalizePlanningText(item.text, clientName)}</Text>
                    <View style={styles.controls}>
                      <PremiumButton title="Übernehmen" accessibilityLabel={`${item.title} übernehmen`} variant="secondary" size="sm" onPress={() => {
                        target.onInsert(item);
                        setInsertions(count => count + 1);
                      }} />
                      {item.updatedAt && canEditLibrary ? <PremiumButton title="Bearbeiten" variant="ghost" size="sm" onPress={() => { setError(''); setEditing(item); }} /> : null}
                    </View>
                  </View>
                ))}
                {shown < results.length ? <PremiumButton title="Weitere Textbausteine" variant="secondary" onPress={() => setShown(count => count + 20)} /> : null}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,32,55,0.55)' },
  sheet: { width: '100%', maxWidth: 880, maxHeight: '94%', minHeight: '65%', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#F6FAFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.md, backgroundColor: '#E3F0FD' },
  heading: { flex: 1, gap: spacing.xs },
  title: { ...typography.h3, color: '#123453' },
  content: { padding: spacing.md, gap: spacing.sm },
  option: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  optionTitle: { ...typography.label, fontWeight: '700', color: '#123453' },
  caption: { ...typography.caption, color: '#45647F' },
  body: { ...typography.body, color: '#16354F' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
});
