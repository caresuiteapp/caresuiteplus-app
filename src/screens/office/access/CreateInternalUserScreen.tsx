import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AccessCredentialsPanel } from '@/components/auth/AccessCredentialsPanel';
import { ScreenShell } from '@/components/layout';
import { ErrorState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import type { AccessCredentialsReveal, InternalRoleKey } from '@/lib/auth/auth.types';
import { createInternalUser } from '@/lib/auth/accessManagementService';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { spacing, typography } from '@/theme';

const ROLE_OPTIONS: InternalRoleKey[] = [
  'management',
  'pdl',
  'administration',
  'billing',
  'quality_management',
  'team_lead',
  'dispatcher',
  'readonly',
];

export function CreateInternalUserScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const companyName = useTenantDisplayName();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [roleKey, setRoleKey] = useState<InternalRoleKey>('administration');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<AccessCredentialsReveal | null>(null);

  const handleSubmit = async () => {
    if (!tenantId) {
      setError('Kein Mandant aufgelöst.');
      return;
    }
    setError(null);
    setLoading(true);
    const result = await createInternalUser({
      tenantId,
      companyName,
      firstName,
      lastName,
      email,
      roleKey,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCredentials(result.data.credentials);
  };

  if (credentials) {
    return (
      <ScreenShell title="Zugang erstellt" subtitle="Interne:r Benutzer:in" scroll>
        <AccessCredentialsPanel
          title="Zugang erfolgreich erstellt"
          credentials={credentials}
          onClose={() => router.replace('/business/office/access/internal-users' as never)}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Interne:n Benutzer:in anlegen" subtitle="Zugänge & Benutzer" scroll>
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      <PremiumInput label="Vorname" value={firstName} onChangeText={setFirstName} />
      <PremiumInput label="Nachname" value={lastName} onChangeText={setLastName} />
      <PremiumInput label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <SectionPanel title="Rolle">
        <Text style={styles.hint}>Aktuelle Rolle: {roleKey}</Text>
        {ROLE_OPTIONS.map((role) => (
          <PremiumButton
            key={role}
            title={role}
            variant={roleKey === role ? 'primary' : 'secondary'}
            onPress={() => setRoleKey(role)}
            fullWidth
          />
        ))}
      </SectionPanel>
      <PremiumButton title="Zugang erstellen" onPress={handleSubmit} loading={loading} fullWidth />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, marginBottom: spacing.sm },
});
