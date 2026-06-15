import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AccessCredentialsPanel } from '@/components/auth/AccessCredentialsPanel';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import type { AccessCredentialsReveal } from '@/lib/auth/auth.types';
import { createEmployeePortalAccount } from '@/lib/auth/accessManagementService';
import { demoTenant } from '@/data/demo/tenant';
import { typography } from '@/theme';

export function CreateEmployeePortalAccountScreen() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<AccessCredentialsReveal | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    const result = await createEmployeePortalAccount({
      companyName: demoTenant.name,
      employeeId,
      firstName,
      lastName,
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
      <CareLightPageShell title="Mitarbeiterzugang erstellen" subtitle="Wird erstellt…" scroll>
        <LoadingState message="Portalzugang wird angelegt…" />
      </CareLightPageShell>
    );
  }

  if (credentials) {
    return (
      <CareLightPageShell title="Zugang erstellt" subtitle="Mitarbeitendenportal" scroll>
        <AccessCredentialsPanel
          title="Mitarbeiterzugang erstellt"
          credentials={credentials}
          onClose={() => router.replace('/business/office/access/employee-portal' as never)}
        />
      </CareLightPageShell>
    );
  }

  const isEmpty = !employeeId.trim() && !firstName.trim() && !lastName.trim();

  return (
    <CareLightPageShell title="Mitarbeiterzugang erstellen" subtitle="Mitarbeitendenportal" scroll>
      {isEmpty ? (
        <EmptyState
          title="Neuer Mitarbeiterzugang"
          message="Mitarbeiter-ID und Name erfassen, um einen Portalzugang zu erstellen."
        />
      ) : null}
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      <Text style={styles.hint}>Verknüpfen Sie einen bestehenden Mitarbeitenden-Datensatz.</Text>
      <PremiumInput label="Mitarbeiter-ID" value={employeeId} onChangeText={setEmployeeId} />
      <PremiumInput label="Vorname" value={firstName} onChangeText={setFirstName} />
      <PremiumInput label="Nachname" value={lastName} onChangeText={setLastName} />
      <PremiumButton title="Zugang erstellen" onPress={handleSubmit} loading={loading} fullWidth />
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, marginBottom: 8 },
});
