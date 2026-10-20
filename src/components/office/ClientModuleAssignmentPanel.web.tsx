import { PORTAL_MODULE_KEYS } from '@/lib/portal/engine/portalModuleKeys';
import type { PortalModuleKey } from '@/lib/portal/types';
import { portalExperienceCss } from './portalExperienceCss.web';

export const PORTAL_AREA_COPY: Record<PortalModuleKey, { title: string; description: string; detail: string }> = {
  office: { title: 'Verwaltung & Organisation', description: 'Zuordnung zur Verwaltung der Klientenakte und zum allgemeinen Portalbereich.', detail: 'Allgemeine Übersicht' },
  assist: { title: 'Alltagsbegleitung & Betreuung', description: 'Einsätze, Betreuungsteam und Begleitungen im persönlichen Portal zusammenführen.', detail: 'Inhalte nach den geltenden Freigaben' },
  pflege: { title: 'Ambulante Pflege', description: 'Die Akte dem Versorgungsbereich der ambulanten Pflege zuordnen.', detail: 'Noch nicht alle Inhalte im Portal verfügbar' },
  stationaer: { title: 'Stationäre Versorgung', description: 'Die Versorgung in einer Einrichtung für den Portalbereich berücksichtigen.', detail: 'Noch nicht alle Inhalte im Portal verfügbar' },
  beratung: { title: 'Beratung & Begleitung', description: 'Die Akte für Beratungsleistungen und die zugehörige Portalübersicht zuordnen.', detail: 'Noch nicht alle Inhalte im Portal verfügbar' },
  akademie: { title: 'Schulungen', description: 'Die Zuordnung zu Schulungsangeboten hinterlegen.', detail: 'Noch keine eigenen Portalangebote hinterlegt' },
};

type Props = { selected: PortalModuleKey[]; onChange: (modules: PortalModuleKey[]) => void; disabled?: boolean; loading?: boolean };

export function ClientModuleAssignmentPanel({ selected, onChange, disabled = false, loading = false }: Props) {
  return <section className="cs-portal cs-portal-section" aria-label="Betreuungsbereiche auswählen">
    <style>{portalExperienceCss}</style>
    <div className="cs-portal-heading"><div><span className="cs-portal-eyebrow">Persönliche Zuordnung</span><h2>Welche Betreuung erhält die Person?</h2><p>Wählen Sie die passenden Bereiche für ihre Portalübersicht. Mehrere Bereiche können zusammengehören.</p></div><span className="cs-portal-pill">{loading ? 'Wird geladen…' : `${selected.length} ausgewählt`}</span></div>
    <div className="cs-portal-area-grid">
      {PORTAL_MODULE_KEYS.map((key) => <button type="button" className={`cs-portal-area${selected.includes(key) ? ' selected' : ''}`} aria-pressed={selected.includes(key)} disabled={disabled} key={key} onClick={() => onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key])}>
        <span className="cs-portal-area-mark" aria-hidden="true">✓</span><span><strong>{PORTAL_AREA_COPY[key].title}</strong><small>{PORTAL_AREA_COPY[key].description}</small><em>{PORTAL_AREA_COPY[key].detail}</em></span>
      </button>)}
    </div>
    <p className="cs-portal-help">Die Auswahl ordnet die Akte einem Bereich zu. Welche Inhalte im Portal erscheinen, bestimmen die Inhaltsfreigaben und die bereits verfügbaren Funktionen. Jede Änderung wird direkt gespeichert.</p>
  </section>;
}
