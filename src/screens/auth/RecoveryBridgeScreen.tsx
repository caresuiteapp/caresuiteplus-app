import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthLoginHero } from '@/components/auth/AuthLoginHero';
import { ScreenShell } from '@/components/layout';
import { ErrorState, PremiumButton, PremiumInput } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';

function extractRecoveryHash(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hashIndex = trimmed.indexOf('#');
  if (hashIndex >= 0) {
    return trimmed.slice(hashIndex);
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hash) return parsed.hash;
  } catch {
    return null;
  }

  return null;
}

export function RecoveryBridgeScreen() {
  const router = useRouter();
  const [brokenUrl, setBrokenUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    setError(null);
    const hash = extractRecoveryHash(brokenUrl);
    if (!hash || !hash.includes('access_token')) {
      setError(
        'Kein gültiger Reset-Link erkannt. Bitte die komplette URL aus der Adresszeile einfügen (ab https://… inkl. #access_token=…).',
      );
      return;
    }

    const target = `/auth/reset-password${hash}`;
    if (typeof globalThis !== 'undefined') {
      const location = (globalThis as { location?: { assign?: (url: string) => void; origin?: string } })
        .location;
      if (location?.assign && location.origin) {
        location.assign(`${location.origin}${target}`);
        return;
      }
    }

    router.replace(target as never);
  };

  return (
    <ScreenShell title="Reset-Link übernehmen" subtitle="Lokaler Workaround" scroll>
      <AuthLoginHero
        eyebrow="PASSWORT"
        title="Reset-Link lokal öffnen"
        subtitle="Wenn der E-Mail-Link auf caresuiteplus.app mit SSL-Fehler endet, den Link hier einfügen."
        portalLabel="Lokaler Dev-Workaround"
        portalVariant="orange"
        icon="🔗"
      />
      <Text style={styles.hint}>
        Kopieren Sie die komplette URL aus der Browser-Adresszeile (auch wenn die Seite einen SSL-Fehler
        zeigt) und fügen Sie sie unten ein. CareSuite+ leitet Sie dann auf localhost weiter.
      </Text>
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      <PremiumInput
        label="URL aus E-Mail / Fehlerseite"
        value={brokenUrl}
        onChangeText={setBrokenUrl}
        placeholder="https://caresuiteplus.app/#access_token=..."
        autoCapitalize="none"
        multiline
      />
      <PremiumButton title="Lokal fortsetzen" onPress={handleContinue} fullWidth />
      <PremiumButton
        title="Zurück"
        variant="secondary"
        onPress={() => router.back()}
        fullWidth
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
});
