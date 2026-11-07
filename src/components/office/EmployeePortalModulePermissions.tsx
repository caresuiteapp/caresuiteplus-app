import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import {
  employeePortalPersonalProducts, employeePortalWorkspaceLabels,
  employeePortalWorkspaceReleased, employeePortalWorkspaces, type EmployeePortalWorkspace,
} from '@/lib/portal/employee/employeePortalWorkspaces';
import {
  loadEmployeePortalWorkspaceGrants, saveEmployeePortalWorkspaceGrants,
  type EmployeePortalWorkspaceGrants,
} from '@/lib/portal/employee/employeePortalWorkspaceService';

export function EmployeePortalModulePermissions({ tenantId, employeeId, canEdit }: {
  tenantId: string; employeeId: string; canEdit: boolean;
}) {
  const { c } = useCareLightPalette();
  const { hasGate } = useModuleAccess();
  const grants = useAsyncQuery(() => loadEmployeePortalWorkspaceGrants(tenantId, employeeId), [tenantId, employeeId], {
    queryKey: JSON.stringify([tenantId, employeeId, 'employee-portal-modules']),
  });
  const [draft, setDraft] = useState<{ products: string[]; base: EmployeePortalWorkspaceGrants } | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const pending = useRef(false);
  const original = grants.data;
  if (!original) return grants.error
    ? <ErrorState presentation="inline" message={grants.error} onRetry={grants.refresh} />
    : <LoadingState message="Persönliche Modulfreigaben werden geladen…" />;

  const effective = draft?.products ?? employeePortalPersonalProducts(original.products);
  const isAvailable = (key: EmployeePortalWorkspace) => employeePortalWorkspaceReleased(key) && hasGate(key);
  const editable = canEdit && !saving && !grants.loading;
  const selectedCount = employeePortalWorkspaces.filter(key => effective.includes(key)).length;
  const initial = employeePortalPersonalProducts(original.products);
  const changed = initial.length !== effective.length || initial.some(key => !effective.includes(key));

  const toggle = (key: EmployeePortalWorkspace) => {
    if (!editable) return;
    const included = effective.includes(key);
    if (!included && !isAvailable(key)) return;
    setFeedback(null);
    setDraft({
      products: included ? effective.filter(product => product !== key) : [...effective, key],
      base: draft?.base ?? original,
    });
  };

  async function save() {
    if (!editable || pending.current || !changed || !selectedCount || !draft) return;
    pending.current = true;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await saveEmployeePortalWorkspaceGrants(tenantId, employeeId, draft.products, draft.base);
      if (!result.ok) {
        setDraft(null);
        setFeedback({ error: true, message: result.error });
        await grants.refresh();
        return;
      }
      setDraft(null);
      setFeedback({ error: false, message: 'Modulfreigaben gespeichert.' });
      await grants.refresh();
    } catch {
      setFeedback({ error: true, message: 'Die Änderung konnte nicht bestätigt werden. Laden Sie die Freigaben erneut.' });
      await grants.refresh();
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={styles.root} testID="employee-portal-module-permissions">
      <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>Arbeitsmodule im Mitarbeitendenportal</Text>
      <Text style={{ color: c.muted }}>Die Person kann zwischen ihren freigegebenen Modulen wählen, sobald diese im Unternehmen und auf dem Gerät verfügbar sind.</Text>
      <View style={styles.options}>
        {employeePortalWorkspaces.map(key => {
          const selected = effective.includes(key);
          const available = isAvailable(key);
          const disabled = !editable || (!selected && !available);
          return (
            <Pressable key={key} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }}
              disabled={disabled} onPress={() => toggle(key)}
              style={[styles.option, { borderColor: selected ? '#1765B9' : c.muted }, disabled && styles.disabled]}>
              <Text style={{ color: c.text }}>{selected ? '✓ ' : ''}{employeePortalWorkspaceLabels[key]}{available ? '' : ' · derzeit gesperrt'}</Text>
            </Pressable>
          );
        })}
      </View>
      {canEdit && !selectedCount ? <Text style={{ color: c.muted }}>Wählen Sie mindestens ein Arbeitsmodul. Für persönliche Funktionen können Sie Office auswählen. Den Portalzugang verwalten Sie unter Systemrolle.</Text> : null}
      {feedback ? <Text accessibilityRole={feedback.error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={{ color: c.text }}>{feedback.message}</Text> : null}
      {grants.refreshError ? <ErrorState presentation="inline" message={grants.refreshError} onRetry={grants.refresh} /> : null}
      {canEdit ? <PremiumButton title="Modulfreigaben speichern" disabled={!changed || !selectedCount || !editable} loading={saving} onPress={() => void save()} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingVertical: 16 },
  title: { fontSize: 17, fontWeight: '700' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
  disabled: { opacity: 0.66 },
});
