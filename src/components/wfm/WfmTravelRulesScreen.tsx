import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { listWfmTravelRules, saveWfmTravelRule, type WfmTravelRule } from '@/lib/wfm';
import { careSpacing } from '@/design/tokens/spacing';
import { typography } from '@/theme';

const initial = { name: '', minGap: '0', maxGap: '180', roundTo: '5', mileage: '0', priority: '100', notes: '', paid: true };

export function WfmTravelRulesScreen() {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useAsyncQuery(useCallback(async () => tenantId ? listWfmTravelRules(tenantId) : { ok: true as const, data: [] }, [tenantId]), [tenantId]);

  const edit = (rule: WfmTravelRule) => {
    setEditingId(rule.id);
    setForm({ name: rule.name, minGap: String(rule.minGapMinutes), maxGap: rule.maxGapMinutes == null ? '' : String(rule.maxGapMinutes), roundTo: String(rule.roundToMinutes), mileage: (rule.mileageRateCents / 100).toFixed(2).replace('.', ','), priority: String(rule.priority), notes: rule.notes, paid: rule.countsAsWorkTime });
  };

  const persist = async (override?: WfmTravelRule) => {
    if (!tenantId) return;
    const name = override?.name ?? form.name.trim();
    if (!name) { setError('Name der Fahrzeitregel ist erforderlich.'); return; }
    setSaving(true); setError(null);
    const result = await saveWfmTravelRule(override ? {
      ...override, id: override.id, tenantId, actorId: user?.id ?? profile?.id,
    } : {
      id: editingId ?? undefined, tenantId, name,
      minGapMinutes: Math.max(0, Number(form.minGap) || 0),
      maxGapMinutes: form.maxGap.trim() ? Math.max(0, Number(form.maxGap)) : null,
      countsAsWorkTime: form.paid,
      roundToMinutes: [1, 5, 10, 15, 30].includes(Number(form.roundTo)) ? Number(form.roundTo) : 5,
      mileageRateCents: Math.max(0, Math.round(Number(form.mileage.replace(',', '.')) * 100) || 0),
      priority: Number(form.priority) || 100, isActive: true, notes: form.notes,
      actorId: user?.id ?? profile?.id,
    });
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setEditingId(null); setForm(initial); await query.refresh();
  };

  if (!can('time.settings.manage')) {
    return (
      <ScreenShell title="Fahrzeitregeln" subtitle={roleLabel ?? 'Arbeitszeit'} showBack={false}>
        <LockedActionBanner message={check('time.settings.manage').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Fahrzeitregeln" subtitle="Fahrzeit- und Wegezeitlogik" showBack={false} scroll>
      <SectionPanel title={editingId ? 'Fahrzeitregel bearbeiten' : 'Neue Fahrzeitregel'}>
        <Field label="Bezeichnung" value={form.name} onChange={(name) => setForm((v) => ({ ...v, name }))} placeholder="z. B. Wegezeit zwischen Einsätzen" />
        <View style={styles.grid}>
          <Field label="Mindestlücke (Min.)" value={form.minGap} onChange={(minGap) => setForm((v) => ({ ...v, minGap }))} />
          <Field label="Maximallücke (Min.)" value={form.maxGap} onChange={(maxGap) => setForm((v) => ({ ...v, maxGap }))} />
          <Field label="Rundung (1/5/10/15/30)" value={form.roundTo} onChange={(roundTo) => setForm((v) => ({ ...v, roundTo }))} />
          <Field label="Kilometerpauschale (€)" value={form.mileage} onChange={(mileage) => setForm((v) => ({ ...v, mileage }))} />
        </View>
        <Field label="Hinweise" value={form.notes} onChange={(notes) => setForm((v) => ({ ...v, notes }))} placeholder="Interne Erläuterung" />
        <View style={styles.actions}>
          <PremiumButton title={form.paid ? '✓ Als Arbeitszeit' : 'Nicht als Arbeitszeit'} variant="secondary" onPress={() => setForm((v) => ({ ...v, paid: !v.paid }))} />
          <PremiumButton title={editingId ? 'Änderungen speichern' : 'Regel anlegen'} onPress={() => void persist()} loading={saving} />
          {editingId ? <PremiumButton title="Abbrechen" variant="secondary" onPress={() => { setEditingId(null); setForm(initial); }} /> : null}
        </View>
      </SectionPanel>

      <SectionPanel title="Aktive und archivierte Regeln">
        {query.loading ? <LoadingState message="Fahrzeitregeln werden geladen…" /> : null}
        {query.error ? <ErrorState title="Fahrzeitregeln nicht verfügbar" message={query.error} onRetry={() => void query.refresh()} /> : null}
        {!query.loading && !query.error && (query.data ?? []).length === 0 ? <EmptyState title="Keine Fahrzeitregeln" message="Legen Sie die erste Regel an." /> : null}
        {(query.data ?? []).map((rule) => (
          <View key={rule.id} style={styles.row}>
            <View style={styles.rowMain}>
              <View style={styles.rowHeading}><Text style={styles.title}>{rule.name}</Text><PremiumBadge label={rule.isActive ? 'Aktiv' : 'Inaktiv'} variant={rule.isActive ? 'cyan' : 'muted'} /></View>
              <Text style={styles.caption}>{rule.minGapMinutes}–{rule.maxGapMinutes ?? '∞'} Min. · Rundung {rule.roundToMinutes} Min. · {(rule.mileageRateCents / 100).toFixed(2).replace('.', ',')} €/km · {rule.countsAsWorkTime ? 'Arbeitszeit' : 'keine Arbeitszeit'}</Text>
            </View>
            <View style={styles.actions}><PremiumButton title="Bearbeiten" variant="secondary" onPress={() => edit(rule)} /><PremiumButton title={rule.isActive ? 'Deaktivieren' : 'Aktivieren'} variant="secondary" onPress={() => void persist({ ...rule, isActive: !rule.isActive })} /></View>
          </View>
        ))}
      </SectionPanel>
      {error ? <ErrorState title="Speichern nicht möglich" message={error} onRetry={() => setError(null)} /> : null}
    </ScreenShell>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} /></View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm }, field: { flex: 1, minWidth: 190, gap: 4 }, label: { ...typography.caption }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10, backgroundColor: '#fff' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm }, row: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: careSpacing.md, gap: careSpacing.sm }, rowMain: { flex: 1, gap: 4 }, rowHeading: { flexDirection: 'row', alignItems: 'center', gap: careSpacing.sm }, title: { ...typography.bodyStrong }, caption: { ...typography.caption },
});
