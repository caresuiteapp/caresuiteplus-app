// Generated native presentation from src/components/pflege/NutritionQuantitiesPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { InfoBanner, PremiumInput, SectionPanel } from '@/components/ui';
import { summarizeNutritionQuantities, type NutritionEliminationOriginal } from "../../lib/pflege/nutritionEliminationPacket.native.ts";
import { spacing, typography } from '@/theme';
export function NutritionQuantitiesPanel({ originals, tenantId, clientId }: {
    originals: readonly NutritionEliminationOriginal[];
    tenantId: string;
    clientId: string;
}) {
    const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10) + 'T00:00:00Z'), [end, setEnd] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10) + 'T00:00:00Z');
    const result = useMemo(() => { try {
        return { data: summarizeNutritionQuantities(originals, { tenantId, clientId }, start, end), error: null };
    }
    catch (cause) {
        return { data: null, error: cause instanceof Error ? cause.message : 'Zeitraum nicht auswertbar.' };
    } }, [originals, tenantId, clientId, start, end]);
    const labels: Record<string, string> = { meal_support: 'Tatsächliche Essensaufnahme', drink_protocol: 'Tatsächliche Trinkmenge', documented_input: 'Dokumentierter Einfuhrausschnitt', documented_output: 'Dokumentierter Ausfuhrausschnitt' };
    return <SectionPanel title="Dokumentierte Mengen im Zeitraum">
  <PremiumInput label="Beginn einschließlich, mit Zeitzone" value={start} onChangeText={setStart}/><PremiumInput label="Ende ausschließlich, mit Zeitzone" value={end} onChangeText={setEnd}/>
  {result.error ? <InfoBanner variant="warning" message={result.error}/> : result.data ? <View style={{ gap: spacing.sm }}><Text style={typography.caption}>{result.data.entries} tatsächliche aktuelle Einträge · {result.data.missing} ausdrücklich fehlende Teilwerte</Text>{result.data.groups.length ? result.data.groups.map((g, index) => <Text key={`${g.channel}:${g.unit}:${index}`} style={typography.body}>{labels[g.channel.split(':')[0]] ?? g.channel}: {g.value} {g.unit === 'percent' ? '% einer einzelnen Portion' : g.unit} · {g.count} {g.count === 1 ? 'Wert' : 'Werte'}</Text>) : <Text style={typography.body}>Keine tatsächlichen Mengen in diesem Zeitraum dokumentiert.</Text>}</View> : null}
  <InfoBanner variant="info" message="Angebote, Planungen und berichtigte Vorgänger zählen nicht. Gramm, Milliliter und einzelne Portionsanteile bleiben getrennt. Trinkmengen und Einfuhrausschnitte können dieselbe Beobachtung betreffen und werden nicht zusammengerechnet. Fehlende Werte bleiben unbekannt; diese Ansicht bestätigt keine vollständige klinische Bilanz."/>
 </SectionPanel>;
}
