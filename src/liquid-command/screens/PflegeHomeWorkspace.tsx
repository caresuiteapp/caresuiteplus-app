import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { PflegeDashboardView } from '@/components/dashboard/PflegeDashboardView';
import { usePflegeDashboard } from '@/hooks/usePflegeDashboard';
import { LiquidButton, LiquidState, LiquidStatus, LiquidSurface, LiquidText } from '../components/LiquidPrimitives';
import { liquidSpace } from '../foundation/tokens';
import { LiquidCommandShell } from '../shell/LiquidCommandShell';

export function PflegeHomeWorkspace({ tenantId }: { tenantId: string | null }) {
  const router = useRouter();
  const dashboard = usePflegeDashboard();

  return (
    <LiquidCommandShell
      activeModule="pflege"
      activeArea="home"
      title="Pflege-Startseite"
      subtitle="Pflegelage, Prioritäten, Touren und nächste Entscheidungen"
      contextLabel="Pflege"
      contextDetail={tenantId ? 'Eigenständiger Pflegebereich · Mandant aktiv' : 'Mandantenkontext fehlt'}
      primaryActionLabel="Pflegeeinsatz planen"
      onPrimaryAction={() => router.push('/pflege/planung/new' as never)}
      aside={
        <LiquidSurface solid contentStyle={styles.aside}>
          <LiquidText variant="kicker">SCHNELLZUGRIFF</LiquidText>
          <LiquidText variant="section">Pflegebetrieb</LiquidText>
          <LiquidButton label="Klient:innenakten" onPress={() => router.push('/pflege/klienten' as never)} />
          <LiquidButton label="Pflegepersonalakten" variant="secondary" onPress={() => router.push('/pflege/personal' as never)} />
          <LiquidButton label="Tourenplanung" variant="secondary" onPress={() => router.push('/pflege/tourenplanung' as never)} />
          <LiquidButton label="Dienstplan" variant="secondary" onPress={() => router.push('/pflege/dienstplaene' as never)} />
          <LiquidButton label="Fuhrpark & Inventar" variant="secondary" onPress={() => router.push('/pflege/inventar' as never)} />
          <LiquidStatus label="Pflege eigenständig" tone="success" detail="Keine Navigation nach Assist oder Stationär" />
        </LiquidSurface>
      }
    >
      {!tenantId ? (
        <LiquidState
          kind="error"
          title="Mandantenkontext fehlt"
          message="Die Pflege-Startseite kann erst nach erfolgreicher Mandantenzuordnung geladen werden."
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.actions}>
            <LiquidButton label="Klient:innen" icon="○" onPress={() => router.push('/pflege/klienten' as never)} />
            <LiquidButton label="Pflegepersonal" icon="♙" variant="secondary" onPress={() => router.push('/pflege/personal' as never)} />
            <LiquidButton label="Tour planen" icon="◇" variant="secondary" onPress={() => router.push('/pflege/tourenplanung' as never)} />
            <LiquidButton label="Schicht planen" icon="◷" variant="secondary" onPress={() => router.push('/pflege/dienstplaene/new' as never)} />
            <LiquidButton label="Aktualisieren" icon="↻" variant="ghost" onPress={() => void dashboard.refresh()} />
          </View>
          <PflegeDashboardView
            stats={dashboard.stats}
            activePlans={dashboard.activePlans}
            loading={dashboard.loading}
            error={dashboard.error}
            onRefresh={dashboard.refresh}
          />
        </View>
      )}
    </LiquidCommandShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: liquidSpace[4] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  aside: { padding: liquidSpace[4], gap: 10 },
});
