import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AccessCredentialsPanel } from '@/components/auth/AccessCredentialsPanel';
import { EmployeePortalAccessCandidatePicker } from '@/components/access';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import type { AccessCredentialsReveal } from '@/lib/auth/auth.types';
import { createEmployeePortalAccount } from '@/lib/auth/accessManagementService';
import { useAuth } from '@/lib/auth/context';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import { useServiceTenantId } from '@/hooks/useTenantId';
import type { EmployeePortalAccessCandidate } from '@/types/modules/employeePortalAccess';
import { spacing, typography } from '@/theme';

export function CreateEmployeePortalAccountScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const companyName = useTenantDisplayName();
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeePortalAccessCandidate | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<AccessCredentialsReveal | null>(null);

  const handleSelectEmployee = (candidate: EmployeePortalAccessCandidate | null) => {
    setSelectedEmployee(candidate);
    setError(null);
    if (!candidate) {
      setFirstName('');
      setLastName('');
      return;
    }
    const [first, ...rest] = candidate.fullName.trim().split(/\s+/);
    setFirstName(first ?? '');
    setLastName(rest.join(' '));
  };

  const handleSubmit = async () => {
    if (!tenantId) {
      setError('Kein Mandant aufgelöst.');
      return;
    }
    if (!selectedEmployee) {
      setError('Bitte zuerst eine:n Mitarbeiter:in aus der Liste auswählen.');
      return;
    }
    setError(null);
    setLoading(true);
    const result = await createEmployeePortalAccount({
      tenantId,
      companyName,
      employeeId: selectedEmployee.id,
      firstName,
      lastName,
      createdBy: profile?.id ?? null,
      actorRoleKey: profile?.roleKey,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCredentials(result.data.credentials);
  };

  if (loading) {
    return (
      <ScreenShell title="Mitarbeiterzugang erstellen" subtitle="Wird erstellt…" scroll>
        <LoadingState message="Portalzugang wird angelegt…" />
      </ScreenShell>
    );
  }

  if (credentials) {
    return (
      <ScreenShell title="Zugang erstellt" subtitle="Mitarbeitendenportal" scroll>
        <AccessCredentialsPanel
          title="Mitarbeiterzugang erstellt"
          credentials={credentials}
          onClose={() => router.replace('/business/office/access/employee-portal' as never)}
        />
      </ScreenShell>
    );
  }

  if (!tenantId) {
    return (
      <ScreenShell title="Mitarbeiterzugang erstellen" subtitle="Mitarbeitendenportal" scroll>
        <EmptyState title="Kein Mandant" message="Mandant konnte nicht aufgelöst werden." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Mitarbeiterzugang erstellen" subtitle="Mitarbeitendenportal" scroll>
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      <Text style={styles.hint}>
        Wählen Sie eine:n Mitarbeiter:in anhand der Personalnummer. Bereits angelegte Portalzugänge
        erscheinen nicht in der Liste.
      </Text>

      <EmployeePortalAccessCandidatePicker
        tenantId={tenantId}
        actorRoleKey={profile?.roleKey}
        selectedId={selectedEmployee?.id ?? null}
        onSelect={handleSelectEmployee}
        errorMessage={null}
      />

      {selectedEmployee ? (
        <View style={styles.selectedPanel}>
          <Text style={styles.selectedLabel}>Ausgewählt</Text>
          <Text style={styles.selectedTitle}>
            {selectedEmployee.employeeNumber
              ? `${selectedEmployee.employeeNumber} · ${selectedEmployee.fullName}`
              : selectedEmployee.fullName}
          </Text>
          <PremiumInput label="Vorname" value={firstName} onChangeText={setFirstName} />
          <PremiumInput label="Nachname" value={lastName} onChangeText={setLastName} />
        </View>
      ) : (
        <EmptyState
          title="Noch niemand ausgewählt"
          message="Personalnummer in der Liste anklicken, um den Portalzugang vorzubereiten."
        />
      )}

      <PremiumButton
        title="Zugang erstellen"
        onPress={handleSubmit}
        loading={loading}
        disabled={!selectedEmployee}
        fullWidth
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, marginBottom: spacing.sm },
  selectedPanel: { marginTop: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  selectedLabel: { ...typography.caption, opacity: 0.8 },
  selectedTitle: { ...typography.bodyStrong, marginBottom: spacing.xs },
});
