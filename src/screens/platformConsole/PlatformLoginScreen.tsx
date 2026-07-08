import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PremiumButton } from '@/components/ui';
import { PLATFORM_COLORS } from '@/components/platformConsole';
import { useAuth } from '@/lib/auth/context';
import { signInPlatformConsole } from '@/lib/platformConsole/platformAuthService';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { getSession } from '@/lib/supabase';
import { spacing } from '@/theme';

function sanitizeRedirect(value: string | undefined): string {
  const redirect = value?.trim() ?? '';
  if (!redirect.startsWith('/platform') || redirect.startsWith('/platform/login')) {
    return '/platform/dashboard';
  }
  return redirect;
}

export function PlatformLoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const { signInWithSupabaseSession } = useAuth();
  const { platformUser, isActivePlatformUser, loading: platformLoading, refresh } = usePlatformAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTarget = useMemo(() => sanitizeRedirect(params.redirect), [params.redirect]);

  useEffect(() => {
    if (platformLoading) return;
    if (platformUser && isActivePlatformUser) {
      router.replace(redirectTarget as never);
    }
  }, [platformLoading, platformUser, isActivePlatformUser, redirectTarget, router]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);

    const result = await signInPlatformConsole(email, password);
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      if (result.code === 'no_platform_access' || result.code === 'platform_disabled') {
        router.replace('/platform/forbidden' as never);
      }
      return;
    }

    const sessionResult = await getSession();
    if (sessionResult.ok && sessionResult.data) {
      await signInWithSupabaseSession(sessionResult.data);
    }

    await refresh();
    setSubmitting(false);
    router.replace(redirectTarget as never);
  }, [email, password, redirectTarget, refresh, router, signInWithSupabaseSession]);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.brand}>CareSuite+ Platform Console</Text>
        <Text style={styles.subtitle}>Nur für autorisierte Plattformadministratoren</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>E-Mail</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="name@example.com"
          placeholderTextColor={PLATFORM_COLORS.muted}
        />

        <Text style={styles.label}>Passwort</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Passwort"
          placeholderTextColor={PLATFORM_COLORS.muted}
        />

        <PremiumButton title="Anmelden" onPress={() => void handleSubmit()} loading={submitting} />

        <Pressable onPress={() => router.replace('/business' as never)}>
          <Text style={styles.backLink}>Zurück zur App</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PLATFORM_COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 12,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  brand: { color: PLATFORM_COLORS.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: PLATFORM_COLORS.muted, fontSize: 13, marginBottom: spacing.sm },
  label: { color: PLATFORM_COLORS.muted, fontSize: 12, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: PLATFORM_COLORS.text,
    backgroundColor: PLATFORM_COLORS.bg,
  },
  error: { color: PLATFORM_COLORS.danger, fontSize: 13, lineHeight: 18 },
  backLink: { color: PLATFORM_COLORS.accent, textAlign: 'center', marginTop: spacing.sm, fontWeight: '600' },
});
