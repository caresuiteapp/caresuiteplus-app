import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AccessListHero } from '@/components/access';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchRolePermissionProfiles } from '@/lib/auth/accessManagementService';
import {
  billingCanViewInvoices,
  employeeCanViewOnlyOwnAssignments,
  pdlCanViewCareDocumentation,
} from '@/lib/auth/permissionService';
import { colors, spacing, typography } from '@/theme';

export function RolePermissionsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [search, setSearch] = useState('');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchRolePermissionProfiles(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const roles = query.data ?? [];
    if (!q) return roles;
    return roles.filter(
      (entry) =>
        entry.role.includes(q) ||
        entry.label.toLowerCase().includes(q) ||
        entry.permissions.some((perm) => perm.moduleKey.toLowerCase().includes(q)),
    );
  }, [query.data, search]);

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Rollen & Rechte" subtitle="Wird geladen…" scroll>
        <LoadingState message="Rollenprofile werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Rollen & Rechte" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Rollen & Rechte" subtitle="Zugänge & Benutzer" scroll>
      <AccessListHero variant="roles" itemCount={filteredRoles.length} />
      <SectionPanel title="Rollenprofile">
        <PremiumInput label="Rolle oder Modul suchen" value={search} onChangeText={setSearch} />
        {filteredRoles.length === 0 ? (
          <EmptyState title="Keine Rollen gefunden" message="Passen Sie die Suche an." />
        ) : (
          filteredRoles.map((entry) => (
            <PremiumCard key={entry.role} accentColor={colors.orange}>
              <Text style={styles.role}>{entry.label}</Text>
              {entry.permissions.length === 0 ? (
                <Text style={styles.meta}>Keine Modul-Overrides — volle Rollenlogik</Text>
              ) : (
                entry.permissions.map((perm) => (
                  <Text key={perm.moduleKey} style={styles.meta}>
                    {perm.moduleKey}: sehen={perm.canView ? 'ja' : 'nein'}, bearbeiten=
                    {perm.canEdit ? 'ja' : 'nein'}
                  </Text>
                ))
              )}
            </PremiumCard>
          ))
        )}
      </SectionPanel>
      <SectionPanel title="Beispielregeln">
        <View style={styles.examples}>
          <Text style={styles.meta}>PDL Pflegedoku: {pdlCanViewCareDocumentation('pdl') ? 'ja' : 'nein'}</Text>
          <Text style={styles.meta}>Buchhaltung Rechnungen: {billingCanViewInvoices('billing') ? 'ja' : 'nein'}</Text>
          <Text style={styles.meta}>
            Mitarbeitende nur eigene Einsätze:{' '}
            {employeeCanViewOnlyOwnAssignments('employee') ? 'ja' : 'nein'}
          </Text>
        </View>
      </SectionPanel>
      <PremiumButton
        title="Modulrechte pro Benutzer"
        onPress={() => router.push('/business/office/access/module-permissions' as never)}
        fullWidth
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  role: { ...typography.bodyStrong, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textSecondary },
  examples: { gap: spacing.xs },
});
