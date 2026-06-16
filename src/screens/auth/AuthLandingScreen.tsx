import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareSuiteBrandHeader } from '@/components/brand';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { AppScreen, InputField, PortalCard } from '@/design/components';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchAuthPortalOptions } from '@/lib/auth/authLandingService';

export function AuthLandingScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { width } = useDeviceClass();
  const type = useMemo(() => resolveGalaxyTypography(width), [width]);
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
      <AppScreen scroll={false}>
        <LoadingState message="Login-Optionen werden geladen…" />
      </AppScreen>
    );
  }

  if (query.error && tiles.length === 0) {
    return (
      <AppScreen scroll={false}>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <CareSuiteBrandHeader
        title="CareSuite+ Login"
        subtitle="Mandanten-Software für Pflege & Betreuung"
      />
      <Text style={[type.caption, styles.hint]} numberOfLines={2}>
        Nur Unternehmen registrieren sich öffentlich
      </Text>
      <InputField label="Login suchen" value={search} onChangeText={setSearch} placeholder="Unternehmen, Portal…" />
      {tiles.length === 0 ? (
        <EmptyState title="Keine Treffer" message="Passen Sie die Suche an." />
      ) : (
        <View style={styles.grid}>
          {tiles.map((tile) => (
            <PortalCard
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
      <Text style={[type.caption, styles.note]} numberOfLines={4}>
        Mitarbeitende, Klient:innen und Angehörige erhalten ihren Zugang über CareSuite+ Office /
        Verwaltung.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hint: { fontWeight: '700', marginBottom: careSpacing.xs },
  grid: { gap: careSpacing.md },
  note: { marginTop: careSpacing.sm, flexShrink: 1 },
});
