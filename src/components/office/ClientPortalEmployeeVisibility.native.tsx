// Generated native presentation from src/components/office/ClientPortalEmployeeVisibility.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeH3,NativeP,NativeDiv,NativeSpan} from '@/components/layout/NativeWorkspaceElements.native';
import { getEmployeePortalImpactSummary } from '@/lib/portal/portalVisibilityService';
const FIELD_LABELS: Record<string, string> = { displayName: 'Name', street: 'Straße', zip: 'Postleitzahl', city: 'Ort', phone: 'Telefon', accessHint: 'Zugangshinweise', emergencyContact: 'Notfallkontakt' };
export function ClientPortalEmployeeVisibility() {
    const impact = getEmployeePortalImpactSummary();
    return <NativeSection aria-label="Angaben für Mitarbeitende">
    <NativeH3>Informationen für zugewiesene Einsätze</NativeH3>
    <NativeP>Mitarbeitende sehen die Angaben, die sie für ihre eigenen Einsätze benötigen.</NativeP>
    <NativeDiv className="cs-portal-badges" style={{ marginTop: 12 }}>{impact.allowedClientFields.map((field) => <NativeSpan className="cs-portal-pill" key={field}>{FIELD_LABELS[field] ?? 'Freigegebene Einsatzangabe'}</NativeSpan>)}</NativeDiv>
    <NativeP className="cs-portal-help">Die vollständige Akte, Budgets, Rechnungen und interne Verwaltungsnotizen sind in dieser Einsatzansicht nicht sichtbar. Einstellungen zu diesen Angaben werden hier nicht verändert.</NativeP>
  </NativeSection>;
}
