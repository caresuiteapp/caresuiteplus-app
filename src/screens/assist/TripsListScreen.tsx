import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { ScreenShell } from '@/components/layout';
import { TripsListView } from '@/components/assist/TripsListView';
import { TrackingListView } from '@/components/assist/TrackingListView';
import { EmptyState, ErrorState, LoadingState, SegmentedTabs, type TabOption } from '@/components/ui';
import { auroraGlass, useAuroraGlassPanelStyle } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { usePermissions } from '@/hooks/usePermissions';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useTripList } from '@/hooks/useTripList';
import { fetchTripLogList } from '@/lib/assist/tripLogService';
import { getServiceMode } from '@/lib/services/mode';
import { radius, spacing } from '@/theme';

const webGlassBlur =
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
      } as unknown as ViewStyle)
    : null;

const MOBILITY_TABS: TabOption[] = [
  { key: 'fahrten', label: 'Fahrtenbuch' },
  { key: 'tracking', label: 'Live-Tracking' },
];

export function TripsListScreen({
  onTripPress,
  selectedId,
  embedded = false,
}: {
  onTripPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const { isReadOnly, roleLabel, can } = usePermissions();
  const shellHostsAurora = useShellHostsAurora();
  const panelStyle = useAuroraGlassPanelStyle();
  const canTrips = can('assist.trips.view');
  const canTracking = can('assist.tracking.view');
  const [activeTab, setActiveTab] = useState<'fahrten' | 'tracking'>(canTrips ? 'fahrten' : 'tracking');
  const list = useTripList();
  const roleSubtitle = getServiceMode() === 'supabase' ? roleLabel ?? 'Assist' : roleLabel ?? 'Demo';
  const assistAccent = moduleColor('assist');

  const panelStyles = useMemo(
    () =>
      StyleSheet.create({
        listPanel: { flex: 1, minHeight: 0 },
        listPanelAurora: {
          flex: 1,
          borderRadius: radius.lg,
          overflow: 'hidden',
          ...webGlassBlur,
        },
      }),
    [],
  );

  const visibleTabs = MOBILITY_TABS.filter((tab) => {
    if (tab.key === 'fahrten') return canTrips;
    if (tab.key === 'tracking') return canTracking;
    return false;
  });

  const showTabs = !embedded && visibleTabs.length > 1;

  const content =
    activeTab === 'tracking' && canTracking ? (
      <TrackingListView embedded={embedded} />
    ) : canTrips ? (
      <TripsListView onTripPress={onTripPress} selectedId={selectedId} embedded={embedded} />
    ) : (
      <TrackingListView embedded={embedded} />
    );

  if (embedded) {
    return content;
  }

  if (list.loading && list.allItems.length === 0 && activeTab === 'fahrten') {
    return (
      <ScreenShell title="Mobilität" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Fahrten werden geladen…" />
      </ScreenShell>
    );
  }

  if (list.error && list.allItems.length === 0 && activeTab === 'fahrten') {
    return (
      <ScreenShell title="Mobilität" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </ScreenShell>
    );
  }

  const listBody = (
    <>
      {showTabs ? (
        <SegmentedTabs
          tabs={visibleTabs}
          activeKey={activeTab}
          onSelect={(key) => setActiveTab(key as 'fahrten' | 'tracking')}
          style={styles.tabs}
        />
      ) : null}
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters && activeTab === 'fahrten' ? (
          <EmptyState title="Keine Fahrten" message="Es sind noch keine Fahrten im Fahrtenbuch erfasst." />
        ) : (
          content
        )}
      </View>
    </>
  );

  const wrappedList = shellHostsAurora ? (
    <View style={[panelStyles.listPanel, panelStyles.listPanelAurora, panelStyle]}>{listBody}</View>
  ) : (
    listBody
  );

  return (
    <C14vSubpageShell
      title="Mobilität"
      eyebrow="ASSIST · FAHRTENBUCH"
      subtitle={`Fahrtenbuch & Tracking${isReadOnly ? ' · Lesemodus' : ''} · ${roleSubtitle}`}
      moduleLabel="Assist"
      showBack={false}
      scroll={false}
      accentColor={assistAccent}
    >
      {wrappedList}
    </C14vSubpageShell>
  );
}

void fetchTripLogList;

const styles = StyleSheet.create({
  tabs: { marginBottom: spacing.sm },
  content: { flex: 1 },
});
