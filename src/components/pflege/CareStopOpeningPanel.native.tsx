// Generated native presentation from src/components/pflege/CareStopOpeningPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useState } from 'react';
import { View } from 'react-native';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import type { RoleKey } from '@/types';
import { confirmCareStopOpening, confirmPortalCareStopOpening, fetchCareStopOpeningContext, fetchPortalCareStopOpeningContext, type CareStopOpeningContext, } from '@/lib/pflege/careStopOpeningService';
export function CareStopOpeningPanel({ stopId, tenantId, role, portal = false, disabled, onStarted, onNativeStart: _onNativeStart }: {
    stopId: string;
    tenantId?: string | null;
    role?: RoleKey | null;
    portal?: boolean;
    disabled?: boolean;
    onStarted: () => void | Promise<void>;
    onNativeStart: () => void;
}) {
    const { c } = useCareLightPalette();
    const [context, setContext] = useState<CareStopOpeningContext | null>(null);
    const [lastName, setLastName] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    async function open() {
        if (busy || (!portal && !tenantId))
            return;
        setBusy(true);
        setError('');
        setContext(null);
        const result = portal ? await fetchPortalCareStopOpeningContext(stopId) : await fetchCareStopOpeningContext(tenantId!, role, stopId);
        setBusy(false);
        if (!result.ok) {
            setError(result.error);
            return;
        }
        setContext(result.data);
        setLastName('');
        setDateOfBirth('');
    }
    async function confirm() {
        if (!context || busy || !lastName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || (!portal && !tenantId))
            return;
        setBusy(true);
        setError('');
        const result = portal ? await confirmPortalCareStopOpening(context, lastName, dateOfBirth) : await confirmCareStopOpening(tenantId!, role, context, lastName, dateOfBirth);
        setBusy(false);
        if (!result.ok) {
            setError(result.error);
            setContext(null);
            return;
        }
        setContext(null);
        await onStarted();
    }
    if (!context)
        return <View style={{ gap: 8 }}>
    {busy ? <LoadingState message="Aktueller Pflegefall und Pflegeplan werden gebunden…"/> : null}
    {error ? <ErrorState message={error}/> : null}
    <PremiumButton title="Einsatz öffnen" disabled={disabled || busy} onPress={() => void open()}/>
  </View>;
    const warningEntries = Object.entries(context.warnings).filter(([, value]) => value.trim());
    return <SectionPanel title="Einsatz sicher öffnen" subtitle={`${context.clientName} · ${context.serviceSummary}`}>
    <Text style={{ color: c.text }}>Plan: {context.plan.title} · Fassung {context.plan.version} · gültig ab {context.plan.validFrom}{context.plan.validUntil ? ` bis ${context.plan.validUntil}` : ''}</Text>
    {context.plan.items.map((item) => <Text key={String(item.id)} style={{ color: c.text }}>• {String(item.title ?? 'Maßnahme')}{item.timing ? ` · ${String(item.timing)}` : ''}{item.warningSigns ? ` · Warnzeichen: ${String(item.warningSigns)}` : ''}</Text>)}
    {warningEntries.length ? warningEntries.map(([key, value]) => <Text key={key} accessibilityRole="alert" style={{ color: c.text }}>Wichtiger Hinweis: {value}</Text>) : <Text style={{ color: c.muted }}>Im gebundenen Bestand wurden keine zusätzlichen Hinweise geliefert. Das bedeutet nicht „keine Risiken“.</Text>}
    {!context.identity.dateOfBirthAvailable ? <ErrorState message="Für diesen Pflegefall fehlt das Geburtsdatum; der geforderte Identitätsabgleich ist nicht möglich."/> : <>
      <PremiumInput label="Nachname der angetroffenen Person" value={lastName} onChangeText={setLastName} editable={!busy}/>
      <PremiumInput label="Geburtsdatum (JJJJ-MM-TT)" value={dateOfBirth} onChangeText={setDateOfBirth} editable={!busy}/>
      <Text style={{ color: c.muted }}>Der Server gleicht beide Angaben mit genau dem an Tourstopp und Pflegeplan gebundenen Pflegefall ab. Erst danach beginnt die tatsächliche Versorgungszeit.</Text>
      {error ? <ErrorState message={error}/> : null}
      <PremiumButton title="Identität bestätigen und Versorgung starten" disabled={busy || !lastName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)} loading={busy} onPress={() => void confirm()}/>
    </>}
    <PremiumButton title="Aktuellen Stand verwerfen" variant="secondary" disabled={busy} onPress={() => { setContext(null); setError(''); }}/>
  </SectionPanel>;
}
