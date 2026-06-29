import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import {
  FilterChipGroup,
  InfoBanner,
  PremiumButton,
  PremiumCard,
  PremiumInput,
} from '@/components/ui';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  applyBudgetRecalculation,
  bookBudgetCorrection,
  changeClientCareGrade,
  computeBudgetRecalculationDiffs,
  deactivateClientBudgetAccount,
  previewBudgetRecalculationFromCatalog,
  setClientConversionEnabled,
  updateCareEntitlementValidFrom,
  updateClientCareFund,
  type BudgetRecalcDiff,
} from '@/lib/assist/clientCareGradeBudgetsService';
import {
  CARE_GRADE_OPTIONS,
  parseCorrectionAmountCents,
  validateBudgetCorrectionForm,
} from '@/lib/assist/clientCareGradeBudgetsViewModel';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import type {
  ClientAssistBillingProfile,
  ClientBudgetAccount,
  ClientCareGrade,
} from '@/types/assist/clientAssistBilling';
import { spacing, typography } from '@/theme';

const FORM_CTX = { viewContext: 'form' as const };

type ModalBaseProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  isReadOnly: boolean;
};

function ModalFeedback({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  return (
    <>
      {error ? <InfoBanner message={error} variant="danger" /> : null}
      {success ? <InfoBanner message={success} variant="info" /> : null}
    </>
  );
}

export function EditCareGradeModal({
  visible,
  onClose,
  onSaved,
  isReadOnly,
  clientId,
  profile,
}: ModalBaseProps & { clientId: string; profile: ClientAssistBillingProfile }) {
  const tenantId = useServiceTenantId();
  const [careGrade, setCareGrade] = useState<ClientCareGrade>(profile.careGrade ?? 'kein');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCareGrade(profile.careGrade ?? 'kein');
      setEffectiveFrom(new Date().toISOString().slice(0, 10));
      setReason('');
      setError(null);
      setSuccess(null);
    }
  }, [visible, profile.careGrade]);

  async function handleSave() {
    if (isReadOnly || !tenantId) return;
    if (!reason.trim()) {
      setError('Begründung ist Pflicht.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await changeClientCareGrade(tenantId, clientId, {
        newCareGrade: careGrade,
        effectiveFrom,
        reason: reason.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(`Pflegegrad auf ${formatCareLevel(careGrade)} geändert.`);
      onSaved();
      setTimeout(onClose, 600);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppGlassModal
      visible={visible}
      title="Pflegegrad bearbeiten"
      subtitle="Historische Budgetbewegungen bleiben erhalten"
      onClose={onClose}
      footerActions={[
        { title: 'Abbrechen', onPress: onClose, variant: 'secondary' },
        {
          title: saving ? 'Speichern…' : 'Speichern',
          onPress: handleSave,
          variant: 'primary',
          disabled: isReadOnly || saving,
        },
      ]}
    >
      <View style={styles.body}>
        <Text style={styles.label}>Pflegegrad</Text>
        <FilterChipGroup
          options={CARE_GRADE_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
          value={careGrade}
          onChange={(v) => setCareGrade((Array.isArray(v) ? v[0] : v) as ClientCareGrade)}
        />
        <PremiumInput
          {...FORM_CTX}
          label="Gültig ab"
          value={effectiveFrom}
          onChangeText={setEffectiveFrom}
          placeholder="YYYY-MM-DD"
          editable={!isReadOnly}
        />
        <PremiumInput
          {...FORM_CTX}
          label="Begründung (Pflicht)"
          value={reason}
          onChangeText={setReason}
          multiline
          editable={!isReadOnly}
        />
        <ModalFeedback error={error} success={success} />
      </View>
    </AppGlassModal>
  );
}

export function EditCareFundModal({
  visible,
  onClose,
  onSaved,
  isReadOnly,
  clientId,
  profile,
}: ModalBaseProps & { clientId: string; profile: ClientAssistBillingProfile }) {
  const tenantId = useServiceTenantId();
  const [careFundName, setCareFundName] = useState(profile.careEntitlement?.careFundName ?? '');
  const [careFundMemberId, setCareFundMemberId] = useState(profile.careEntitlement?.careFundMemberId ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCareFundName(profile.careEntitlement?.careFundName ?? '');
      setCareFundMemberId(profile.careEntitlement?.careFundMemberId ?? '');
      setReason('');
      setError(null);
      setSuccess(null);
    }
  }, [visible, profile.careEntitlement]);

  async function handleSave() {
    if (isReadOnly || !tenantId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateClientCareFund(tenantId, clientId, {
        careFundName,
        careFundMemberId,
        reason,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess('Pflegekasse aktualisiert.');
      onSaved();
      setTimeout(onClose, 600);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppGlassModal
      visible={visible}
      title="Pflegekasse bearbeiten"
      onClose={onClose}
      footerActions={[
        { title: 'Abbrechen', onPress: onClose, variant: 'secondary' },
        {
          title: saving ? 'Speichern…' : 'Speichern',
          onPress: handleSave,
          variant: 'primary',
          disabled: isReadOnly || saving,
        },
      ]}
    >
      <View style={styles.body}>
        <PremiumInput
          {...FORM_CTX}
          label="Pflegekasse"
          value={careFundName}
          onChangeText={setCareFundName}
          editable={!isReadOnly}
        />
        <PremiumInput
          {...FORM_CTX}
          label="Versichertennummer"
          value={careFundMemberId}
          onChangeText={setCareFundMemberId}
          editable={!isReadOnly}
        />
        <PremiumInput
          {...FORM_CTX}
          label="Begründung (Pflicht)"
          value={reason}
          onChangeText={setReason}
          multiline
          editable={!isReadOnly}
        />
        <ModalFeedback error={error} success={success} />
      </View>
    </AppGlassModal>
  );
}

export function EditValidFromModal({
  visible,
  onClose,
  onSaved,
  isReadOnly,
  clientId,
  profile,
}: ModalBaseProps & { clientId: string; profile: ClientAssistBillingProfile }) {
  const tenantId = useServiceTenantId();
  const [validFrom, setValidFrom] = useState(profile.careEntitlement?.validFrom ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValidFrom(profile.careEntitlement?.validFrom ?? new Date().toISOString().slice(0, 10));
      setReason('');
      setError(null);
      setSuccess(null);
    }
  }, [visible, profile.careEntitlement?.validFrom]);

  async function handleSave() {
    if (isReadOnly || !tenantId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateCareEntitlementValidFrom(tenantId, clientId, { validFrom, reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess('Bescheid gültig ab aktualisiert.');
      onSaved();
      setTimeout(onClose, 600);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppGlassModal
      visible={visible}
      title="Bescheid gültig ab bearbeiten"
      onClose={onClose}
      footerActions={[
        { title: 'Abbrechen', onPress: onClose, variant: 'secondary' },
        {
          title: saving ? 'Speichern…' : 'Speichern',
          onPress: handleSave,
          variant: 'primary',
          disabled: isReadOnly || saving,
        },
      ]}
    >
      <View style={styles.body}>
        <PremiumInput
          {...FORM_CTX}
          label="Gültig ab"
          value={validFrom}
          onChangeText={setValidFrom}
          placeholder="YYYY-MM-DD"
          editable={!isReadOnly}
        />
        <PremiumInput
          {...FORM_CTX}
          label="Begründung (Pflicht)"
          value={reason}
          onChangeText={setReason}
          multiline
          editable={!isReadOnly}
        />
        <ModalFeedback error={error} success={success} />
      </View>
    </AppGlassModal>
  );
}

export function ConversionToggleModal({
  visible,
  onClose,
  onSaved,
  isReadOnly,
  clientId,
  profile,
}: ModalBaseProps & { clientId: string; profile: ClientAssistBillingProfile }) {
  const tenantId = useServiceTenantId();
  const currentlyEnabled = profile.careEntitlement?.conversionEnabled ?? false;
  const targetEnabled = !currentlyEnabled;
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setReason('');
      setError(null);
      setSuccess(null);
    }
  }, [visible]);

  async function handleSave() {
    if (isReadOnly || !tenantId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await setClientConversionEnabled(tenantId, clientId, targetEnabled, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(targetEnabled ? 'Umwandlung § 45a aktiviert.' : 'Umwandlung § 45a deaktiviert.');
      onSaved();
      setTimeout(onClose, 600);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppGlassModal
      visible={visible}
      title={targetEnabled ? 'Umwandlung § 45a aktivieren' : 'Umwandlung § 45a deaktivieren'}
      subtitle="Historische § 45a-Bewegungen bleiben erhalten"
      onClose={onClose}
      footerActions={[
        { title: 'Abbrechen', onPress: onClose, variant: 'secondary' },
        {
          title: saving ? 'Speichern…' : 'Bestätigen',
          onPress: handleSave,
          variant: 'primary',
          disabled: isReadOnly || saving || !reason.trim(),
        },
      ]}
    >
      <View style={styles.body}>
        <InfoBanner
          message={
            targetEnabled
              ? 'Monatliche Umwandlungsbudgets werden aus dem Katalog 2026 erzeugt.'
              : 'Neue § 45a-Reservierungen/-Verbräuche werden blockiert; bestehende Buchungen bleiben.'
          }
          variant="warning"
        />
        <PremiumInput
          {...FORM_CTX}
          label="Begründung (Pflicht)"
          value={reason}
          onChangeText={setReason}
          multiline
          editable={!isReadOnly}
        />
        <ModalFeedback error={error} success={success} />
      </View>
    </AppGlassModal>
  );
}

export function BudgetCorrectionModal({
  visible,
  onClose,
  onSaved,
  isReadOnly,
  clientId,
  accounts,
  preselectedAccountId,
}: ModalBaseProps & {
  clientId: string;
  accounts: ClientBudgetAccount[];
  preselectedAccountId?: string | null;
}) {
  const tenantId = useServiceTenantId();
  const [accountId, setAccountId] = useState(preselectedAccountId ?? accounts[0]?.id ?? '');
  const [amountEuro, setAmountEuro] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setAccountId(preselectedAccountId ?? accounts[0]?.id ?? '');
      setAmountEuro('');
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setReason('');
      setError(null);
      setSuccess(null);
    }
  }, [visible, preselectedAccountId, accounts]);

  async function handleSave() {
    if (isReadOnly || !tenantId) return;
    const validation = validateBudgetCorrectionForm({
      budgetAccountId: accountId,
      amountEuro,
      reason,
      effectiveDate,
    });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await bookBudgetCorrection(tenantId, clientId, {
        budgetAccountId: accountId,
        amountCents: parseCorrectionAmountCents(amountEuro),
        reason: reason.trim(),
        effectiveDate,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess('Korrektur gebucht.');
      onSaved();
      setTimeout(onClose, 600);
    } finally {
      setSaving(false);
    }
  }

  const accountOptions = accounts.map((a) => ({
    key: a.id,
    label: a.label ?? a.catalogKey,
  }));

  return (
    <AppGlassModal
      visible={visible}
      title="Korrektur buchen"
      subtitle="Manuelle Budgetbewegung (+/-)"
      onClose={onClose}
      footerActions={[
        { title: 'Abbrechen', onPress: onClose, variant: 'secondary' },
        {
          title: saving ? 'Buchen…' : 'Korrektur buchen',
          onPress: handleSave,
          variant: 'primary',
          disabled: isReadOnly || saving,
        },
      ]}
    >
      <View style={styles.body}>
        {accountOptions.length > 0 ? (
          <>
            <Text style={styles.label}>Budgetkonto</Text>
            <FilterChipGroup options={accountOptions} value={accountId} onChange={(v) => setAccountId(Array.isArray(v) ? v[0] : v)} />
          </>
        ) : (
          <InfoBanner message="Keine Budgetkonten vorhanden." variant="warning" />
        )}
        <PremiumInput
          {...FORM_CTX}
          label="Betrag (€, +/-)"
          value={amountEuro}
          onChangeText={setAmountEuro}
          keyboardType="decimal-pad"
          placeholder="z. B. 50 oder -25"
          editable={!isReadOnly}
        />
        <PremiumInput
          {...FORM_CTX}
          label="Wirksamkeitsdatum"
          value={effectiveDate}
          onChangeText={setEffectiveDate}
          editable={!isReadOnly}
        />
        <PremiumInput
          {...FORM_CTX}
          label="Begründung (Pflicht)"
          value={reason}
          onChangeText={setReason}
          multiline
          editable={!isReadOnly}
        />
        <ModalFeedback error={error} success={success} />
      </View>
    </AppGlassModal>
  );
}

export function BudgetRecalcModal({
  visible,
  onClose,
  onSaved,
  isReadOnly,
  clientId,
  profile,
}: ModalBaseProps & { clientId: string; profile: ClientAssistBillingProfile }) {
  const tenantId = useServiceTenantId();
  const [diffs, setDiffs] = useState<BudgetRecalcDiff[]>([]);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !tenantId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setReason('');

    previewBudgetRecalculationFromCatalog(
      tenantId,
      clientId,
      profile.budgetYear,
      profile.careGrade,
      profile.conversionEligible,
      profile.careEntitlement,
    )
      .then((result) => {
        if (result.ok) {
          setDiffs(result.data);
        } else {
          setDiffs(
            computeBudgetRecalculationDiffs({
              careGrade: profile.careGrade,
              conversionEligible: profile.conversionEligible,
              careEntitlement: profile.careEntitlement,
              budgetAccounts: profile.budgetAccounts,
              templates: profile.templates,
            }),
          );
          if (!result.ok) setError(result.error);
        }
      })
      .finally(() => setLoading(false));
  }, [visible, tenantId, clientId, profile]);

  const applicable = diffs.filter((d) => !d.skipped && d.deltaCents !== 0);

  async function handleApply() {
    if (isReadOnly || !tenantId) return;
    if (!reason.trim()) {
      setError('Begründung ist Pflicht.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await applyBudgetRecalculation(tenantId, clientId, diffs, reason.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(`${result.data.updated} Konto(en) neu berechnet.`);
      onSaved();
      setTimeout(onClose, 800);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppGlassModal
      visible={visible}
      title="Budgetkonten neu berechnen"
      subtitle="Abgleich mit Katalog 2026, PG, Umwandlung, Budgetmodus"
      onClose={onClose}
      maxWidth={840}
      footerActions={[
        { title: 'Abbrechen', onPress: onClose, variant: 'secondary' },
        {
          title: saving ? 'Buchen…' : 'Neuberechnung bestätigen',
          onPress: handleApply,
          variant: 'primary',
          disabled: isReadOnly || saving || loading || applicable.length === 0,
        },
      ]}
    >
      <View style={styles.body}>
        {loading ? <Text style={styles.meta}>Katalog wird geprüft…</Text> : null}
        {diffs.length === 0 && !loading ? (
          <InfoBanner message="Keine Budgetkonten zum Abgleichen." variant="info" />
        ) : (
          diffs.map((d) => (
            <PremiumCard key={d.accountId} style={styles.diffCard}>
              <Text style={styles.label}>{d.label}</Text>
              <Text style={styles.meta}>
                Aktuell: {formatCurrency(d.currentAllocatedCents, true)} → Katalog:{' '}
                {formatCurrency(d.catalogAmountCents, true)}
                {d.skipped ? ` (${d.skipReason})` : ` (Δ ${formatCurrency(d.deltaCents, true)})`}
              </Text>
            </PremiumCard>
          ))
        )}
        <PremiumInput
          {...FORM_CTX}
          label="Begründung (Pflicht)"
          value={reason}
          onChangeText={setReason}
          multiline
          editable={!isReadOnly}
        />
        <ModalFeedback error={error} success={success} />
      </View>
    </AppGlassModal>
  );
}

export function BudgetDeactivateModal({
  visible,
  onClose,
  onSaved,
  isReadOnly,
  clientId,
  account,
}: ModalBaseProps & { clientId: string; account: ClientBudgetAccount | null }) {
  const tenantId = useServiceTenantId();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setReason('');
      setError(null);
      setSuccess(null);
    }
  }, [visible]);

  if (!account) return null;

  async function handleSave() {
    if (isReadOnly || !tenantId || !account) return;
    setSaving(true);
    setError(null);
    try {
      const result = await deactivateClientBudgetAccount(tenantId, clientId, account.id, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess('Budget deaktiviert.');
      onSaved();
      setTimeout(onClose, 600);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppGlassModal
      visible={visible}
      title="Budget deaktivieren"
      subtitle={account.label ?? account.catalogKey}
      onClose={onClose}
      footerActions={[
        { title: 'Abbrechen', onPress: onClose, variant: 'secondary' },
        {
          title: saving ? 'Deaktivieren…' : 'Deaktivieren',
          onPress: handleSave,
          variant: 'primary',
          disabled: isReadOnly || saving || !reason.trim(),
        },
      ]}
    >
      <View style={styles.body}>
        <InfoBanner
          message="Das Konto wird gesperrt; historische Bewegungen bleiben im Budgetverlauf."
          variant="warning"
        />
        <PremiumInput
          {...FORM_CTX}
          label="Begründung (Pflicht)"
          value={reason}
          onChangeText={setReason}
          multiline
          editable={!isReadOnly}
        />
        <ModalFeedback error={error} success={success} />
      </View>
    </AppGlassModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  label: { ...typography.label },
  meta: { ...typography.caption },
  diffCard: { marginBottom: spacing.xs },
});
