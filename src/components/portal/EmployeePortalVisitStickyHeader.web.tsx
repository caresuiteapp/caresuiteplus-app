import { useState } from 'react';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARESUITE_VISIT_GUIDE_MASCOT } from '@/components/brand/brandassets';
import { PremiumBadge, PremiumButton } from '@/components/ui';
import { employeePortalExecutionSurface, employeePortalExecutionText } from '@/lib/portal/employeePortalExecutionSurface';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import type { EmployeePortalLiveTimers } from '@/types/modules/employeePortalTracking';
import { spacing, typography } from '@/theme';
import { EmployeePortalVisitProgressSteps } from './EmployeePortalVisitProgressSteps';

type Props = {
  clientName: string; plannedStartAt: string; plannedEndAt: string;
  effectiveStatus: AssignmentStatus; statusLabelOverride?: string;
  timers: EmployeePortalLiveTimers | null;
  requiresSignature?: boolean; signatureCaptured?: boolean; tasksComplete?: boolean;
  documentationComplete?: boolean; serviceEnded?: boolean; showProgress?: boolean;
  onExit?: () => void; guideMessage?: string;
  guideTone?: 'info' | 'warning' | 'error' | 'success';
  guideActionLabel?: string; onGuideAction?: () => void;
  onOpenMedia?: () => void; dayGpsActive?: boolean;
};

function formatLiveTimer(seconds: number): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return two(Math.floor(seconds / 3600)) + ':' + two(Math.floor(seconds % 3600 / 60)) + ':' + two(seconds % 60);
}

export function EmployeePortalVisitStickyHeader(props: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { timers, effectiveStatus, guideMessage, guideActionLabel, onGuideAction } = props;
  const seconds = timers?.activeTimer === 'drive' ? timers.driveSeconds
    : timers?.activeTimer === 'service' ? timers.serviceSeconds
      : timers?.activeTimer === 'pause' ? timers.pauseSeconds : null;
  const timerLabel = timers?.activeTimer === 'drive' ? 'Anfahrt' : timers?.activeTimer === 'pause' ? 'Pause' : 'Einsatzzeit';
  const time = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'Zeit offen';
  return (
    <View style={[styles.root, { paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' as unknown as number }]}>
      <View style={styles.row}>
        <View style={styles.identity}>
          <Text style={styles.clientName} numberOfLines={2}>{props.clientName}</Text>
          <Text style={styles.caption}>{time(props.plannedStartAt)}–{time(props.plannedEndAt)}</Text>
        </View>
        {guideMessage ? (
          <Pressable style={styles.helpButton} accessibilityRole="button" accessibilityLabel="Einsatzbegleiter: Hilfe zum aktuellen Schritt" accessibilityState={{ expanded: helpOpen }} onPress={() => setHelpOpen(true)} testID="employee-visit-guide-toggle">
            <Image source={CARESUITE_VISIT_GUIDE_MASCOT} resizeMode="contain" style={styles.robot} />
            <Text style={styles.info}>i</Text>
          </Pressable>
        ) : null}
        {props.onExit ? <Pressable onPress={props.onExit} style={styles.button} accessibilityRole="button" accessibilityLabel="Einsatz-Arbeitsfläche verlassen"><Text style={styles.buttonText}>← Zurück</Text></Pressable> : null}
      </View>
      <View style={styles.row}>
        <PremiumBadge label={props.statusLabelOverride ?? ASSIGNMENT_STATUS_LABELS[effectiveStatus]} variant={effectiveStatus === 'abgeschlossen' ? 'green' : 'muted'} />
        {props.dayGpsActive ? <PremiumBadge label="GPS · TAG AKTIV" variant="green" dot /> : null}
        {props.onOpenMedia ? <Pressable onPress={props.onOpenMedia} style={styles.button} accessibilityRole="button" accessibilityLabel="Foto, Video oder Datei hinzufügen" testID="employee-visit-media-always-available"><Text style={styles.buttonText}>Medien</Text></Pressable> : null}
        {seconds !== null && Number.isFinite(seconds) ? <Text style={styles.timer} accessibilityLabel={timerLabel + ' ' + formatLiveTimer(seconds) + ' (Std:Min:Sek)'}>{timerLabel} · {formatLiveTimer(Math.max(0, Math.floor(seconds)))}</Text> : null}
      </View>
      {props.showProgress !== false ? <EmployeePortalVisitProgressSteps status={effectiveStatus} requiresSignature={props.requiresSignature} signatureCaptured={props.signatureCaptured} tasksComplete={props.tasksComplete} documentationComplete={props.documentationComplete} serviceEnded={props.serviceEnded} /> : null}
      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <View style={[styles.backdrop, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.helpCard}>
            <ScrollView contentContainerStyle={styles.helpContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.clientName}>Dein nächster Schritt</Text>
              <Text style={styles.helpText} accessibilityLiveRegion="polite">{guideMessage}</Text>
              {guideActionLabel && onGuideAction ? <PremiumButton title={guideActionLabel} fullWidth onPress={() => { setHelpOpen(false); onGuideAction(); }} /> : null}
              <PremiumButton title="Verstanden · zurück zum Einsatz" variant="secondary" fullWidth onPress={() => setHelpOpen(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { backgroundColor: employeePortalExecutionSurface.background, borderBottomWidth: 1, borderBottomColor: employeePortalExecutionSurface.border, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  identity: { flex: 1, minWidth: 100 },
  clientName: { fontSize: font(22), lineHeight: font(28), fontWeight: '800', color: employeePortalExecutionText.primary },
  caption: { fontSize: font(14), lineHeight: font(20), color: employeePortalExecutionText.secondary },
  timer: { fontSize: font(15), lineHeight: font(21), fontWeight: '700', color: employeePortalExecutionText.primary, fontVariant: ['tabular-nums'] },
  button: { minHeight: 44, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: employeePortalExecutionSurface.border, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: font(14), lineHeight: font(20), color: '#056CE8', fontWeight: '700' },
  helpButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF7FF', borderWidth: 1, borderColor: '#8BC2FF' },
  robot: { width: 40, height: 40 },
  info: { position: 'absolute', right: -2, bottom: -2, width: 21, height: 21, borderRadius: 11, textAlign: 'center', lineHeight: 21, backgroundColor: '#056CE8', color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, backgroundColor: 'rgba(2,16,34,0.65)' },
  helpCard: { width: '100%', maxWidth: 520, maxHeight: '100%', borderRadius: 20, backgroundColor: '#FFFFFF' },
  helpContent: { padding: spacing.lg, gap: spacing.lg },
  helpText: { fontSize: font(16), lineHeight: font(24), color: '#10233E' },
});
