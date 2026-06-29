import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import {
  EmptyState,
  InfoBanner,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumDataTable,
  PremiumInput,
  type DataTableColumn,
} from '@/components/ui';
import { BudgetDeactivateModal } from '@/components/office/ClientCareGradeBudgetsModals';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import {
  setClientBudgetEnabled,
  setClientCarePreventionBudgetMode,
  setIndividualBudgetOverride,
  updateClientBudgetAccount,
} from '@/lib/assist/clientBudgetAccountService';
import { formatBudgetPeriodLabelCapitalized } from '@/lib/assist/budgetPeriodLabels';
import { computeAvailableCents } from '@/lib/assist/clientBudgetTransactionService';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import {
  BUDGET_TEMPLATE_LABELS,
  CARE_PREVENTION_MODE_LABELS,
  type ClientAssistBillingProfile,
  type ClientBudgetAccount,
  type ClientCarePreventionBudgetMode,
} from '@/types/assist/clientAssistBilling';
import { spacing, typography } from '@/theme';

const FORM_CTX = { viewContext: 'form' as const };
const MOBILE_BREAKPOINT = 768;

function useIsMobileLayout(): boolean {
  const { width } = useWindowDimensions();
  return width < MOBILE_BREAKPOINT;
}

function accountLabel(a: ClientBudgetAccount): string {
  return a.label ?? BUDGET_TEMPLATE_LABELS[a.catalogKey as keyof typeof BUDGET_TEMPLATE_LABELS] ?? a.catalogKey;
}

export function BudgetInfoBanners({ profile }: { profile: ClientAssistBillingProfile }) {
  const banners: { key: string; message: string; variant: 'info' | 'warning' | 'danger' }[] = [];

  if (profile.careGrade && profile.careGrade !== 'kein') {
    banners.push({
      key: 'umw-monthly',
      message:
        'Umwandlung Entlastungsbudget (§ 45a) wird monatlich geführt — Beträge stammen aus dem Katalog 2026.',
      variant: 'info',
    });
  }

  if (profile.carePreventionMode === 'joint_annual_budget') {
    banners.push({
      key: 'joint-mode',
      message:
        'Gemeinsames Jahresbudget aktiv — Verhinderungs- und Kurzzeitpflege-Konten sind gesperrt (keine Doppelzählung).',
      variant: 'warning',
    });
  }

  if (profile.budgetAccounts.some((a) => a.isIndividualOverride)) {
    banners.push({
      key: 'individual',
      message:
        'Individuelle Budgets haben Vorrang vor Standardvorlagen und werden bei Auto-Generate nicht überschrieben.',
      variant: 'info',
    });
  }

  if (profile.conversionEligible && !profile.careEntitlement?.conversionEnabled) {
    banners.push({
      key: 'conversion-off',
      message: 'Umwandlung ist nicht freigegeben — nur § 45b monatlich wird automatisch verwendet.',
      variant: 'warning',
    });
  }

  if (banners.length === 0) return null;

  return (
    <View style={styles.bannerStack}>
      {banners.map((b) => (
        <InfoBanner key={b.key} message={b.message} variant={b.variant} />
      ))}
    </View>
  );
}

function BudgetAccountEditModal({
  account,
  visible,
  isReadOnly,
  onClose,
  onSaved,
}: {
  account: ClientBudgetAccount | null;
  visible: boolean;
  isReadOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const tenantId = useServiceTenantId();
  const [individualEuro, setIndividualEuro] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const accountId = account?.id;
  useEffect(() => {
    if (account) {
      setIndividualEuro(
        account.individualAmountCents != null ? String(account.individualAmountCents / 100) : '',
      );
      setNotes(account.notes ?? '');
    }
  }, [accountId, account]);

  if (!account) return null;

  return (
    <AppGlassModal
      visible={visible}
      title={`Budget bearbeiten — ${accountLabel(account)}`}
      subtitle={formatBudgetPeriodLabelCapitalized(account.period, account.catalogKey)}
      onClose={onClose}
      footerActions={[
        { title: 'Abbrechen', onPress: onClose, variant: 'secondary' },
        {
          title: saving ? 'Speichern…' : 'Speichern',
          onPress: async () => {
            if (isReadOnly || !tenantId) return;
            setSaving(true);
            try {
              const trimmed = individualEuro.trim();
              const individualCents =
                trimmed === '' ? null : Math.round(parseFloat(trimmed.replace(',', '.')) * 100);
              if (individualCents != null) {
                await setIndividualBudgetOverride(
                  tenantId,
                  account.clientId,
                  account.id,
                  individualCents,
                  notes,
                );
              } else {
                await updateClientBudgetAccount(tenantId, account.clientId, account.id, {
                  isIndividualOverride: false,
                  individualAmountCents: null,
                  notes,
                });
              }
              onSaved();
              onClose();
            } finally {
              setSaving(false);
            }
          },
          variant: 'primary',
          disabled: isReadOnly || saving,
        },
      ]}
    >
      <View style={styles.modalBody}>
        <Text style={styles.modalMeta}>
          Standardwert:{' '}
          {account.standardAmountCents != null
            ? formatCurrency(account.standardAmountCents, true)
            : '—'}
        </Text>
        <PremiumInput
          {...FORM_CTX}
          label="Individueller Betrag (€) — leer = Standard"
          value={individualEuro}
          onChangeText={setIndividualEuro}
          keyboardType="decimal-pad"
          editable={!isReadOnly}
        />
        <PremiumInput
          {...FORM_CTX}
          label="Notiz"
          value={notes}
          onChangeText={setNotes}
          multiline
          editable={!isReadOnly}
        />
      </View>
    </AppGlassModal>
  );
}

export function BudgetModeSwitch({
  profile,
  clientId,
  isReadOnly,
  onChanged,
}: {
  profile: ClientAssistBillingProfile;
  clientId: string;
  isReadOnly: boolean;
  onChanged: () => void;
}) {
  const tenantId = useServiceTenantId();
  const text = useAuroraAdaptiveText();
  const [pendingMode, setPendingMode] = useState<ClientCarePreventionBudgetMode | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const isJoint = profile.carePreventionMode === 'joint_annual_budget';

  async function confirmModeChange() {
    if (!tenantId || !pendingMode || !reason.trim()) return;
    setSaving(true);
    try {
      await setClientCarePreventionBudgetMode(
        tenantId,
        clientId,
        profile.budgetYear,
        pendingMode,
        reason.trim(),
      );
      setPendingMode(null);
      setReason('');
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <PremiumCard style={styles.card}>
      <Text style={[styles.cardTitle, { color: text.primary }]}>Budget-Modus VP / Kurzzeit</Text>
      <Text style={[styles.meta, { color: text.secondary }]}>
        {CARE_PREVENTION_MODE_LABELS[profile.carePreventionMode]}
      </Text>
      {!isReadOnly ? (
        <View style={styles.modeRow}>
          <PremiumButton
            title="Gemeinsames Jahresbudget"
            variant={isJoint ? 'primary' : 'secondary'}
            onPress={() => setPendingMode('joint_annual_budget')}
          />
          <PremiumButton
            title="Getrennt VP + Kurzzeit"
            variant={!isJoint ? 'primary' : 'secondary'}
            onPress={() => setPendingMode('separate_preventive_short_term')}
          />
        </View>
      ) : null}
      <AppGlassModal
        visible={pendingMode !== null}
        title="Budget-Modus wechseln"
        subtitle="Pflichtbegründung für Audit-Protokoll"
        onClose={() => {
          setPendingMode(null);
          setReason('');
        }}
        footerActions={[
          {
            title: 'Abbrechen',
            onPress: () => {
              setPendingMode(null);
              setReason('');
            },
            variant: 'secondary',
          },
          {
            title: saving ? 'Speichern…' : 'Bestätigen',
            onPress: confirmModeChange,
            variant: 'primary',
            disabled: saving || !reason.trim(),
          },
        ]}
      >
        <PremiumInput
          {...FORM_CTX}
          label="Begründung (Pflicht)"
          value={reason}
          onChangeText={setReason}
          multiline
        />
        {pendingMode ? (
          <InfoBanner
            message={`Wechsel zu: ${CARE_PREVENTION_MODE_LABELS[pendingMode]}`}
            variant="warning"
          />
        ) : null}
      </AppGlassModal>
    </PremiumCard>
  );
}

export function BudgetAccountsEditableGrid({
  profile,
  clientId,
  isReadOnly,
  onChanged,
}: {
  profile: ClientAssistBillingProfile;
  clientId: string;
  isReadOnly: boolean;
  onChanged: () => void;
}) {
  const tenantId = useServiceTenantId();
  const text = useAuroraAdaptiveText();
  const isMobile = useIsMobileLayout();
  const [editAccount, setEditAccount] = useState<ClientBudgetAccount | null>(null);
  const [deactivateAccount, setDeactivateAccount] = useState<ClientBudgetAccount | null>(null);

  async function handleToggle(account: ClientBudgetAccount, enabled: boolean) {
    if (!tenantId || isReadOnly) return;
    if (!enabled) {
      setDeactivateAccount(account);
      return;
    }
    await setClientBudgetEnabled(tenantId, clientId, account.id, true);
    onChanged();
  }

  const columns: DataTableColumn<ClientBudgetAccount>[] = useMemo(
    () => [
      {
        key: 'active',
        label: 'Aktiv',
        width: 56,
        render: (a) => (
          <Switch
            value={a.isEnabled !== false && a.status === 'active'}
            onValueChange={(v) => handleToggle(a, v)}
            disabled={isReadOnly || a.locked}
          />
        ),
      },
      {
        key: 'budget',
        label: 'Budget',
        flex: 2,
        render: (a) => (
          <Text style={[styles.cellPrimary, { color: text.primary }]}>{accountLabel(a)}</Text>
        ),
      },
      {
        key: 'period',
        label: 'Zeitraum',
        width: 88,
        render: (a) => (
          <Text style={[styles.cellSecondary, { color: text.secondary }]}>
            {formatBudgetPeriodLabelCapitalized(a.period, a.catalogKey)}
          </Text>
        ),
      },
      {
        key: 'standard',
        label: 'Standard',
        width: 80,
        align: 'right',
        render: (a) => (
          <Text style={[styles.cellPrimary, { color: text.primary }]}>
            {a.standardAmountCents != null ? formatCurrency(a.standardAmountCents, true) : '—'}
          </Text>
        ),
      },
      {
        key: 'individual',
        label: 'Individ.',
        width: 80,
        align: 'right',
        render: (a) => (
          <Text style={[styles.cellPrimary, { color: text.primary }]}>
            {a.isIndividualOverride && a.individualAmountCents != null
              ? formatCurrency(a.individualAmountCents, true)
              : '—'}
          </Text>
        ),
      },
      {
        key: 'allocated',
        label: 'Zugewiesen',
        width: 88,
        align: 'right',
        render: (a) => (
          <Text style={[styles.cellPrimary, { color: text.primary }]}>
            {formatCurrency(a.allocatedCents, true)}
          </Text>
        ),
      },
      {
        key: 'reserved',
        label: 'Reserviert',
        width: 88,
        align: 'right',
        render: (a) => (
          <Text style={[styles.cellPrimary, { color: text.primary }]}>
            {formatCurrency(a.reservedCents, true)}
          </Text>
        ),
      },
      {
        key: 'used',
        label: 'Verbraucht',
        width: 88,
        align: 'right',
        render: (a) => (
          <Text style={[styles.cellPrimary, { color: text.primary }]}>
            {formatCurrency(a.usedCents, true)}
          </Text>
        ),
      },
      {
        key: 'available',
        label: 'Verfügbar',
        width: 88,
        align: 'right',
        render: (a) => (
          <Text style={[styles.cellPrimary, { color: text.primary }]}>
            {formatCurrency(a.remainingCents ?? computeAvailableCents(a), true)}
          </Text>
        ),
      },
      {
        key: 'auto',
        label: 'Automatik',
        width: 72,
        render: (a) => (
          <Text style={[styles.cellSecondary, { color: text.secondary }]}>
            {a.autoGenerate ? 'Ja' : 'Nein'}
          </Text>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: 72,
        render: (a) => (
          <PremiumBadge
            label={
              a.locked ? 'gesperrt' : profile.canUseBudgetByCatalogKey[a.catalogKey] ? 'OK' : 'leer'
            }
            variant={
              a.locked ? 'orange' : profile.canUseBudgetByCatalogKey[a.catalogKey] ? 'green' : 'gray'
            }
          />
        ),
      },
      {
        key: 'actions',
        label: 'Aktionen',
        width: 120,
        render: (a) =>
          !isReadOnly ? (
            <View style={styles.actionCell}>
              <PremiumButton title="Bearbeiten" variant="glass" onPress={() => setEditAccount(a)} />
            </View>
          ) : (
            <Text style={[styles.cellSecondary, { color: text.secondary }]}>—</Text>
          ),
      },
    ],
    [isReadOnly, profile.canUseBudgetByCatalogKey, text.primary, text.secondary],
  );

  function renderMobileCard(a: ClientBudgetAccount) {
    const available = a.remainingCents ?? computeAvailableCents(a);
    const statusLabel = a.locked
      ? 'gesperrt'
      : profile.canUseBudgetByCatalogKey[a.catalogKey]
        ? 'OK'
        : 'leer';
    const statusVariant = a.locked ? 'orange' as const : profile.canUseBudgetByCatalogKey[a.catalogKey] ? 'green' as const : 'gray' as const;

    return (
      <PremiumCard key={a.id} style={styles.mobileCard}>
        <View style={styles.rowBetween}>
          <Text style={[styles.cardTitle, { color: text.primary }]}>{accountLabel(a)}</Text>
          <PremiumBadge label={statusLabel} variant={statusVariant} />
        </View>
        <Text style={[styles.meta, { color: text.secondary }]}>
          {formatBudgetPeriodLabelCapitalized(a.period, a.catalogKey)}
        </Text>
        <View style={styles.mobileStats}>
          <Text style={[styles.meta, { color: text.secondary }]}>
            Zugewiesen: {formatCurrency(a.allocatedCents, true)}
          </Text>
          <Text style={[styles.meta, { color: text.secondary }]}>
            Reserviert: {formatCurrency(a.reservedCents, true)}
          </Text>
          <Text style={[styles.meta, { color: text.secondary }]}>
            Verbraucht: {formatCurrency(a.usedCents, true)}
          </Text>
          <Text style={[styles.meta, { color: text.primary }]}>
            Verfügbar: {formatCurrency(available, true)}
          </Text>
        </View>
        <View style={styles.rowBetween}>
          <Switch
            value={a.isEnabled !== false && a.status === 'active'}
            onValueChange={(v) => handleToggle(a, v)}
            disabled={isReadOnly || a.locked}
          />
          {!isReadOnly ? (
            <PremiumButton title="Bearbeiten" variant="glass" onPress={() => setEditAccount(a)} />
          ) : null}
        </View>
      </PremiumCard>
    );
  }

  if (profile.budgetAccounts.length === 0) {
    return (
      <EmptyState
        title="Keine Budgetkonten"
        message="Budgetkonten werden aus der Vorlage 2026 erzeugt — Beträge stammen aus dem Katalog, nicht aus dem UI."
      />
    );
  }

  return (
    <>
      {isMobile ? (
        <View style={styles.mobileList}>
          {profile.budgetAccounts.map(renderMobileCard)}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
          <PremiumDataTable
            columns={columns}
            data={profile.budgetAccounts}
            keyExtractor={(a) => a.id}
            emptyMessage="Keine Budgetkonten"
          />
        </ScrollView>
      )}
      <BudgetAccountEditModal
        account={editAccount}
        visible={editAccount !== null}
        isReadOnly={isReadOnly}
        onClose={() => setEditAccount(null)}
        onSaved={onChanged}
      />
      <BudgetDeactivateModal
        visible={deactivateAccount !== null}
        onClose={() => setDeactivateAccount(null)}
        onSaved={onChanged}
        isReadOnly={isReadOnly}
        clientId={clientId}
        account={deactivateAccount}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  cardTitle: { ...typography.label },
  meta: { ...typography.caption, marginTop: spacing.xs },
  bannerStack: { gap: spacing.sm, marginBottom: spacing.sm },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tableScroll: { maxWidth: '100%' },
  mobileList: { gap: spacing.sm },
  mobileCard: { marginBottom: spacing.xs },
  mobileStats: { gap: spacing.xs, marginVertical: spacing.xs },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  actionCell: { flexDirection: 'row', gap: spacing.xs },
  cellPrimary: { ...typography.caption },
  cellSecondary: { ...typography.caption, fontSize: 11 },
  modalBody: { gap: spacing.md },
  modalMeta: { ...typography.caption, marginBottom: spacing.xs },
});
