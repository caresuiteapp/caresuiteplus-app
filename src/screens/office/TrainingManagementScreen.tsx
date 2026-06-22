import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScreenShell } from '@/components/layout';
import { InfoBanner, LoadingState, PremiumCard, SectionPanel } from '@/components/ui';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { usePermissions } from '@/hooks/usePermissions';
import {
  TRAINING_PREPARED_MESSAGE,
  TRAINING_VIEW_LABELS,
  TRAINING_VIEW_ROUTES,
  fetchTrainingDashboard,
  isTrainingLiveReady,
  isTrainingWiringPrepared,
} from '@/lib/training';
import type { TrainingDashboardTile, TrainingViewKey } from '@/types/modules/training';
import { colors, spacing, typography } from '@/theme';

function Tile({ tile }: { tile: TrainingDashboardTile }) {
  return (
    <PremiumCard style={styles.tile} accentColor={tile.accentColor}>
      <Text style={styles.tileValue}>{tile.value}</Text>
      <Text style={styles.tileLabel}>{tile.label}</Text>
      <Text style={styles.tileSub}>{tile.subValue}</Text>
    </PremiumCard>
  );
}

export function TrainingManagementScreen() {
  const router = useRouter();
  const { roleKey } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [tiles, setTiles] = useState<TrainingDashboardTile[]>([]);
  const [views, setViews] = useState<TrainingViewKey[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchTrainingDashboard(DEMO_TENANT_ID, roleKey).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setError(result.error);
      } else {
        setTiles(result.data.tiles);
        setViews(result.data.views);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [roleKey]);

  if (loading) {
    return (
      <ScreenShell title="Schulungen & Zertifikate" subtitle="Personal">
        <LoadingState message="Schulungsübersicht wird geladen…" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Schulungen & Zertifikate" subtitle="Mehr → Personal">
      {!isTrainingLiveReady() && isTrainingWiringPrepared() ? (
        <InfoBanner message={TRAINING_PREPARED_MESSAGE} variant="info" />
      ) : null}
      {error ? <InfoBanner message={error} variant="warning" /> : null}

      <SectionPanel title="Dashboard">
        <View style={styles.tileGrid}>
          {tiles.map((tile) => (
            <Tile key={tile.id} tile={tile} />
          ))}
        </View>
      </SectionPanel>

      <SectionPanel title="Bereiche">
        {views.map((viewKey) => (
          <PremiumCard
            key={viewKey}
            style={styles.viewCard}
            onPress={() => router.push(TRAINING_VIEW_ROUTES[viewKey] as never)}
          >
            <Text style={styles.viewTitle}>{TRAINING_VIEW_LABELS[viewKey]}</Text>
            <Text style={styles.viewHint}>{TRAINING_VIEW_ROUTES[viewKey] ?? TRAINING_VIEW_ROUTES.dashboard}</Text>
          </PremiumCard>
        ))}
      </SectionPanel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    minWidth: 140,
    flexGrow: 1,
  },
  tileValue: {
    ...typography.kpi,
    color: colors.textPrimary,
  },
  tileLabel: {
    ...typography.body,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  tileSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  viewCard: {
    marginBottom: spacing.sm,
  },
  viewTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  viewHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
