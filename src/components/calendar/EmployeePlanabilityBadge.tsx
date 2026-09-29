import { StyleSheet, Text, View } from 'react-native';
import { intervalText, type DayPlanability } from '@/lib/calendar/employeeMonthPlanning';

export function EmployeePlanabilityBadge({ value }: { value: DayPlanability }) {
  const label = value.status === 'available' ? `Planbar: ${intervalText(value.free)}`
    : value.status === 'busy' ? 'Verfügbarkeit belegt'
    : value.status === 'blocked' ? 'Nicht planbar'
    : 'Verfügbarkeit offen';
  return <View style={[styles.box, value.status === 'available' ? styles.available : value.status === 'blocked' ? styles.blocked : styles.unknown]}>
    <Text style={styles.label}>{label}</Text>
    {value.status === 'unknown' && value.blocked.length ? <Text style={styles.detail}>Gesperrt: {intervalText(value.blocked)}</Text> : null}
    {value.conflict ? <Text style={styles.conflict}>! Planungskonflikt</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  box: { borderRadius: 7, padding: 5, marginBottom: 5, borderWidth: 1, gap: 3 },
  available: { backgroundColor: '#DDF6EA', borderColor: '#65B68F' },
  blocked: { backgroundColor: '#FCE5E8', borderColor: '#DB93A0' },
  unknown: { backgroundColor: '#EDF2F8', borderColor: '#B1C1D4' },
  label: { color: '#173859', fontSize: 10, fontWeight: '700' },
  detail: { color: '#52677E', fontSize: 10 }, conflict: { color: '#A91E36', fontSize: 10, fontWeight: '800' },
});
