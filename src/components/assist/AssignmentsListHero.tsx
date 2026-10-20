import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { VisitDispositionKpi } from '@/lib/assist/visitService';
import { ROLE_LABELS } from '@/data/constants';
import { getServiceMode } from '@/lib/services/mode';
import type { RoleKey } from '@/types';

type AssignmentsListHeroProps = {
  kpis: VisitDispositionKpi[];
  roleKey: RoleKey;
  tenantLabel?: string;
  filteredCount: number;
  totalCount: number;
  isReadOnly: boolean;
  compact?: boolean;
  onCalendarPress?: () => void;
};

export function AssignmentsListHero({
  kpis,
  roleKey,
  tenantLabel,
  filteredCount,
  totalCount,
  isReadOnly,
  onCalendarPress,
}: AssignmentsListHeroProps) {
  const isLive = getServiceMode() === 'supabase';

  return (
    <View style={styles.shell}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <View style={styles.eyebrowRow}>
            <View style={styles.liveDot} />
            <Text style={styles.eyebrow}>{isLive ? 'LIVE-DISPOSITION' : 'DISPOSITION'}</Text>
          </View>
          <Text style={styles.title}>Operative Einsatzlage</Text>
          <Text style={styles.meta}>
            {filteredCount === totalCount ? `${totalCount} Einsätze` : `${filteredCount} von ${totalCount} Einsätzen`}
            {tenantLabel ? ` · ${tenantLabel}` : ''} · {ROLE_LABELS[roleKey]}
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
        </View>
        {onCalendarPress ? (
          <Pressable accessibilityRole="button" onPress={onCalendarPress} style={({ pressed }) => [styles.calendarButton, pressed && styles.pressed]}>
            <Ionicons name="calendar-outline" size={17} color="#9DDDFF" />
            <Text style={styles.calendarLabel}>Kalender öffnen</Text>
            <Ionicons name="arrow-forward" size={15} color="#9DDDFF" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.kpiRow}>
        {kpis.slice(0, 4).map((kpi, index) => (
          <View key={kpi.id} style={styles.kpiCard}>
            <View style={[styles.kpiAccent, { backgroundColor: kpi.accentColor ?? (index === 0 ? '#2FA8FF' : '#58D6BE') }]} />
            <View style={styles.kpiCopy}>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <View style={styles.kpiValueRow}>
                <Text style={styles.kpiValue}>{kpi.value}</Text>
                {kpi.subValue ? <Text style={styles.kpiSub}>{kpi.subValue}</Text> : null}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: 16, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(102, 199, 255, 0.30)', backgroundColor: 'rgba(5, 24, 47, 0.88)' },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  copy: { flex: 1, minWidth: 250, gap: 3 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D3A4' },
  eyebrow: { color: '#7CD9FF', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#F7FBFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  meta: { color: '#9CB5CB', fontSize: 12, lineHeight: 18 },
  calendarButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(105, 198, 255, 0.38)', backgroundColor: 'rgba(47, 168, 255, 0.12)' },
  calendarLabel: { color: '#E9F7FF', fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  kpiCard: { flex: 1, minWidth: 145, minHeight: 68, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(121, 191, 235, 0.19)', backgroundColor: 'rgba(12, 42, 73, 0.72)' },
  kpiAccent: { width: 3 },
  kpiCopy: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', gap: 3 },
  kpiLabel: { color: '#8EA9C0', fontSize: 10, fontWeight: '800', letterSpacing: 0.55, textTransform: 'uppercase' },
  kpiValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  kpiValue: { color: '#F7FBFF', fontSize: 21, fontWeight: '800' },
  kpiSub: { flex: 1, color: '#7FA0BB', fontSize: 10 },
});
