import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { medicationPlanOriginalFields, medicationPlanPositionTitle } from '@/lib/pflege/medicationPlanImportDomain';
import {
  getMedicationPlanImport, listMedicationPlanImports, type MedicationPlanImportScope,
  type StoredMedicationPlan, type StoredMedicationPlanListItem,
} from '@/lib/pflege/medicationPlanImportService';

export function ClientMedicationPlanArchive({ scope, clientId }: { scope: MedicationPlanImportScope; clientId: string }) {
  const [rows, setRows] = useState<StoredMedicationPlanListItem[]>([]), [open, setOpen] = useState<StoredMedicationPlan | null>(null);
  const [position, setPosition] = useState<number | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const live = useRef({ scope, clientId }), ticket = useRef(0), alive = useRef(false);
  live.current = { scope, clientId };
  const { tenantId, actorId } = scope;
  const request = useCallback(async (planId?: string) => {
    const attempt = ++ticket.current;
    const current = () => alive.current && ticket.current === attempt && live.current.clientId === clientId
      && live.current.scope.tenantId === tenantId && live.current.scope.actorId === actorId && live.current.scope.isCurrent();
    if (!current()) return;
    setLoading(true); setError(''); setOpen(null); setPosition(null);
    try {
      const readScope = { tenantId, actorId, isCurrent: current };
      if (planId) {
        const plan = await getMedicationPlanImport(readScope, planId, clientId);
        if (current()) setOpen(plan);
      } else {
        setRows([]);
        const items = await listMedicationPlanImports(readScope, clientId);
        if (current()) setRows(items);
      }
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : 'Medikationsplan-Entwürfe konnten nicht geladen werden.');
    } finally { if (current()) setLoading(false); }
  }, [tenantId, actorId, clientId]);

  useEffect(() => {
    alive.current = true; void request();
    return () => { alive.current = false; ticket.current++; };
  }, [request]);

  if (!scope.isCurrent()) return null;
  return <SectionPanel title="Medikationsplan-Entwürfe">
    <View style={styles.stack}>
      <Text style={styles.body}>Aus eingelesenen Originalplänen. Die bestätigten Positionen bleiben hier als Entwurf dokumentiert.</Text>
      {loading ? <Text accessibilityLiveRegion="polite" style={styles.body}>Medikationspläne werden geladen…</Text> : null}
      {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><PremiumButton title="Erneut laden" variant="secondary" onPress={() => { void request(); }} /></> : null}
      {!loading && !error && !rows.length ? <Text style={styles.body}>Für diese Akte ist noch kein Medikationsplan-Entwurf gespeichert.</Text> : null}
      {!open && !loading && !error ? rows.map(item => <View key={item.id} style={styles.entry}>
        <Text style={styles.strong}>{item.fileName}</Text>
        <Text style={styles.body}>{new Date(item.createdAt).toLocaleDateString('de-DE')} · {item.confirmedCount} von {item.positionCount} bestätigt</Text>
        <PremiumButton title="Entwurf ansehen" variant="secondary" onPress={() => { void request(item.id); }} />
      </View>) : null}
      {open ? <View style={styles.stack}>
        <Text style={styles.strong}>{open.fileName}</Text>
        <Text style={styles.body}>{open.confirmed.length} von {open.plan.rows.length} bestätigt · Ausdruck von {open.plan.issuer.name}</Text>
        <PremiumButton title="Zur Planübersicht" variant="secondary" onPress={() => { if (scope.isCurrent()) { setOpen(null); setPosition(null); } }} />
        {open.plan.rows.map((row, index) => <View key={index} style={styles.entry}>
          <Text style={styles.strong}>{index + 1}. {medicationPlanPositionTitle(row)}</Text>
          <Text style={styles.body}>{open.confirmed.some(item => item.rowIndex === index) ? 'Einzeln bestätigt' : 'Prüfung offen'}</Text>
          <PremiumButton title={position === index ? 'Angaben ausblenden' : 'Originalangaben anzeigen'} variant="ghost"
            onPress={() => { if (scope.isCurrent()) setPosition(position === index ? null : index); }} />
          {position === index ? medicationPlanOriginalFields(row).map(field => <View key={field.label} style={styles.field}>
            <Text style={styles.strong}>{field.label}</Text><Text selectable style={styles.body}>{field.value}</Text>
          </View>) : null}
        </View>)}
      </View> : null}
    </View>
  </SectionPanel>;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm }, entry: { gap: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  field: { gap: spacing.xs }, strong: { ...typography.bodyStrong }, body: { ...typography.body, color: colors.textMuted },
  error: { ...typography.body, color: colors.error },
});
