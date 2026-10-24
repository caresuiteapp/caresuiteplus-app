// Generated native presentation from src/components/office/ClientModuleAssignmentPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeStyle,NativeDiv,NativeSpan,NativeH2,NativeP,NativeButton,NativeStrong,NativeSmall,NativeEm,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { PORTAL_MODULE_KEYS } from '@/lib/portal/engine/portalModuleKeys';
import type { PortalModuleKey } from '@/lib/portal/types';
import { portalExperienceCss } from "./portalExperienceCss.native.ts";
export const PORTAL_AREA_COPY: Record<PortalModuleKey, {
    title: string;
    description: string;
    detail: string;
}> = {
    office: { title: 'Verwaltung & Organisation', description: 'Zuordnung zur Verwaltung der Klientenakte und zum allgemeinen Portalbereich.', detail: 'Allgemeine Übersicht' },
    assist: { title: 'Alltagsbegleitung & Betreuung', description: 'Einsätze, Betreuungsteam und Begleitungen im persönlichen Portal zusammenführen.', detail: 'Inhalte nach den geltenden Freigaben' },
    pflege: { title: 'Ambulante Pflege', description: 'Die Akte dem Versorgungsbereich der ambulanten Pflege zuordnen.', detail: 'Noch nicht alle Inhalte im Portal verfügbar' },
    stationaer: { title: 'Stationäre Versorgung', description: 'Die Versorgung in einer Einrichtung für den Portalbereich berücksichtigen.', detail: 'Noch nicht alle Inhalte im Portal verfügbar' },
    beratung: { title: 'Beratung & Begleitung', description: 'Die Akte für Beratungsleistungen und die zugehörige Portalübersicht zuordnen.', detail: 'Noch nicht alle Inhalte im Portal verfügbar' },
    akademie: { title: 'Schulungen', description: 'Die Zuordnung zu Schulungsangeboten hinterlegen.', detail: 'Noch keine eigenen Portalangebote hinterlegt' },
};
type Props = {
    selected: PortalModuleKey[];
    onChange: (modules: PortalModuleKey[]) => void;
    disabled?: boolean;
    loading?: boolean;
};
export function ClientModuleAssignmentPanel({ selected, onChange, disabled = false, loading = false }: Props) {
    return <NativeWorkspaceStyleScope css={[portalExperienceCss, portalExperienceCss]}>{<NativeSection className="cs-portal cs-portal-section" aria-label="Betreuungsbereiche auswählen">
    <NativeStyle>{portalExperienceCss}</NativeStyle>
    <NativeDiv className="cs-portal-heading"><NativeDiv><NativeSpan className="cs-portal-eyebrow">Persönliche Zuordnung</NativeSpan><NativeH2>Welche Betreuung erhält die Person?</NativeH2><NativeP>Wählen Sie die passenden Bereiche für ihre Portalübersicht. Mehrere Bereiche können zusammengehören.</NativeP></NativeDiv><NativeSpan className="cs-portal-pill">{loading ? 'Wird geladen…' : `${selected.length} ausgewählt`}</NativeSpan></NativeDiv>
    <NativeDiv className="cs-portal-area-grid">
      {PORTAL_MODULE_KEYS.map((key) => <NativeButton type="button" className={`cs-portal-area${selected.includes(key) ? ' selected' : ''}`} aria-pressed={selected.includes(key)} disabled={disabled} key={key} onClick={() => onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key])}>
        <NativeSpan className="cs-portal-area-mark" aria-hidden="true">✓</NativeSpan><NativeSpan><NativeStrong>{PORTAL_AREA_COPY[key].title}</NativeStrong><NativeSmall>{PORTAL_AREA_COPY[key].description}</NativeSmall><NativeEm>{PORTAL_AREA_COPY[key].detail}</NativeEm></NativeSpan>
      </NativeButton>)}
    </NativeDiv>
    <NativeP className="cs-portal-help">Die Auswahl ordnet die Akte einem Bereich zu. Welche Inhalte im Portal erscheinen, bestimmen die Inhaltsfreigaben und die bereits verfügbaren Funktionen. Jede Änderung wird direkt gespeichert.</NativeP>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
