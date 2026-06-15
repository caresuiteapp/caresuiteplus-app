import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightScreen } from '@/components/layout';
import { CareLightModuleTile, EmptyState, ErrorState, LoadingState, PremiumInput } from '@/components/ui';
import { CareSuiteBrandHeader } from '@/components/brand';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchAuthPortalOptions } from '@/lib/auth/authLandingService';

export function AuthLandingScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const query = useAsyncQuery(() => fetchAuthPortalOptions(), []);

  const tiles = useMemo(() => {
    const items = query.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  if (query.loading && tiles.length === 0) {
    return (
      <CareLightScreen>
        <LoadingState message="Login-Optionen werden geladen…" />
      </CareLightScreen>
    );
  }

  if (query.error && tiles.length === 0) {
    return (
      <CareLightScreen>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightScreen>
    );
  }

  return (
    <CareLightScreen>
      <CareSuiteBrandHeader
        title="CareSuite+ Login"
        subtitle="Mandanten-Software für Pflege & Betreuung"
      />
      <Text style={styles.hint}>Nur Unternehmen registrieren sich öffentlich</Text>
      <PremiumInput label="Login suchen" value={search} onChangeText={setSearch} placeholder="Unternehmen, Portal…" />
      {tiles.length === 0 ? (
        <EmptyState title="Keine Treffer" message="Passen Sie die Suche an." />
      ) : (
        <View style={styles.grid}>
          {tiles.map((tile) => (
            <CareLightModuleTile
              key={tile.id}
              icon={tile.icon}
              title={tile.title}
              description={tile.description}
              accentColor={tile.accentColor}
              onPress={() => router.push(tile.route as never)}
            />
          ))}
        </View>
      )}
      <Text style={styles.note}>
        Mitarbeitende, Klient:innen und Angehörige erhalten ihren Zugang über CareSuite+ Office /
        Verwaltung.
      </Text>
    </CareLightScreen>
  );
}

const styles = StyleSheet.create({
  hint: { ...careTypography.caption, color: careLightColors.cyan, fontWeight: '700' },
  grid: { gap: careSpacing.md },
  note: { ...careTypography.caption, color: careLightColors.muted, marginTop: careSpacing.sm },
});
