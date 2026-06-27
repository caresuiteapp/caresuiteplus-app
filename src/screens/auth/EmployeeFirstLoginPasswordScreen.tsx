import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmployeeFirstLoginHero } from '@/components/auth/EmployeeFirstLoginHero';
import { ScreenShell } from '@/components/layout';
import { ErrorState, PremiumButton, PremiumInput, SuccessState } from '@/components/ui';
import { completeFirstLogin } from '@/lib/auth/employeePortalAuthService';
import { resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import { markPortalWelcomePending } from '@/lib/auth/portalWelcomeSession';
import { useAuth } from '@/lib/auth/context';
import { spacing } from '@/theme';

export function EmployeeFirstLoginPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const { portalSession, updatePortalSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const accountId = params.accountId ?? portalSession?.accountId;
  const skipCurrentPassword =
    portalSession?.loginType === 'employee_portal' &&
    portalSession.mustChangePassword === true &&
    Boolean(portalSession.sessionToken);

  const handleSubmit = async () => {
    if (!acceptedTerms) {
      setError('Bitte bestätigen Sie Datenschutz und Nutzungsbedingungen.');
      return;
    }
    if (!accountId) {
      setError('Zugang nicht gefunden.');
      return;
    }

    setError(null);
    setLoading(true);
    const result = await completeFirstLogin({
      accountId,
      sessionToken: portalSession?.sessionToken,
      currentPassword: skipCurrentPassword ? undefined : currentPassword,
      newPassword,
      confirmPassword,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    await updatePortalSession({ mustChangePassword: false });
    markPortalWelcomePending('employee');
    setCompleted(true);
    router.replace(resolvePostLoginRoute('employee_portal') as never);
  };

  return (
    <ScreenShell title="Bitte vergeben Sie ein eigenes Passwort." subtitle="Erstlogin abschließen" scroll>
      <View style={styles.content}>
        <EmployeeFirstLoginHero />
      </View>
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      {!skipCurrentPassword ? (
        <PremiumInput
          label="Einmalpasswort"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
      ) : null}
      <PremiumInput label="Neues Passwort" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
      <PremiumInput
        label="Passwort bestätigen"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <PremiumButton
        title={acceptedTerms ? 'Datenschutz bestätigt' : 'Datenschutz / Nutzungsbedingungen bestätigen'}
        variant="secondary"
        onPress={() => setAcceptedTerms(true)}
        fullWidth
      />
      <PremiumButton title="Passwort speichern" onPress={handleSubmit} loading={loading} fullWidth />
      {completed ? (
        <SuccessState message="Passwort gespeichert — Weiterleitung zum Mitarbeiterportal…" />
      ) : (
        <SuccessState message="Nach Abschluss wird das Einmalpasswort ungültig." />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { marginBottom: spacing.md },
});
