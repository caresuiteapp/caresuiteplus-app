import { useEffect, useState } from 'react';
import type { ClientDetail } from '@/types/detail';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClientDetailHero } from '@/components/office';
import { ClientSectionEditModal } from '@/components/office/ClientSectionEditModal';
import { ContextCard, contextGridStyle } from '@/components/detail';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
  SegmentedTabs,
  SuccessState,
} from '@/components/ui';
import { LockedActionBanner, PermissionGate } from '@/components/permissions';
import { useClientFullDetail } from '@/hooks/useClientFullDetail';
import { useClientDetail } from '@/hooks/useClientDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';
import {
  AngehoerigeTab,
  DokumenteTab,
  EinsatzAufgabenTab,
  EinwilligungenTab,
  KontaktAdresseTab,
  PflegegradBudgetTab,
  PortalTab,
  RisikenNotfallTab,
  StammdatenTab,
  VerlaufTab,
  VertragAbrechnungTab,
} from './ClientFullDetailTabs';

const DETAIL_TABS = [
  { key: 'stammdaten', label: 'Stammdaten' },
  { key: 'kontakt', label: 'Kontakt' },
  { key: 'angehoerige', label: 'Angehörige' },
  { key: 'pflegegrad', label: 'Pflegegrad' },
  { key: 'vertrag', label: 'Vertrag' },
  { key: 'einsatz', label: 'Einsatz' },
  { key: 'risiken', label: 'Risiken' },
  { key: 'dokumente', label: 'Dokumente' },
  { key: 'einwilligungen', label: 'Einwilligungen' },
  { key: 'portal', label: 'Portal' },
  { key: 'verlauf', label: 'Verlauf' },
  { key: 'aktionen', label: 'Aktionen' },
];

function ActionsTab({
  client,
  onStatusChange,
  loading,
  canChangeStatus,
  canEdit,
  onEdit,
  statusDeniedMessage,
  editDeniedMessage,
  roleLabel,
}: {
  client: ClientDetail;
  onStatusChange: (status: ClientDetail['status']) => void;
  loading: boolean;
  canChangeStatus: boolean;
  canEdit: boolean;
  onEdit: () => void;
  statusDeniedMessage?: string;
  editDeniedMessage?: string;
  roleLabel: string | null;
}) {
  return (
    <View style={styles.tab}>
      <PremiumCard accentColor={colors.orange}>
        <Text style={styles.hint}>{client.nextActionHint}</Text>
        <PremiumBadge label={WORKFLOW_STATUS_LABELS[client.status]} variant="orange" dot />
      </PremiumCard>
      <SectionPanel title="Kontext" subtitle="Verknüpfte Bereiche">
        <View style={contextGridStyle}>
          <ContextCard icon="📅" label="Einsätze" count={client.contextCounts.assignments} accentColor={colors.orange} />
          <ContextCard icon="📄" label="Dokumente" count={client.contextCounts.documents} accentColor={colors.cyan} />
          <ContextCard icon="🧾" label="Rechnungen" count={client.contextCounts.invoices} accentColor={colors.amber} />
          <ContextCard icon="🗓️" label="Termine" count={client.contextCounts.appointments} accentColor={colors.violet} />
        </View>
      </SectionPanel>
      <SectionPanel title="Status ändern">
        {!canChangeStatus ? (
          <LockedActionBanner message={statusDeniedMessage ?? 'Statusänderungen sind gesperrt.'} roleLabel={roleLabel} />
        ) : client.allowedStatusActions.length === 0 ? (
          <EmptyState title="Keine Aktionen" message="Für diesen Status sind keine Wechsel möglich." />
        ) : (
          <View style={styles.actionGrid}>
            {client.allowedStatusActions.map((status) => (
              <PremiumButton key={status} title={WORKFLOW_STATUS_LABELS[status]} variant="secondary" size="sm" loading={loading} onPress={() => onStatusChange(status)} />
            ))}
          </View>
        )}
      </SectionPanel>
      <PermissionGate permission="office.clients.edit" showLockedHint lockedTitle="Bearbeitung gesperrt">
        <PremiumButton title="Stammdaten bearbeiten" variant="primary" fullWidth onPress={onEdit} disabled={!canEdit} />
      </PermissionGate>
      {!canEdit && editDeniedMessage ? <Text style={styles.audit}>{editDeniedMessage}</Text> : null}
    </View>
  );
}

export function ClientDetailScreen({ clientId, embedded = false }: { clientId?: string; embedded?: boolean } = {}) {
  const params = useLocalSearchParams<{ id: string; edit?: string }>();
  const id = clientId ?? params.id;
  const router = useRouter();
  const showBack = !embedded;
  const { profile } = useAuth();
  const { can, check, roleLabel, isReadOnly } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const [activeTab, setActiveTab] = useState('stammdaten');
  const [editOpen, setEditOpen] = useState(false);

  const fullQuery = useClientFullDetail(id);
  const legacyQuery = useClientDetail(id);

  const client = fullQuery.data ?? legacyQuery.data;
  const loading = fullQuery.loading || legacyQuery.loading;
  const error = fullQuery.error ?? legacyQuery.error;
  const notFound = fullQuery.notFound && legacyQuery.notFound;

  const visibleTabs = DETAIL_TABS.filter((tab) => {
    if (tab.key === 'einwilligungen') return can('office.clients.manage_consents');
    if (tab.key === 'angehoerige') return can('office.clients.edit') || can('office.clients.view');
    if (tab.key === 'aktionen') return can('office.clients.status_change') || can('office.clients.edit');
    return true;
  });

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? 'stammdaten');
    }
  }, [visibleTabs, activeTab]);

  useEffect(() => {
    if (embedded || params.edit !== '1' || !can('office.clients.edit')) return;
    setEditOpen(true);
    router.setParams({ edit: undefined } as never);
  }, [embedded, params.edit, can, router]);

  if (loading) {
    return (
      <ScreenShell title="Klient:in" subtitle="Wird geladen…" showBack={showBack}>
        <LoadingState message="Detaildaten werden geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Klient:in" subtitle="Fehler" showBack={showBack}>
        <ErrorState title={notFound ? 'Nicht gefunden' : 'Fehler'} message={error ?? 'Der Datensatz existiert nicht.'} onRetry={fullQuery.refresh} />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!client) {
    return (
      <ScreenShell title="Klient:in" subtitle="Keine Daten" showBack={showBack}>
        <ErrorState
          title="Datensatz nicht verfügbar"
          message="Die Klient:innen-Daten konnten nicht geladen werden. Bitte kehren Sie zur Liste zurück und versuchen Sie es erneut."
          onRetry={fullQuery.refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  const fullClient = fullQuery.data;
  const fullName = `${client.firstName} ${client.lastName}`;
  const canViewSensitive = can('office.clients.view_sensitive');
  const isSensitive = client.sensitivity === 'health' || client.sensitivity === 'restricted';
  const openEditMasterData = () => setEditOpen(true);

  return (
    <>
    <ScreenShell
      title={fullName}
      subtitle={isReadOnly ? 'Klient:innen-Details (nur Lesen)' : 'Digitale Klient:innen-Akte'}
      showBack={showBack}
      showBreadcrumbs={!embedded}
      rightSlot={
        can('office.clients.edit') ? (
          <PremiumButton title="Bearbeiten" size="sm" variant="ghost" onPress={openEditMasterData} />
        ) : null
      }
    >
      {legacyQuery.successMessage ? <SuccessState message={legacyQuery.successMessage} /> : null}
      {isReadOnly ? (
        <LockedActionBanner title="Lesemodus" message="Sie können Klient:innen-Daten einsehen, aber nicht bearbeiten." roleLabel={roleLabel} />
      ) : null}
      {isSensitive && !canViewSensitive ? (
        <LockedActionBanner title="Datenschutz-Hinweis" message="Gesundheitsdaten sind eingeschränkt. Sensible Felder werden maskiert." roleLabel={roleLabel} />
      ) : null}

      <ClientDetailHero
        client={client}
        roleKey={roleKey}
        isReadOnly={isReadOnly}
        canViewSensitive={canViewSensitive}
      />

      <SegmentedTabs tabs={visibleTabs} activeKey={activeTab} onSelect={setActiveTab} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {fullClient && activeTab === 'stammdaten' ? <StammdatenTab client={fullClient} canViewSensitive={canViewSensitive} /> : null}
        {fullClient && activeTab === 'kontakt' ? <KontaktAdresseTab client={fullClient} /> : null}
        {fullClient && activeTab === 'angehoerige' ? <AngehoerigeTab client={fullClient} /> : null}
        {fullClient && activeTab === 'pflegegrad' ? <PflegegradBudgetTab client={fullClient} /> : null}
        {fullClient && activeTab === 'vertrag' ? <VertragAbrechnungTab client={fullClient} /> : null}
        {fullClient && activeTab === 'einsatz' ? <EinsatzAufgabenTab client={fullClient} /> : null}
        {fullClient && activeTab === 'risiken' ? <RisikenNotfallTab client={fullClient} canViewSensitive={canViewSensitive} /> : null}
        {fullClient && activeTab === 'dokumente' ? <DokumenteTab client={fullClient} /> : null}
        {fullClient && activeTab === 'einwilligungen' ? <EinwilligungenTab client={fullClient} /> : null}
        {fullClient && activeTab === 'portal' ? <PortalTab client={fullClient} /> : null}
        {fullClient && activeTab === 'verlauf' ? <VerlaufTab client={fullClient} /> : null}
        {activeTab === 'aktionen' && legacyQuery.data ? (
          <ActionsTab
            client={legacyQuery.data}
            onStatusChange={legacyQuery.changeStatus}
            loading={legacyQuery.actionLoading}
            canChangeStatus={can('office.clients.status_change')}
            canEdit={can('office.clients.edit')}
            onEdit={openEditMasterData}
            statusDeniedMessage={check('office.clients.status_change').reason}
            editDeniedMessage={check('office.clients.edit').reason}
            roleLabel={roleLabel}
          />
        ) : null}
      </ScrollView>
    </ScreenShell>

    {can('office.clients.edit') ? (
      <ClientSectionEditModal
        visible={editOpen}
        clientId={client.id}
        section="stammdaten"
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          void fullQuery.refresh();
          void legacyQuery.refresh();
        }}
      />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  tab: { gap: spacing.md },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { ...typography.body, marginBottom: spacing.sm },
  audit: { ...typography.caption, color: colors.cyan, marginTop: spacing.sm },
});
