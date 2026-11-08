import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { CareSuiteImage } from '@/components/images/CareSuiteImage';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useEmployeePortalClientInsuranceNumber } from '@/hooks/useEmployeePortalClientRecords';
import type { EmployeePortalClientRecordListItem } from '@/lib/portal/employeePortalClientRecordsService';
import { agendaFocusRing } from './EmployeePortalAgendaAction';
import { clientRecordTextWrap } from './EmployeePortalClientRecordLayout';
import { employeePortalDesign as c } from './employeePortalDesign';

const artwork = {
  dossier: require('../../../../assets/employee-client-records/dossier.webp'),
  phone: require('../../../../assets/employee-client-records/phone.webp'),
  identity: require('../../../../assets/employee-client-records/identity.webp'),
  insurance: require('../../../../assets/employee-client-records/insurance.webp'),
};

const paperInk = '#112E46';
const paperLabel = '#355973';

export function ClientDossierArtwork({ kind, size }: { kind: keyof typeof artwork; size: number }) {
  return <CareSuiteImage source={artwork[kind]} style={{ width: size, height: size, flexShrink: 0 }}
    resizeMode="contain" accessible={false} aria-hidden fadeDuration={0} />;
}

export function ClientDossier({ children, compact = false, tabAccessory }: {
  children: ReactNode; compact?: boolean; tabAccessory?: ReactNode;
}) {
  return (
    <View style={styles.folder}>
      <View style={styles.tabs}>
        <View style={styles.tab}>
          <View style={styles.tabMark} />
          <Text style={styles.tabText}>Klientenakte</Text>
        </View>
        {tabAccessory}
      </View>
      <View style={styles.paperEdge} />
      <View style={[styles.cover, compact && styles.coverCompact]}>
        <LinearGradient colors={['#315674', '#203F58', '#193447']} locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        {children}
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={value ? styles.factValue : styles.missingValue}>{value || 'Nicht hinterlegt'}</Text>
    </View>
  );
}

function InsuranceNumber({ clientId }: { clientId: string }) {
  const { number, loading, error, retry } = useEmployeePortalClientInsuranceNumber(clientId);
  if (loading) {
    return (
      <View style={styles.numberLoading} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={paperInk} />
        <Text style={styles.missingValue}>Wird geladen …</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.fact} accessibilityLiveRegion="polite">
        <Text style={styles.missingValue}>Nummer konnte nicht geladen werden.</Text>
        <Pressable accessibilityRole="button" onPress={() => void retry()}
          style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => [
            styles.numberAction, focused && styles.numberFocus, pressed && styles.pressed,
          ]}>
          <Text style={styles.numberActionText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <Text style={number ? styles.factValue : styles.missingValue} selectable={!!number} accessibilityLiveRegion="polite">
      {number || 'Nicht hinterlegt'}
    </Text>
  );
}

export function ClientDossierFacts({ record, sideBySide }: {
  record: EmployeePortalClientRecordListItem; sideBySide: boolean;
}) {
  const [showNumber, setShowNumber] = useState(false);
  const age = record.age == null ? null : `${record.age} ${record.age === 1 ? 'Jahr' : 'Jahre'}`;

  return (
    <View style={[styles.sheets, sideBySide && styles.sheetsSplit]}>
      <View style={[styles.sheet, sideBySide && styles.identitySheetSplit]}>
        <View style={styles.sheetHeading}>
          <ClientDossierArtwork kind="identity" size={30} />
          <Text style={styles.sheetTitle}>Stammdaten</Text>
        </View>
        <View style={styles.factsRow}>
          <Fact label="Geburtsdatum" value={record.dateOfBirth} />
          <Fact label="Alter" value={age} />
        </View>
      </View>
      <View style={[styles.sheet, styles.insuranceSheet, sideBySide && styles.insuranceSheetSplit]}>
        <View style={styles.sheetHeading}>
          <ClientDossierArtwork kind="insurance" size={30} />
          <Text style={styles.sheetTitle}>Versicherung</Text>
        </View>
        <View style={styles.factsRow}>
          <Fact label={!record.careFundName && record.legacyPayerName ? 'Kostenträger laut Stammdaten' : 'Pflegekasse'}
            value={record.careFundName ?? record.legacyPayerName} />
          <View style={styles.fact}>
            <Text style={styles.factLabel}>Versichertennummer</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showNumber }}
              accessibilityLabel={`Versichertennummer ${showNumber ? 'ausblenden' : 'anzeigen'} für ${record.displayName}`}
              onPress={() => setShowNumber(value => !value)}
              style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
                styles.numberAction, hovered && styles.numberHover, focused && styles.numberFocus, pressed && styles.pressed,
              ]}>
              <Ionicons name={showNumber ? 'eye-off-outline' : 'eye-outline'} size={17} color={paperInk} accessible={false} />
              <Text style={styles.numberActionText}>{showNumber ? 'Ausblenden' : 'Anzeigen'}</Text>
            </Pressable>
            {showNumber ? <InsuranceNumber clientId={record.clientId} /> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  folder: { minWidth: 0, flexShrink: 0, paddingBottom: 4 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 0, paddingRight: 6 },
  tab: {
    flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1, gap: 7, paddingVertical: 6,
    paddingLeft: 12, paddingRight: 20, borderTopLeftRadius: 11, borderTopRightRadius: 20, backgroundColor: '#B7E5F4',
  },
  tabMark: { width: 6, height: 6, borderRadius: 2, backgroundColor: '#18718D' },
  tabText: {
    flexShrink: 1, color: paperInk, fontSize: font(10), lineHeight: font(15), fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1.05, ...clientRecordTextWrap,
  },
  paperEdge: { position: 'absolute', left: 6, right: 5, bottom: 0, height: 24, borderRadius: 15, backgroundColor: '#77A5B9' },
  cover: {
    minWidth: 0, gap: 13, padding: 15, borderWidth: 1, borderColor: '#6590A8',
    borderRadius: 17, borderTopLeftRadius: 0, borderLeftWidth: 3, borderLeftColor: '#B7E5F4',
    backgroundColor: '#203F58', overflow: 'hidden',
  },
  coverCompact: { padding: 10, gap: 10 },
  sheets: { gap: 8, minWidth: 0 },
  sheetsSplit: { flexDirection: 'row' },
  sheet: { minWidth: 0, gap: 5, padding: 9, borderRadius: 10, borderWidth: 1, borderColor: '#B5D5E4', backgroundColor: '#ECF6FA' },
  identitySheetSplit: { flex: 0.85 },
  insuranceSheet: { backgroundColor: '#D9EBF5' },
  insuranceSheetSplit: { flex: 1.15 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  sheetTitle: {
    color: paperInk, flexShrink: 1, fontSize: font(11), lineHeight: font(16), fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.7, ...clientRecordTextWrap,
  },
  factsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 7 },
  fact: { flexGrow: 1, flexShrink: 1, flexBasis: 92, minWidth: 0, gap: 2 },
  factLabel: { color: paperLabel, fontSize: font(11), lineHeight: font(15), ...clientRecordTextWrap },
  factValue: {
    color: paperInk, fontSize: font(14), lineHeight: font(19), fontWeight: '800',
    fontVariant: ['tabular-nums'], ...clientRecordTextWrap,
  },
  missingValue: { color: paperLabel, flexShrink: 1, fontSize: font(12), lineHeight: font(17), ...clientRecordTextWrap },
  numberLoading: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  numberAction: {
    alignSelf: 'flex-start', maxWidth: '100%', minHeight: 44, paddingHorizontal: 8,
    flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8,
    borderWidth: 1, borderColor: '#95B9CE', backgroundColor: '#F2FAFF',
  },
  numberActionText: { color: paperInk, fontWeight: '800', fontSize: font(12), lineHeight: font(17), flexShrink: 1, ...clientRecordTextWrap },
  numberHover: { backgroundColor: '#C2E5F5', borderColor: '#4A7D99' },
  numberFocus: { borderColor: '#356A8A', ...agendaFocusRing },
  pressed: { opacity: 0.8 },
}));
