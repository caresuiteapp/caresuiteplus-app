import { getEmployeePortalImpactSummary } from '@/lib/portal/portalVisibilityService';

const FIELD_LABELS: Record<string, string> = { displayName: 'Name', street: 'Straße', zip: 'Postleitzahl', city: 'Ort', phone: 'Telefon', accessHint: 'Zugangshinweise', emergencyContact: 'Notfallkontakt' };

export function ClientPortalEmployeeVisibility() {
  const impact = getEmployeePortalImpactSummary();
  return <section aria-label="Angaben für Mitarbeitende">
    <h3>Informationen für zugewiesene Einsätze</h3>
    <p>Mitarbeitende sehen die Angaben, die sie für ihre eigenen Einsätze benötigen.</p>
    <div className="cs-portal-badges" style={{ marginTop: 12 }}>{impact.allowedClientFields.map((field) => <span className="cs-portal-pill" key={field}>{FIELD_LABELS[field] ?? 'Freigegebene Einsatzangabe'}</span>)}</div>
    <p className="cs-portal-help">Die vollständige Akte, Budgets, Rechnungen und interne Verwaltungsnotizen sind in dieser Einsatzansicht nicht sichtbar. Einstellungen zu diesen Angaben werden hier nicht verändert.</p>
  </section>;
}
