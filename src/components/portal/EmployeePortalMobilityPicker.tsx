import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import {
  ALL_EMPLOYEE_TRANSPORT_MODES,
  EMPLOYEE_TRANSPORT_MODE_ICONS,
  type EmployeeTransportMode,
} from '@/types/modules/employeeMobility';
import { employeePortalExecutionSurface } from '@/lib/portal/employeePortalExecutionSurface';
import { portalPremium } from '@/design/tokens/portalPremium';
import { colors, spacing, typography } from '@/theme';

type Props = {
  value: EmployeeTransportMode | null;
  onChange: (mode: EmployeeTransportMode) => void;
  disabled?: boolean;
  compact?: boolean;
  title?: string;
};

const LABELS: Record<EmployeeTransportMode, string> = {
  car: 'PKW',
  transit: 'ÖPNV',
  bicycle: 'Fahrrad',
  escooter: 'E-Scooter',
  walking: 'Zu Fuß',
};

export function EmployeePortalMobilityPicker({
  value,
  onChange,
  disabled = false,
  compact = false,
  title = 'Wie bist du unterwegs?',
}: Props) {
  const styles = useMemo(() => StyleSheet.create({
    root: {
      gap: spacing.sm,
      padding: compact ? spacing.sm : spacing.md,
      borderWidth: 1,
      borderColor: value ? '#55A8F8' : colors.warning,
      borderRadius: 18,
      backgroundColor: value ? '#EFF7FF' : '#FFF8E8',
    },
    title: { ...typography.bodyStrong, color: portalPremium.text.primary },
    hint: { ...typography.caption, color: portalPremium.text.secondary },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    option: {
      minWidth: compact ? 88 : 104,
      flexGrow: 1,
      flexBasis: compact ? '28%' : '16%',
      minHeight: compact ? 70 : 82,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: employeePortalExecutionSurface.borderStrong,
      borderRadius: 14,
      backgroundColor: employeePortalExecutionSurface.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    optionSelected: {
      borderColor: '#056CE8',
      borderWidth: 2,
      backgroundColor: '#DDEEFF',
    },
    icon: { fontSize: compact ? 25 : 30 },
    label: { ...typography.caption, color: portalPremium.text.primary, fontWeight: '700' },
    logbook: { ...typography.caption, color: '#075985', fontWeight: '700' },
  }), [compact, value]);

  return (
    <View style={styles.root} testID="employee-mobility-picker">
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>
          Vor der Fahrt auswählen. Nur PKW aktiviert das digitale Fahrtenbuch.
        </Text>
      </View>
      <View style={styles.options}>
        {ALL_EMPLOYEE_TRANSPORT_MODES.map((mode) => {
          const selected = value === mode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={`${LABELS[mode]}${mode === 'car' ? ', Fahrtenbuch aktiv' : ''}`}
              disabled={disabled}
              onPress={() => onChange(mode)}
              style={({ pressed }) => [
                styles.option,
                selected ? styles.optionSelected : null,
                pressed ? ({ opacity: 0.78 } as ViewStyle) : null,
              ]}
              testID={`employee-mobility-${mode}`}
            >
              <Text style={styles.icon}>{EMPLOYEE_TRANSPORT_MODE_ICONS[mode]}</Text>
              <Text style={styles.label}>{LABELS[mode]}</Text>
            </Pressable>
          );
        })}
      </View>
      {value ? (
        <Text style={styles.logbook}>
          {value === 'car'
            ? 'PKW gewählt · GPS und Fahrtenbuch werden mit der Fahrt gestartet.'
            : `${LABELS[value]} gewählt · kein PKW-Fahrtenbucheintrag.`}
        </Text>
      ) : null}
    </View>
  );
}
