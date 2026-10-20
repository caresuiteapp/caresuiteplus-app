import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useModalStack } from '@/hooks/useModalStack';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  addClientServiceProfile,
  endClientServiceProfile,
  listClientServiceProfiles,
  listTenantClientServiceTypes,
  setPrimaryClientServiceProfile,
} from '@/lib/client/clientServiceTypeService';
import { CLIENT_SERVICE_TYPE_LABELS, type ClientServiceTypeKey } from '@/types/clientCore';
import { colors, spacing, typography } from '@/theme';

type Props = {
  clientId: string;
  onRecordRefresh?: () => void;
};

export function ClientServiceProfilesPanel({ clientId, onRecordRefresh }: Props) {
  const tenantId = useServiceTenantId();
  const { isReadOnly } = usePermissions();
  const { pushModal } = useModalStack();

  const typesQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTenantClientServiceTypes(tenantId);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const profilesQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return listClientServiceProfiles(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );

  const loading = typesQuery.loading || profilesQuery.loading;
  const error = typesQuery.error ?? profilesQuery.error;

  async function handleEndProfile(profileId: string) {
    if (!tenantId || isReadOnly) return;
    const result = await endClientServiceProfile(tenantId, clientId, profileId);
    if (result.ok) {
      await profilesQuery.refresh();
      onRecordRefresh?.();
    }
  }

  async function handleSetPrimary(key: ClientServiceTypeKey) {
    if (!tenantId || isReadOnly) return;
    const result = await setPrimaryClientServiceProfile(tenantId, clientId, key);
    if (result.ok) {
      await profilesQuery.refresh();
      onRecordRefresh?.();
    }
  }

  function openAddModal() {
    pushModal({
      modalKey: 'client.serviceProfile.add',
      title: 'Leistungsbereich hinzufügen',
      payload: { clientId },
    });
  }

  if (loading && !profilesQuery.data) {
    return <LoadingState message="Leistungsbereiche werden geladen…" />;
  }
  if (error && !profilesQuery.data) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          void profilesQuery.refresh();
          void typesQuery.refresh();
        }}
      />
    );
  }

  const profiles = profilesQuery.data ?? [];
  const activeProfiles = profiles.filter((p) => p.status === 'active');
  const tenantTypes = typesQuery.data ?? [];

  return (
    <View style={styles.panel}>
      <SectionPanel title="Leistungsbereiche">
        {activeProfiles.length === 0 ? (
          <EmptyState
            title="Keine Leistungsbereiche konfiguriert"
            message="Leistungsarten werden bei der Aufnahme oder hier als Multi-Select hinterlegt."
            actionLabel={!isReadOnly ? 'Leistungsbereich hinzufügen' : undefined}
            onAction={!isReadOnly ? openAddModal : undefined}
          />
        ) : (
          activeProfiles.map((profile) => (
            <PremiumCard key={profile.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.primary}>
                  {profile.serviceTypeName ??
                    (profile.serviceTypeKey ? CLIENT_SERVICE_TYPE_LABELS[profile.serviceTypeKey] : '') ??
                    profile.serviceTypeKey}
                </Text>
                {profile.isPrimary ? <PremiumBadge label="Primär" variant="cyan" /> : null}
              </View>
              <Text style={styles.secondary}>
                Status: {profile.status}
                {profile.startedOn ? ` · seit ${profile.startedOn}` : ''}
              </Text>
              {!isReadOnly ? (
                <View style={styles.actions}>
                  {!profile.isPrimary && profile.serviceTypeKey ? (
                    <PremiumButton
                      title="Als primär setzen"
                      size="sm"
                      variant="secondary"
                      onPress={() => handleSetPrimary(profile.serviceTypeKey!)}
                    />
                  ) : null}
                  <PremiumButton
                    title="Beenden"
                    size="sm"
                    variant="ghost"
                    onPress={() => handleEndProfile(profile.id)}
                  />
                </View>
              ) : null}
            </PremiumCard>
          ))
        )}
        {!isReadOnly && activeProfiles.length > 0 ? (
          <PremiumButton title="Leistungsbereich hinzufügen" variant="secondary" onPress={openAddModal} />
        ) : null}
      </SectionPanel>

      {profiles.some((p) => p.status === 'ended') ? (
        <SectionPanel title="Beendete Leistungsbereiche">
          {profiles
            .filter((p) => p.status === 'ended')
            .map((profile) => (
              <PremiumCard key={profile.id} style={styles.card}>
                <Text style={styles.primary}>{profile.serviceTypeName ?? profile.serviceTypeKey}</Text>
                <Text style={styles.secondary}>Beendet {profile.endedOn ?? '—'}</Text>
              </PremiumCard>
            ))}
        </SectionPanel>
      ) : null}

      <SectionPanel title="Mandanten-Leistungsarten (Vorlagen)">
        {tenantTypes.length === 0 ? (
          <EmptyState title="Keine Vorlagen" message="Leistungsart-Vorlagen werden beim ersten Zugriff automatisch angelegt." />
        ) : (
          tenantTypes.map((type) => (
            <PremiumCard key={type.id} style={styles.card}>
              <Text style={styles.primary}>{type.name}</Text>
              <Text style={styles.secondary}>{type.description ?? type.serviceTypeKey}</Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

/** Modal-stack form — add service profile */
export function ClientServiceProfileAddModalScreen({
  payload,
}: {
  payload?: { clientId?: string };
}) {
  const clientId = String(payload?.clientId ?? '');
  const tenantId = useServiceTenantId();
  const { closeTopModal } = useModalStack();
  const { isReadOnly } = usePermissions();
  const [selectedKey, setSelectedKey] = useState<ClientServiceTypeKey | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typesQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTenantClientServiceTypes(tenantId);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  async function handleSave() {
    if (!tenantId || !clientId || !selectedKey || isReadOnly) return;
    setSaving(true);
    setError(null);
    const result = await addClientServiceProfile(tenantId, clientId, selectedKey, { notes: notes.trim() || null });
    setSaving(false);
    if (result.ok) {
      closeTopModal();
      return;
    }
    setError(result.error);
  }

  const types = typesQuery.data ?? [];

  return (
    <View style={styles.panel}>
      <SectionPanel title="Leistungsart wählen">
        {types.map((type) => (
          <PremiumButton
            key={type.id}
            title={type.name}
            variant={selectedKey === type.serviceTypeKey ? 'primary' : 'secondary'}
            onPress={() => setSelectedKey(type.serviceTypeKey)}
          />
        ))}
        <PremiumInput label="Notiz (optional)" value={notes} onChangeText={setNotes} multiline />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PremiumButton title="Hinzufügen" loading={saving} onPress={handleSave} />
      </SectionPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, paddingBottom: spacing.lg },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  primary: { ...typography.label },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  error: { ...typography.caption, color: colors.error },
});
