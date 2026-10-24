// Generated native presentation from src/components/office/ClientFundingSourceSelector.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeFieldset,NativeStyle,NativeLegend,NativeDiv,NativeP,NativeSpan,NativeLabel,NativeInput,NativeSmall,NativeStrong,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useId } from 'react';
import { CLIENT_FUNDING_SOURCE_DESCRIPTIONS, CLIENT_FUNDING_SOURCE_KEYS, CLIENT_FUNDING_SOURCE_LABELS, type ClientFundingSourceKey } from '@/types/clients/clientFundingSource';
/** A selection is a draft until its parent confirms a successful save. */
export function ClientFundingSourceSelector({ values, onChange, error, disabled = false }: {
    values: ClientFundingSourceKey[];
    onChange: (values: ClientFundingSourceKey[]) => void;
    error?: string;
    disabled?: boolean;
}) {
    const id = useId();
    return <NativeWorkspaceStyleScope css={[CSS, CSS]}>{<NativeFieldset className="cs-funding" disabled={disabled} aria-describedby={error ? `${id}-error` : `${id}-hint`}>
    <NativeStyle>{CSS}</NativeStyle>
    <NativeLegend>Finanzierungsarten</NativeLegend>
    <NativeDiv className="cs-funding-heading"><NativeP id={`${id}-hint`}>Vereinbarte Leistungen auswählen. Die Auswahl wird erst mit dem Speichern übernommen.</NativeP><NativeSpan>{values.length} ausgewählt</NativeSpan></NativeDiv>
    <NativeDiv className="cs-funding-grid">{CLIENT_FUNDING_SOURCE_KEYS.map(key => {
            const selected = values.includes(key);
            return <NativeWorkspaceStyleScope css={[CSS]}>{<NativeLabel key={key} className="cs-funding-choice" data-selected={selected}>
        <NativeInput type="checkbox" checked={selected} onChange={() => onChange(selected ? values.filter(value => value !== key) : [...values, key])}/>
        <NativeSpan><NativeSmall>{selected ? 'Ausgewählt' : 'Nicht ausgewählt'}</NativeSmall><NativeStrong>{CLIENT_FUNDING_SOURCE_LABELS[key]}</NativeStrong><NativeSpan>{CLIENT_FUNDING_SOURCE_DESCRIPTIONS[key]}</NativeSpan></NativeSpan>
      </NativeLabel>}</NativeWorkspaceStyleScope>;
        })}</NativeDiv>
    {error ? <NativeP role="alert" id={`${id}-error`} className="cs-funding-error">{error}</NativeP> : null}
  </NativeFieldset>}</NativeWorkspaceStyleScope>;
}
const CSS = `
.cs-funding{border:0;padding:0;margin:0;min-width:0;color:#193953;font:inherit;color-scheme:light}.cs-funding *{box-sizing:border-box}.cs-funding legend{padding:0;font-size:17px;font-weight:750;letter-spacing:-.025em}.cs-funding-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:5px 0 16px}.cs-funding-heading p{margin:0;font-size:12px;line-height:1.6;color:#526c80}.cs-funding-heading>span{padding:4px 9px;background:#edf5fc;border:1px solid #d3e2ef;border-radius:20px;color:#3b607d;font-size:11px;white-space:nowrap}.cs-funding-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:10px}.cs-funding-choice{display:flex;align-items:flex-start;gap:11px;padding:15px;border:1px solid #cbddea;border-radius:15px;background:#fff;cursor:pointer;transition:background .16s,border-color .16s,box-shadow .16s,transform .16s}.cs-funding-choice:hover{background:#f5faff;border-color:#86b6dd;box-shadow:0 5px 16px #1b619410;transform:translateY(-1px)}.cs-funding-choice[data-selected=true]{background:linear-gradient(135deg,#eff7ff,#f6fbff);border-color:#3e89c9;box-shadow:inset 0 0 0 1px #82b8e330}.cs-funding-choice input{accent-color:#116fbd;width:19px;height:19px;flex-shrink:0;margin:3px 0 0}.cs-funding-choice input:focus-visible{outline:3px solid #268bd5;outline-offset:4px}.cs-funding-choice>span{display:grid;gap:5px;min-width:0}.cs-funding-choice strong{font-size:14px;line-height:1.4;overflow-wrap:anywhere}.cs-funding-choice small{font-size:10px;color:#61758a;font-weight:650}.cs-funding-choice[data-selected=true] small{color:#126a56}.cs-funding-choice>span>span{font-size:11px;line-height:1.6;color:#536b80}.cs-funding-error{color:#9b3039!important;font-size:12px!important;margin:12px 0 0!important}.cs-funding:disabled .cs-funding-choice{cursor:default;transform:none}.cs-funding:disabled input{opacity:.65}@media(prefers-reduced-motion:reduce){.cs-funding-choice{transition:none;transform:none!important}}
`.replace(/font-size:(\d+(?:\.\d+)?)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
