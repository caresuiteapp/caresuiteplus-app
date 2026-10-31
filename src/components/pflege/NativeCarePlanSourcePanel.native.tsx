// Generated native presentation from src/components/pflege/NativeCarePlanSourcePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { View } from 'react-native';
import { useFlowRouter } from "../../hooks/useFlowRouter.ts";
import { useNativeCarePlanSource } from "../../hooks/pflege/useNativeCarePlanSource.native.ts";
import { ErrorState, InfoBanner, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import type { NativeCarePlanSourceSelection } from "../../lib/pflege/nativeCarePlanSourceRepository.native.ts";
import { spacing } from '@/theme';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
export function NativeCarePlanSourcePanel(selection: NativeCarePlanSourceSelection) {
    const source = useNativeCarePlanSource(selection), router = useFlowRouter();
    const { c } = useCareLightPalette();
    const snapshot = source.snapshot;
    return <SectionPanel title="Gespeicherter SIS-Bezug" subtitle="Pflegeplan und zugehörige Informationssammlung">
    <View style={{ minWidth: 0, gap: spacing.md }}>
      {!source.available ? <InfoBanner variant="warning" message="Zum Prüfen des gespeicherten Bezugs ist das aktuelle eigene Pflegeplan-Leserecht erforderlich."/> : null}
      {source.loading ? <LoadingState message="Pflegeplan, Klientenzuordnung und gespeicherter SIS-Bezug werden geprüft…"/> : null}
      {source.available && source.error ? <ErrorState message={source.error}/> : null}
      {snapshot ? <>
        <Text style={{ color: c.text, flexShrink: 1 }}>Gespeicherte Pflegeplanversion: {String(snapshot.plan.version)}</Text>
        {snapshot.assessment ? <>
          <Text style={{ color: c.text, flexShrink: 1 }}>Die gespeicherte SIS gehört zum selben Klienten und Mandanten.</Text>
          <Text selectable style={{ color: c.muted, flexShrink: 1 }}>SIS: {String(snapshot.assessment.id)}</Text>
          <InfoBanner variant="info" message="Die Zuordnung wurde gelesen. Fachliche Aktualität und Freigabe sind im SIS-Verlauf getrennt zu prüfen."/>
          <PremiumButton title="Gespeicherte SIS öffnen" loading={source.loading} disabled={source.loading} onPress={() => void source.open(id => router.push(`/pflege/informationssammlung/${id}` as never))}/>
        </> : <InfoBanner variant="info" message="In diesem Pflegeplan ist kein SIS-Bezug gespeichert. Es wird keine Informationssammlung automatisch zugeordnet."/>}
      </> : null}
      {source.available ? <PremiumButton title="Gespeicherten Bezug neu prüfen" variant="secondary" disabled={source.loading} onPress={() => void source.refresh()}/> : null}
    </View>
  </SectionPanel>;
}
