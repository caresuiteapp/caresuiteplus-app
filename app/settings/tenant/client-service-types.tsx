import { StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { listTenantClientServiceTypes, updateTenantClientServiceType } from '@/lib/client/clientServiceTypeService';
import {
  listTenantServiceTypeBillingRules,
  updateTenantServiceTypeBillingRule,
} from '@/lib/billing/clientBillingCandidateService';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { useState } from 'react';
import { colors, spacing, typography } from '@/theme';

/** Mandanten-Leistungsarten — Core K.4 list/edit active types. */
export default function TenantClientServiceTypesScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { isReadOnly } = usePermissions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRate, setEditRate] = useState('');
  const [saving, setSaving] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTenantClientServiceTypes(tenantId);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const billingRulesQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTenantServiceTypeBillingRules(tenantId);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const types = query.data ?? [];
  const billingRules = billingRulesQuery.data ?? [];

  async function handleSave(typeId: string) {
    if (!tenantId || isReadOnly || !editName.trim()) return;
    setSaving(true);
    const result = await updateTenantClientServiceType(tenantId, typeId, { name: editName.trim() });
    setSaving(false);
    if (result.ok) {
      setEditingId(null);
      await query.refresh();
    }
  }

  async function handleSaveBillingRule(serviceTypeId: string) {
    if (!tenantId || isReadOnly) return;
    setSaving(true);
    const parsed = editRate.trim() ? Number(editRate.replace(',', '.')) : null;
    const result = await updateTenantServiceTypeBillingRule(tenantId, serviceTypeId, {
      defaultRateAmount: parsed != null && Number.isFinite(parsed) ? parsed : null,
    });
    setSaving(false);
    if (result.ok) await billingRulesQuery.refresh();
  }

  return (
    <ScreenShell
      title="Klient:innen-Leistungsarten"
      subtitle="Mandanten-Vorlagen für Leistungsbereiche"
      rightSlot={<PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />}
    >
      {query.loading && !query.data ? <LoadingState message="Leistungsarten werden geladen…" /> : null}
      {query.error ? <ErrorState message={query.error} onRetry={query.refresh} /> : null}

      {types.length === 0 && !query.loading ? (
        <EmptyState
          title="Leistungsarten-Vorlagen"
          message="Beim ersten Zugriff werden 6 Systemvorlagen angelegt."
        />
      ) : (
        <View style={styles.list}>
          {types.map((type) => (
            <PremiumCard key={type.id} style={styles.card}>
              {editingId === type.id ? (
                <>
                  <PremiumInput label="Name" value={editName} onChangeText={setEditName} />
                  <PremiumButton title="Speichern" loading={saving} onPress={() => handleSave(type.id)} />
                  <PremiumButton title="Abbrechen" variant="secondary" onPress={() => setEditingId(null)} />
                </>
              ) : (
                <>
                  <Text style={styles.primary}>{type.name}</Text>
                  <Text style={styles.secondary}>{type.description ?? type.serviceTypeKey}</Text>
                  {!isReadOnly ? (
                    <PremiumButton
                      title="Bearbeiten"
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        setEditingId(type.id);
                        setEditName(type.name);
                      }}
                    />
                  ) : null}
                </>
              )}
            </PremiumCard>
          ))}
        </View>
      )}

      <SectionPanel title="Abrechnungsregeln je Leistungsart (K.5)">
        <Text style={styles.secondary}>
          Stundensätze und Pflichten — mandantenfähig, keine harte Code-Wahrheit. Fehlende Rate erzeugt Warnung in der
          Abrechnungsvorschau.
        </Text>
        {billingRules.length === 0 && !billingRulesQuery.loading ? (
          <EmptyState
            title="Keine Abrechnungsregeln"
            message="Regeln werden mit Migration 0160 oder seed_tenant_billing_handoff_defaults angelegt."
          />
        ) : (
          billingRules.map((rule) => {
            const type = types.find((t) => t.id === rule.serviceTypeId);
            return (
              <PremiumCard key={rule.id} style={styles.card}>
                <Text style={styles.primary}>{type?.name ?? rule.serviceTypeId}</Text>
                <Text style={styles.secondary}>
                  Rate: {rule.defaultRateAmount != null ? `${rule.defaultRateAmount} €/${rule.defaultUnit}` : '—'}
                  {' · '}
                  Signatur: {rule.requireSignature ? 'ja' : 'nein'}
                  {' · '}
                  Freigabe: {rule.requireApproval ? 'ja' : 'nein'}
                </Text>
                {!isReadOnly ? (
                  <View style={styles.rateRow}>
                    <PremiumInput
                      label="Stundensatz (€)"
                      value={editRate}
                      onChangeText={setEditRate}
                      placeholder={rule.defaultRateAmount?.toString() ?? ''}
                    />
                    <PremiumButton
                      title="Rate speichern"
                      size="sm"
                      loading={saving}
                      onPress={() => {
                        setEditRate(editRate || String(rule.defaultRateAmount ?? ''));
                        void handleSaveBillingRule(rule.serviceTypeId);
                      }}
                    />
                  </View>
                ) : null}
              </PremiumCard>
            );
          })
        )}
      </SectionPanel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { marginBottom: spacing.sm },
  primary: { ...typography.label },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  rateRow: { marginTop: spacing.sm, gap: spacing.sm },
});
