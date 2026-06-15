import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmployeeFirstLoginHero } from '@/components/auth/EmployeeFirstLoginHero';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput, SuccessState } from '@/components/ui';
import { completeFirstLogin } from '@/lib/auth/employeePortalAuthService';
import { resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import { spacing } from '@/theme';

export function EmployeeFirstLoginPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!acceptedTerms) {
      setError('Bitte bestätigen Sie Datenschutz und Nutzungsbedingungen.');
      return;
    }
    if (!params.accountId) {
      setError('Zugang nicht gefunden.');
      return;
    }

    setError(null);
    setLoading(true);
    const result = await completeFirstLogin({
      accountId: params.accountId,
      currentPassword,
      newPassword,
      confirmPassword,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.replace(resolvePostLoginRoute('employee_portal'));
  };

  return (
    <ScreenShell title="Passwort neu vergeben" subtitle="Erstlogin abschließen" scroll>
      <View style={styles.content}>
        <EmployeeFirstLoginHero />
      </View>
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      <PremiumInput label="Einmalpasswort" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
      <PremiumInput label="Neues Passwort" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
      <PremiumInput label="Passwort bestätigen" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      <PremiumButton
        title={acceptedTerms ? 'Datenschutz bestätigt' : 'Datenschutz / Nutzungsbedingungen bestätigen'}
        variant="secondary"
        onPress={() => setAcceptedTerms(true)}
        fullWidth
      />
      <PremiumButton title="Login abschließen" onPress={handleSubmit} loading={loading} fullWidth />
      <SuccessState message="Nach Abschluss wird das Einmalpasswort ungültig." />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { marginBottom: spacing.md },
});
