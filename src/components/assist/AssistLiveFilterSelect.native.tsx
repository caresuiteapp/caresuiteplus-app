// Generated native presentation from src/components/assist/AssistLiveFilterSelect.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStyle,NativeSpan,NativeSelect,NativeOption,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
type Props = {
    className: string;
    label: string;
    ariaLabel: string;
    value: string;
    disabled?: boolean;
    options: readonly {
        value: string;
        label: string;
        disabled?: boolean;
    }[];
    onChange: (value: string) => void;
};
const css = `
.cs-live-filter{position:relative}.cs-live-filter[data-open=true]{z-index:20}
.cs-live-filter-trigger{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-width:0;min-height:43px;padding:10px 12px;border:1px solid #cbddeb;border-radius:10px;background:#fff;color:#294e6c;font:inherit;font-size:calc(14px * var(--app-font-scale,1));font-weight:400;line-height:1.4;text-align:left;cursor:pointer;transition:border-color .16s,box-shadow .16s}
.cs-live-filter-trigger:hover{border-color:#86b8df}.cs-live-filter-trigger[aria-expanded=true]{border-color:#458dca;box-shadow:0 0 0 3px #2487dc15}.cs-live-filter-trigger>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cs-live-filter-trigger svg{flex:none;transition:transform .16s}.cs-live-filter-trigger[aria-expanded=true] svg{transform:rotate(180deg)}
.cs-live-filter-list{position:absolute;inset:calc(100% + 6px) 0 auto;margin:0;padding:5px;box-sizing:border-box;max-height:min(290px,45vh);overflow-y:auto;overscroll-behavior:contain;border:1px solid #bfd5e8;border-radius:12px;background:#fff;color:#294e6c;box-shadow:0 12px 32px #17395726;font-family:inherit;font-size:calc(14px * var(--app-font-scale,1));font-weight:400;line-height:1.4;z-index:30;pointer-events:auto}
.cs-live-filter-list::backdrop{background:transparent;pointer-events:none}.cs-live-filter-list[data-fallback=true]{position:static;width:100%;max-height:290px}
.cs-live-filter-option{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:40px;padding:9px 10px;border-radius:7px;cursor:pointer;overflow-wrap:anywhere}.cs-live-filter-option[data-active=true]{background:#eaf4ff;color:#164e7c}.cs-live-filter-option[aria-selected=true]{color:#125d9b;font-weight:650}.cs-live-filter-check{flex:none;width:16px}
@media(prefers-reduced-motion:reduce){.cs-live-filter-trigger,.cs-live-filter-trigger svg{transition:none}}
`;
// Keep the controlled value through refreshed options; Android owns the option modal.
export function AssistLiveFilterSelect({ className, label, ariaLabel, value, options, onChange, disabled = false }: Props) { return <NativeWorkspaceStyleScope css={[css, css]}>{<NativeDiv className={className + ' cs-live-filter'} data-cs-live-filter="native-select-v1"><NativeStyle>{css}</NativeStyle><NativeSpan>{label}</NativeSpan><NativeSelect className="cs-live-filter-trigger" aria-label={ariaLabel} aria-description={options.length ? '' : 'Keine Auswahl verfügbar.'} value={value} disabled={disabled || !options.some(option => !option.disabled)} onChange={event => onChange(event.target.value)}>{options.map(option => <NativeOption key={option.value} value={option.value} disabled={option.disabled}>{option.label}</NativeOption>)}</NativeSelect>{!options.length ? <NativeSpan role="status">Keine Auswahl verfügbar.</NativeSpan> : null}</NativeDiv>}</NativeWorkspaceStyleScope>; }
