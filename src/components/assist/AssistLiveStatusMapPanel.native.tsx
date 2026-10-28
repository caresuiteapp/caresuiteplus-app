// Generated native presentation from src/components/assist/AssistLiveStatusMapPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvg,NativeSvgCircle,NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeSection,NativeStyle,NativeHeader,NativeDiv,NativeH2,NativeP,NativeSpan,NativeI,NativeStrong,NativeA,NativeButton,NativeLabel,NativeInput,NativeDl,NativeDt,NativeDd,NativeDetails,NativeSummary,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useMemo, useState } from 'react';
import type { AssistLiveMonitoringRow } from '@/features/assistLive/getAssistLiveMonitoring';
import type { AssistLiveWorkspaceRow } from '@/features/assistLive/getAssistLiveMonitoringWorkspace';
import type { AssistLiveMapMarker } from '@/lib/assist/assistMapProvider';
import { GoogleMapsLiveMap } from "../maps/GoogleMapsLiveMap.native.tsx";
import { formatLiveMapAge, formatLiveMapDistance, formatLiveMapDuration, getLiveMapPosition, getLiveMapSignal, getLivePlannedRoute, type LiveMapSignal, } from "../../features/assistLive/liveStatusMapPresentation.native.ts";
export type AssistLiveStatusMapPanelProps = {
    row: (AssistLiveMonitoringRow & Partial<Pick<AssistLiveWorkspaceRow, 'trackingError' | 'warnings'>>) | null;
    markers?: AssistLiveMapMarker[];
    selectedAssignmentId?: string | null;
    onMarkerSelect?: (id: string) => void;
    tenantId?: string | null;
    nowMs: number;
    onOpenAssignment?: (assignmentId: string) => void;
    loading?: boolean;
};
const css = `
.lsm-panel{box-sizing:border-box;min-width:0;width:100%;padding:18px;border:1px solid #d8e6f2;border-radius:22px;background:linear-gradient(145deg,#fff,#f5faff);box-shadow:0 8px 30px #173e6a07;color:#15304b;container-type:inline-size}
.lsm-panel *{box-sizing:border-box}.lsm-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}.lsm-header h2{font-size:calc(19px * var(--app-font-scale,1));font-weight:750;line-height:1.3;margin:0 0 4px}.lsm-header p{font-size:calc(13px * var(--app-font-scale,1));line-height:1.5;color:#526b82;margin:0;overflow-wrap:anywhere}.lsm-identity{min-width:0;flex:1 1 190px}.lsm-badge{display:inline-flex;align-items:center;gap:6px;white-space:normal;font-size:calc(12px * var(--app-font-scale,1));font-weight:700;padding:6px 9px;border-radius:10px;background:#edf3f8;color:#526b82}.lsm-badge[data-tone=live]{color:#08745b;background:#e5f6ee}.lsm-badge[data-tone=warning]{color:#935000;background:#fff2dd}.lsm-dot{width:7px;height:7px;flex-shrink:0;border-radius:50%;background:currentColor}.lsm-badge[data-tone=live] .lsm-dot{box-shadow:0 0 0 4px #0c9e7514}.lsm-empty{display:grid;place-content:center;min-height:220px;text-align:center;gap:10px;padding:24px;border:1px dashed #c8ddeb;border-radius:16px;background:radial-gradient(ellipse at 50% 0,#e9f5ff,transparent 75%);color:#536d82}.lsm-empty svg{margin:auto;color:#5290b9}.lsm-empty strong{font-size:calc(16px * var(--app-font-scale,1));color:#244862}.lsm-empty p{font-size:calc(13px * var(--app-font-scale,1));line-height:1.6;margin:0;max-width:400px}.lsm-signal{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;color:#587187;font-size:calc(12px * var(--app-font-scale,1));line-height:1.5;margin:10px 0}.lsm-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}.lsm-button{appearance:none;display:inline-flex;justify-content:center;align-items:center;gap:6px;min-height:36px;padding:8px 12px;border:1px solid #cbdfea;border-radius:11px;background:#fff;color:#245379;font:inherit;font-size:calc(12px * var(--app-font-scale,1));font-weight:650;cursor:pointer;transition:background .16s,border-color .16s,box-shadow .16s}.lsm-button:hover:not(:disabled){background:#eaf5ff;border-color:#81b7dc;box-shadow:0 3px 10px #246d9911}.lsm-button:disabled{opacity:.5;cursor:default}.lsm-button:focus-visible,.lsm-route-toggle input:focus-visible,.lsm-audit summary:focus-visible{outline:3px solid #74baff;outline-offset:3px}.lsm-button--primary{color:white;border-color:#1874c8;background:#1674ca}.lsm-button--primary:hover:not(:disabled){background:#0962b5;color:#fff}.lsm-route-toggle{display:flex;align-items:center;gap:7px;font-size:calc(12px * var(--app-font-scale,1));color:#526a7e;cursor:pointer}.lsm-route-toggle input{accent-color:#1479d2;min-width:16px;min-height:16px}.lsm-route-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:calc(11px * var(--app-font-scale,1));color:#5a7186;line-height:1.5;margin-top:8px}.lsm-route-legend span{display:flex;align-items:center;gap:6px}.lsm-line{width:19px;height:0;border-top:3px solid #0b63f3}.lsm-line--planned{border-top:3px dashed #c48613}.lsm-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:14px 0 0}.lsm-metrics div{min-width:0;padding:11px;border-radius:12px;background:#edf5fc;border:1px solid #e0ebf5}.lsm-metrics dt{font-size:calc(11px * var(--app-font-scale,1));color:#5c7287;line-height:1.45;margin:0 0 4px}.lsm-metrics dd{font-size:calc(16px * var(--app-font-scale,1));line-height:1.4;font-weight:750;margin:0;color:#204968;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.lsm-audit{margin-top:14px;border-top:1px solid #dce8f1;padding-top:12px}.lsm-audit summary{font-size:calc(13px * var(--app-font-scale,1));font-weight:650;cursor:pointer;line-height:1.6;color:#2c5778}.lsm-audit dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}.lsm-audit dl div{min-width:0}.lsm-audit dt{font-size:calc(11px * var(--app-font-scale,1));line-height:1.5;color:#63798c}.lsm-audit dd{font-size:calc(12px * var(--app-font-scale,1));line-height:1.6;font-weight:650;margin:2px 0 0;color:#29475f;overflow-wrap:anywhere}.lsm-notice{font-size:calc(12px * var(--app-font-scale,1));line-height:1.6;color:#496779;margin:12px 0 0;padding:10px 12px;border-radius:10px;background:#edf5fa}.lsm-notice[data-warning=true]{color:#875317;background:#fff5e6}.lsm-subtle{color:#59788f;font-size:calc(12px * var(--app-font-scale,1));line-height:1.5;margin:12px 0 0}@container(max-width:400px){.lsm-header{gap:8px}.lsm-actions>.lsm-button{flex:1}.lsm-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(prefers-reduced-motion:reduce){.lsm-button{transition:none}}
`;
export function AssistLiveStatusMapPanel({ row, markers = [], selectedAssignmentId, onMarkerSelect, tenantId, nowMs, onOpenAssignment, loading = false }: AssistLiveStatusMapPanelProps) {
    const [showPlanned, setShowPlanned] = useState(true);
    const position = getLiveMapPosition(row, nowMs);
    const trackingError = row?.trackingError?.trim() || null;
    const signal: LiveMapSignal = trackingError
        ? { label: position ? 'Letzte bestätigte Position' : 'Standortdaten nicht verfügbar', detail: trackingError, tone: 'warning' }
        : getLiveMapSignal(row, nowMs);
    const warnings = [...new Set(row?.warnings ?? [])].filter(warning => warning.trim() && !trackingError?.includes(warning));
    const route = row?.route;
    const plannedRoute = useMemo(() => getLivePlannedRoute(row?.tracking?.googleRouteReference, nowMs), [row?.tracking?.googleRouteReference, nowMs]);
    const selectedId = row?.assignmentId ?? selectedAssignmentId;
    const mapMarkers = useMemo(() => {
        if (!row || !position)
            return [];
        const otherMarkers = markers.filter(marker => {
            const timestamp = marker.capturedAt ? new Date(marker.capturedAt).getTime() : Number.NaN;
            return marker.id !== row.assignmentId && Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude)
                && Math.abs(marker.latitude) <= 90 && Math.abs(marker.longitude) <= 180
                && Number.isFinite(timestamp) && timestamp <= nowMs && nowMs - timestamp < 45000;
        });
        return [...otherMarkers, { ...position, id: row.assignmentId, label: row.employeeName ?? 'Mitarbeitende nicht zugeordnet', subtitle: `${row.clientName ?? row.title} · ${signal.label}` }];
    }, [markers, nowMs, position, row, signal.label]);
    return <NativeWorkspaceStyleScope css={[css, css]}>{<NativeSection className="lsm-panel" aria-label="Standort und Strecke" data-cs-live-map-panel="web-r1">
    <NativeStyle>{css}</NativeStyle>
    <NativeHeader className="lsm-header">
      <NativeDiv className="lsm-identity"><NativeH2>Standort &amp; Strecke</NativeH2><NativeP>{row ? `${row.employeeName ?? 'Nicht zugeordnet'} · ${row.clientName ?? row.title}` : 'Einsatz auf der Karte verfolgen'}</NativeP></NativeDiv>
      <NativeSpan className="lsm-badge" data-tone={signal.tone}><NativeSpan className="lsm-dot" aria-hidden="true"/>{signal.label}</NativeSpan>
    </NativeHeader>
    {position ? <>
      <GoogleMapsLiveMap position={position} markers={mapMarkers} routePoints={route?.points ?? []} routeSegments={route?.segments ?? []} plannedRoutePoints={showPlanned ? plannedRoute : []} routeIdentity={`${tenantId ?? ''}:${row?.assignmentId ?? ''}`} selectedMarkerId={selectedId} onMarkerSelect={onMarkerSelect} markerLabel={row?.employeeName ?? undefined} height={320} tenantId={tenantId} appearance="light" showMeta={false} showControls/>
      <NativeDiv className="lsm-signal"><NativeSpan>{signal.detail}</NativeSpan>{position.accuracyMeters != null ? <NativeSpan>Genauigkeit ±{Math.round(position.accuracyMeters)} m</NativeSpan> : null}</NativeDiv>
      {(route?.segments.length || plannedRoute.length) ? <NativeDiv className="lsm-route-legend">{route?.segments.length ? <NativeSpan><NativeI className="lsm-line" aria-hidden="true"/>Gemessene GPS-Spur</NativeSpan> : null}{showPlanned && plannedRoute.length ? <NativeSpan><NativeI className="lsm-line lsm-line--planned" aria-hidden="true"/>Berechnete Sollroute</NativeSpan> : null}</NativeDiv> : null}
    </> : <NativeDiv className="lsm-empty" role={loading ? 'status' : undefined}>
      <NativeSvg viewBox="0 0 40 40" width="42" height="42" fill="none" aria-hidden="true"><NativeSvgCircle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="1.5"/><NativeSvgCircle cx="20" cy="20" r="6" stroke="currentColor" strokeWidth="1.5"/><NativeSvgPath d="M20 1v9M20 30v9M1 20h9M30 20h9" stroke="currentColor" strokeWidth="1.5"/></NativeSvg>
      <NativeStrong>{loading && !row ? 'Standorte werden geladen' : signal.label}</NativeStrong><NativeP>{signal.detail}</NativeP>
    </NativeDiv>}
    {position && showPlanned && plannedRoute.length > 1 ? <NativeP className="lsm-subtle">Routing: FOSSGIS · © OpenStreetMap-Mitwirkende · <NativeA href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Kartenfehler melden</NativeA></NativeP> : null}
    {row ? <NativeDiv className="lsm-actions">
      {onOpenAssignment ? <NativeButton type="button" className="lsm-button lsm-button--primary" onClick={() => onOpenAssignment(row.visitId || row.assignmentId)}>Einsatz öffnen</NativeButton> : null}
      {position && plannedRoute.length > 1 ? <NativeLabel className="lsm-route-toggle"><NativeInput type="checkbox" checked={showPlanned} onChange={event => setShowPlanned(event.currentTarget.checked)}/>Sollroute einblenden</NativeLabel> : null}
    </NativeDiv> : null}
    {warnings.map(warning => <NativeP className="lsm-notice" data-warning="true" role="status" key={warning}>{warning}</NativeP>)}
    {route && route.acceptedPointCount > 0 ? <>
      <NativeDl className="lsm-metrics">
        <NativeDiv><NativeDt>Gemessene Strecke</NativeDt><NativeDd>{formatLiveMapDistance(route.measuredDistanceKm)}</NativeDd></NativeDiv>
        <NativeDiv><NativeDt>Bewegungszeit</NativeDt><NativeDd>{formatLiveMapDuration(route.movementDurationSeconds)}</NativeDd></NativeDiv>
        <NativeDiv><NativeDt>Offene GPS-Lücken</NativeDt><NativeDd>{route.unresolvedGapCount}</NativeDd></NativeDiv>
      </NativeDl>
      {route.unresolvedGapCount > 0 ? <NativeP className="lsm-notice" data-warning="true">Die Strecke ist unvollständig. {route.unresolvedGapCount === 1 ? 'Eine GPS-Lücke ist' : `${route.unresolvedGapCount} GPS-Lücken sind`} noch ungeklärt.</NativeP> : null}
      <NativeDetails className="lsm-audit" key={row?.assignmentId}>
        <NativeSummary>Streckenprüfung und GPS-Details</NativeSummary>
        <NativeDl>
          <NativeDiv><NativeDt>Bestätigte GPS-Punkte</NativeDt><NativeDd>{route.acceptedPointCount} · {route.discardedPointCount} verworfen</NativeDd></NativeDiv>
          <NativeDiv><NativeDt>Aufzeichnung</NativeDt><NativeDd>{formatLiveMapDuration(route.durationSeconds)}</NativeDd></NativeDiv>
          <NativeDiv><NativeDt>Letzter GPS-Punkt</NativeDt><NativeDd>{formatLiveMapAge(route.updatedAt, nowMs)}</NativeDd></NativeDiv>
          <NativeDiv><NativeDt>Zusammenhängende Spuren</NativeDt><NativeDd>{route.segments.length}</NativeDd></NativeDiv>
          <NativeDiv><NativeDt>Längste GPS-Lücke</NativeDt><NativeDd>{route.maxGapSeconds > 0 ? formatLiveMapDuration(route.maxGapSeconds) : 'Keine Lücke'}</NativeDd></NativeDiv>
          <NativeDiv><NativeDt>Berechnete Streckenanteile</NativeDt><NativeDd>{formatLiveMapDistance(route.googleGapDistanceKm)} · {route.resolvedGapCount} Lücken ergänzt</NativeDd></NativeDiv>
          <NativeDiv><NativeDt>Strecke einschließlich Berechnung</NativeDt><NativeDd>{formatLiveMapDistance(route.totalDistanceKm)}{route.distanceStatus === 'incomplete' ? ' · unvollständig' : ''}</NativeDd></NativeDiv>
          <NativeDiv><NativeDt>Durchschnitt in Bewegung</NativeDt><NativeDd>{route.averageSpeedKmh != null && Number.isFinite(route.averageSpeedKmh) ? `${route.averageSpeedKmh.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km/h` : '—'}</NativeDd></NativeDiv>
        </NativeDl>
        <NativeP className="lsm-notice">Blaue Linien verbinden nur zusammenhängende GPS-Punkte. Bei einer Unterbrechung bleibt die Spur offen. Die orange Sollroute ist eine berechnete Straßenroute und belegt keine tatsächlich gefahrene Strecke.</NativeP>
      </NativeDetails>
    </> : row && !trackingError ? <NativeP className="lsm-subtle">Für diesen Einsatz liegt noch keine auswertbare GPS-Strecke vor.</NativeP> : null}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
