import { StyleSheet, Text, View } from 'react-native';
import { FilterChipGroup, PremiumButton } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import {
  TRAVEL_POLICY_PRESET_LABELS,
  TRAVEL_ROUTE_TYPE_LABELS,
  type TravelCompensationPolicy,
  type TravelPolicyPreset,
  type TravelRouteType,
} from '@/types/modules/travelCompensation';
import {
  ALL_TRAVEL_ROUTE_TYPES,
  createTravelPolicyFromPreset,
} from '@/lib/travel/travelCompensationPolicy';

const PRESET_OPTIONS = Object.entries(TRAVEL_POLICY_PRESET_LABELS).map(([key, label]) => ({
  key: key as TravelPolicyPreset,
  label,
}));

type RouteListKey = keyof Pick<
  TravelCompensationPolicy,
  'logbookRouteTypes' | 'payrollRouteTypes' | 'workTimeRouteTypes' | 'clientBillingRouteTypes'
>;

const SECTIONS: { key: RouteListKey; label: string; help: string }[] = [
  { key: 'logbookRouteTypes', label: 'Im Fahrtenbuch führen', help: 'Diese Fahrtarten bleiben revisionssicher dokumentiert.' },
  { key: 'payrollRouteTypes', label: 'Kilometer vergüten', help: 'Diese Kilometer fließen automatisch in die Gehaltsstatistik ein.' },
  { key: 'workTimeRouteTypes', label: 'Als Arbeitszeit werten', help: 'Diese Wegezeiten werden im Arbeitszeitkonto berücksichtigt.' },
  { key: 'clientBillingRouteTypes', label: 'Gegenüber Klient:innen abrechnen', help: 'Diese Fahrtarten dürfen als Fahrtkostenposition fakturiert werden.' },
];

export function TravelPolicyEditor({
  value,
  onChange,
  compact = false,
}: {
  value: TravelCompensationPolicy;
  onChange: (value: TravelCompensationPolicy) => void;
  compact?: boolean;
}) {
  const choosePreset = (preset: TravelPolicyPreset) => {
    if (preset === 'custom') onChange({ ...value, preset });
    else onChange(createTravelPolicyFromPreset(preset));
  };

  const toggle = (key: RouteListKey, routeType: TravelRouteType) => {
    const selected = value[key];
    onChange({
      ...value,
      preset: 'custom',
      [key]: selected.includes(routeType)
        ? selected.filter((item) => item !== routeType)
        : [...selected, routeType],
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.block}>
        <Text style={styles.label}>Fahrtkostenmodell</Text>
        <FilterChipGroup options={PRESET_OPTIONS} value={value.preset} onChange={choosePreset} wrap />
      </View>
      {SECTIONS.map((section) => (
        <View key={section.key} style={styles.block}>
          <Text style={styles.label}>{section.label}</Text>
          {!compact ? <Text style={styles.help}>{section.help}</Text> : null}
          <View style={styles.routes}>
            {ALL_TRAVEL_ROUTE_TYPES.map((routeType) => {
              const active = value[section.key].includes(routeType);
              return (
                <PremiumButton
                  key={routeType}
                  title={`${active ? '✓ ' : ''}${TRAVEL_ROUTE_TYPE_LABELS[routeType]}`}
                  variant={active ? 'primary' : 'secondary'}
                  size="sm"
                  onPress={() => toggle(section.key, routeType)}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: careSpacing.md },
  block: { gap: careSpacing.xs },
  label: { fontSize: 13, fontWeight: '700', color: '#111827' },
  help: { fontSize: 12, color: '#475569' },
  routes: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
});
