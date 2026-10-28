// Generated native presentation from src/components/assist/AssignmentFormControls.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {__nativeWorkspaceStyleSheets as __nativeWorkspaceImportedStyles0} from "./AssignmentsWorkspaceShell.native.tsx";
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeStyle,NativeButton,NativeLabel,NativeSpan,NativeTextarea,NativeInput,NativeSection,NativeH3,NativeDiv,NativeStrong,NativeP,NativeSelect,NativeOption,NativeHeader,NativeH2,NativeNav,NativeDl,NativeDt,NativeDd,NativeFooter,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { PlatformModal as NativePlatformModal } from '@/components/layout/platform/platformmodal.tsx';
import { useCallback, useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from "@/hooks/useNativePreventRemove.native";
import type { CatalogItem } from '@/types/assistCatalog';
import type { AssignmentStudioStep } from './AssignmentStudioScaffold';
import { AssignmentsWorkspaceStyles } from "./AssignmentsWorkspaceShell.native.tsx";
export type { AssignmentStudioStep } from './AssignmentStudioScaffold';
const css = `
.aw-workspace.acf-root{padding:0}.acf-root{color:#16324a;color-scheme:light;container-type:inline-size;font:400 calc(14px * var(--app-font-scale,1))/1.5 system-ui,sans-serif;min-width:0}
.acf-root *{box-sizing:border-box}.acf-root button,.acf-root input,.acf-root select,.acf-root textarea{font:inherit}
.aw-workspace.acf-modal{padding:20px}.acf-modal{position:fixed;inset:0;z-index:1300;display:grid;place-items:center;background:rgba(16,42,69,.32);backdrop-filter:blur(14px);padding:20px;overscroll-behavior:contain}
.acf-dialog{width:min(1240px,100%);max-height:calc(100dvh - 40px);display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.9);border-radius:28px;background:linear-gradient(145deg,#fff,#f2f8fd);box-shadow:0 30px 100px #163d6238;color:#16324a;animation:acf-arrive .18s ease-out}
.acf-dialog-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 28px;border-bottom:1px solid #dce8f2}.acf-dialog-header h2{margin:0;font-size:22px;letter-spacing:-.6px}.acf-dialog-header p{margin:4px 0 0;color:#526d83}
.acf-dialog-body{overflow:auto;min-height:0;padding:24px;scrollbar-gutter:stable}.acf-intro{margin:0 0 20px}.acf-intro h2{font-size:24px;letter-spacing:-.6px;margin:0 0 6px}.acf-intro p{margin:0;color:#526d83;max-width:70ch}.acf-step-count{font-size:12px;color:#416b92;font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em}
.acf-layout{display:grid;grid-template-columns:174px minmax(0,1fr);gap:24px;align-items:start}.acf-nav{display:flex;flex-direction:column;gap:6px;position:sticky;top:0}.acf-nav button{border:1px solid transparent;background:transparent;color:#48637b;text-align:left;border-radius:13px;padding:10px 12px;display:flex;align-items:center;gap:10px;cursor:pointer;min-height:44px}.acf-nav button[aria-current=step]{color:#1357b1;background:#e8f2ff;border-color:#b8d5fa;box-shadow:0 4px 12px #1b6ccb0a}.acf-nav button:hover{background:#edf5fc}.acf-nav span{display:grid;place-items:center;width:23px;height:23px;flex-shrink:0;border-radius:8px;background:white;border:1px solid #d6e5f1;font-size:11px;font-weight:750}.acf-content{min-width:0;display:flex;flex-direction:column;gap:18px}.acf-summary{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px 18px;border:1px solid #dce8f2;border-radius:18px;background:#ffffffa6}.acf-summary div{min-width:0}.acf-summary dt{font-size:11px;font-weight:700;color:#637b90;text-transform:uppercase;letter-spacing:.05em}.acf-summary dd{margin:3px 0 0;color:#173b5b;font-weight:600;overflow-wrap:anywhere}.acf-footer{position:sticky;bottom:-24px;margin-top:24px;padding:16px 0 0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:linear-gradient(#f6faffed,#f6faff);border-top:1px solid #d8e6f2;z-index:2}.acf-fields{display:grid;gap:16px;min-width:0}.acf-fields h3{margin:0;font-size:17px;letter-spacing:-.25px}.acf-field{display:grid;gap:6px;margin:0 0 12px;min-width:0}.acf-label{font-size:12px;font-weight:700;color:#36536d}.acf-input{width:100%;min-width:0;min-height:44px;padding:11px 13px;border-radius:12px;border:1px solid #ccdce9;background:#fff;color:#17324b;outline:none;transition:box-shadow .16s,border-color .16s}.acf-input:focus{border-color:#438ee0;box-shadow:0 0 0 3px #3986dd20}.acf-input::placeholder{color:#718498}.acf-input:disabled{background:#edf3f8;color:#6a7f91}.acf-field textarea{min-height:94px;resize:vertical}.acf-choice-list{display:flex;flex-wrap:wrap;gap:8px}.acf-choice{padding:9px 12px;min-height:40px;border:1px solid #d4e1ec;border-radius:12px;background:#fff;color:#36536d;cursor:pointer;text-align:left;overflow-wrap:anywhere;transition:background .15s,border-color .15s}.acf-choice[aria-pressed=true]{background:#e8f3ff;border-color:#7fb4ee;color:#155ba8;font-weight:650}.acf-choice:focus-visible,.acf-nav button:focus-visible{outline:3px solid #418ee244;outline-offset:2px}.acf-choice:disabled{opacity:.55;cursor:not-allowed}.acf-muted{color:#617b90;font-size:12px}.acf-fields>.acf-fields{padding:0;border:0;box-shadow:none}.acf-card{background:#fff;border:1px solid #dce8f2;border-radius:15px;padding:14px}.acf-root fieldset{border:0;min-width:0;margin:0;padding:0}.acf-root fieldset:disabled{opacity:.7}.acf-root fieldset:disabled button{pointer-events:none}.acf-inline-actions{display:flex;flex-wrap:wrap;gap:8px}
@container(max-width:760px){.acf-layout{grid-template-columns:1fr;gap:16px}.acf-nav{position:static;flex-direction:row;overflow:auto;padding-bottom:6px}.acf-nav button{flex-shrink:0}.acf-intro h2{font-size:21px}.acf-summary{grid-template-columns:repeat(2,minmax(0,1fr));padding:12px}.acf-footer{bottom:-16px}}
@container(max-width:420px){.acf-summary{grid-template-columns:1fr}.acf-footer>*{flex:1}.acf-footer button{flex-grow:1}.acf-intro h2{font-size:20px}}
@media(max-width:600px){.aw-workspace.acf-modal{padding:8px}.acf-dialog{max-height:calc(100dvh - 16px);border-radius:20px}.acf-dialog-body{padding:16px}.acf-dialog-header{padding:16px}.acf-dialog-header h2{font-size:20px}}
@keyframes acf-arrive{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.acf-dialog{animation:none}.acf-root *{transition:none!important}}
`.replace(/font-size:(\d+(?:\.\d+)?)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
export function AssignmentFormStyles() { return null; }
export function useAssignmentFormGuard(dirty: boolean, busy: boolean) {
    const window = useNativeWorkflowWindow();
    const navigation = useNavigation();
    const release = useRef(false);
    const current = useRef({ dirty, busy });
    current.current = { dirty, busy };
    const confirmLeave = useCallback(async () => {
        if (release.current)
            return true;
        if (current.current.busy)
            return false;
        const accepted = !current.current.dirty || await confirmNativeWorkspaceAction('Ihre Änderungen sind noch nicht gespeichert. Eingaben verwerfen?');
        if (accepted)
            release.current = true;
        return accepted;
    }, []);
    useEffect(() => { release.current = false; }, [dirty]);
    usePreventRemove(dirty || busy, async ({ data }) => {
        if (await confirmLeave())
            navigation.dispatch(data.action);
    });
    useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (!release.current && (current.current.dirty || current.current.busy)) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, []);
    return { confirmLeave, releaseAfterSave: () => { release.current = true; } };
}
export function PremiumButton({ title, onPress, variant, disabled, loading }: {
    title: string;
    onPress: () => void;
    variant?: string;
    disabled?: boolean;
    loading?: boolean;
    size?: string;
}) { return <NativeWorkspaceStyleScope css={[css]}>{<NativeButton type="button" className={`aw-button ${variant === 'ghost' ? 'aw-button--quiet' : variant === 'secondary' ? '' : 'aw-button--primary'}`} disabled={disabled || loading} aria-busy={loading || undefined} onClick={onPress}>{loading ? 'Wird gespeichert…' : title}</NativeButton>}</NativeWorkspaceStyleScope>; }
type FieldProps = {
    label: string;
    value?: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    multiline?: boolean;
    keyboardType?: string;
    style?: unknown;
    viewContext?: string;
    onDarkSurface?: boolean;
    disabled?: boolean;
};
export function PremiumInput({ label, value = '', onChangeText, placeholder, multiline, keyboardType, disabled }: FieldProps) { return <NativeWorkspaceStyleScope css={[css]}>{<NativeLabel className="acf-field"><NativeSpan className="acf-label">{label}</NativeSpan>{multiline ? <NativeTextarea className="acf-input" value={value} onChange={e => onChangeText(e.target.value)} placeholder={placeholder} disabled={disabled}/> : <NativeInput className="acf-input" value={value} onChange={e => onChangeText(e.target.value)} placeholder={placeholder} disabled={disabled} inputMode={keyboardType === 'numeric' ? 'numeric' : undefined}/>}</NativeLabel>}</NativeWorkspaceStyleScope>; }
type TemporalProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    showFormatHint?: boolean;
    placeholder?: string;
    viewContext?: string;
    onDarkSurface?: boolean;
};
export function CareDateInput({ label, value, onChange }: TemporalProps) { return <NativeWorkspaceStyleScope css={[css]}>{<NativeLabel className="acf-field"><NativeSpan className="acf-label">{label}</NativeSpan><NativeInput className="acf-input" type="date" value={value} onChange={e => onChange(e.target.value)}/></NativeLabel>}</NativeWorkspaceStyleScope>; }
export function CareTimeInput({ label, value, onChange }: TemporalProps) { return <NativeWorkspaceStyleScope css={[css]}>{<NativeLabel className="acf-field"><NativeSpan className="acf-label">{label}</NativeSpan><NativeInput className="acf-input" type="time" step="60" value={value} onChange={e => onChange(e.target.value)}/></NativeLabel>}</NativeWorkspaceStyleScope>; }
export function SectionPanel({ title, children }: {
    title: string;
    children: ReactNode;
    viewContext?: string;
    onDarkSurface?: boolean;
}) { return <NativeWorkspaceStyleScope css={[css]}>{<NativeSection className="aw-panel acf-fields"><NativeH3>{title}</NativeH3>{children}</NativeSection>}</NativeWorkspaceStyleScope>; }
export function InfoBanner({ message, variant = 'info' }: {
    message: string;
    variant?: string;
    onDarkSurface?: boolean;
}) { return <NativeWorkspaceStyleScope css={[css]}>{<NativeDiv className="aw-alert" data-tone={variant === 'danger' ? 'danger' : variant === 'warning' ? 'warning' : variant === 'success' ? 'success' : 'info'} role={variant === 'danger' ? 'alert' : 'status'}>{message}</NativeDiv>}</NativeWorkspaceStyleScope>; }
export function ErrorState({ message, onRetry }: {
    message: string;
    onRetry?: () => void;
}) { return <NativeWorkspaceStyleScope css={[css]}>{<NativeDiv className="aw-alert" data-tone="danger" role="alert">{message}{onRetry ? <NativeButton type="button" className="aw-button" onClick={onRetry}>Erneut laden</NativeButton> : null}</NativeDiv>}</NativeWorkspaceStyleScope>; }
export function LoadingState({ message }: {
    message: string;
}) { return <NativeWorkspaceStyleScope css={[css]}>{<InfoBanner message={message}/>}</NativeWorkspaceStyleScope>; }
export function EmptyState({ title, message }: {
    title: string;
    message: string;
}) { return <NativeWorkspaceStyleScope css={[css]}>{<NativeDiv className="aw-empty"><NativeStrong>{title}</NativeStrong><NativeP>{message}</NativeP></NativeDiv>}</NativeWorkspaceStyleScope>; }
export function PremiumCard({ children, style }: {
    children: ReactNode;
    style?: unknown;
}) { return <NativeWorkspaceStyleScope css={[css]}>{<NativeDiv className="acf-card">{children}</NativeDiv>}</NativeWorkspaceStyleScope>; }
export function PremiumBadge({ label, variant }: {
    label: string;
    variant?: string;
}) { return <NativeWorkspaceStyleScope css={[css]}>{<NativeSpan className="aw-chip">{label}</NativeSpan>}</NativeWorkspaceStyleScope>; }
export function ChipSelect({ label, options, value, onChange, multi = false }: {
    label: string;
    options: {
        value: string;
        label: string;
    }[];
    value: string | string[];
    onChange: (value: any) => void;
    multi?: boolean;
}) {
    const id = useId();
    if (!multi)
        return <NativeWorkspaceStyleScope css={[css]}>{<NativeLabel className="acf-field"><NativeSpan className="acf-label">{label}</NativeSpan><NativeSelect className="acf-input" value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)}><NativeOption value="">Bitte auswählen</NativeOption>{typeof value === 'string' && value && !options.some(o => o.value === value) ? <NativeOption value={value}>Bisherige Auswahl</NativeOption> : null}{options.map(o => <NativeOption key={o.value} value={o.value}>{o.label}</NativeOption>)}</NativeSelect></NativeLabel>}</NativeWorkspaceStyleScope>;
    const values = Array.isArray(value) ? value : [];
    return <NativeWorkspaceStyleScope css={[css]}>{<NativeDiv className="acf-field"><NativeSpan id={id} className="acf-label">{label}</NativeSpan><NativeDiv className="acf-choice-list" role="group" aria-labelledby={id}>{options.map(o => <NativeButton type="button" className="acf-choice" key={o.value} aria-pressed={values.includes(o.value)} onClick={() => onChange(values.includes(o.value) ? values.filter(v => v !== o.value) : [...values, o.value])}>{o.label}</NativeButton>)}</NativeDiv></NativeDiv>}</NativeWorkspaceStyleScope>;
}
export function FilterChipGroup({ options, value, onChange }: {
    options: {
        key: string;
        label: string;
    }[];
    value: string;
    onChange: (value: string) => void;
    wrap?: boolean;
    onDarkSurface?: boolean;
}) { return <NativeWorkspaceStyleScope css={[css]}>{<NativeDiv className="acf-choice-list">{options.map(o => <NativeButton type="button" key={o.key} className="acf-choice" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>{o.label}</NativeButton>)}</NativeDiv>}</NativeWorkspaceStyleScope>; }
export function AssistCatalogGroupedChipSelect({ label, items, value, onChange }: {
    label: string;
    items: CatalogItem[];
    value: string;
    onChange: (value: string) => void;
}) { return <NativeWorkspaceStyleScope css={[css]}>{<ChipSelect label={label} options={items.map(i => ({ value: i.itemKey, label: i.label }))} value={value} onChange={onChange}/>}</NativeWorkspaceStyleScope>; }
export function AssistCatalogMultiSelect({ label, items = [], values, onChange, loading }: {
    label: string;
    items?: CatalogItem[];
    values: string[];
    onChange: (values: string[]) => void;
    loading?: boolean;
}) { return <NativeWorkspaceStyleScope css={[css]}>{<><ChipSelect label={label} options={items.map(i => ({ value: i.itemKey, label: i.label }))} value={values} onChange={onChange} multi/>{loading ? <NativeP className="acf-muted">Auswahl wird geladen…</NativeP> : !items.length ? <NativeP className="acf-muted">Keine Einträge verfügbar.</NativeP> : null}</>}</NativeWorkspaceStyleScope>; }
export function AssignmentStudioScaffold<K extends string>({ steps, activeStep, onStepChange, title, description, summary, children, footer }: {
    steps: readonly AssignmentStudioStep<K>[];
    activeStep: K;
    onStepChange: (key: K) => void;
    title: string;
    description: string;
    summary: readonly {
        label: string;
        value: string;
        icon?: string;
        tone?: string;
    }[];
    children: ReactNode;
    footer?: ReactNode;
}) { return <NativeWorkspaceStyleScope css={[...__nativeWorkspaceStyleSheets["AssignmentFormStyles"], css]}>{<NativeDiv className="aw-workspace acf-root" style={{ padding: 0 }}><AssignmentFormStyles /><NativeHeader className="acf-intro"><NativeDiv className="acf-step-count">Bereich {steps.findIndex(s => s.key === activeStep) + 1} von {steps.length}</NativeDiv><NativeH2>{title}</NativeH2><NativeP>{description}</NativeP></NativeHeader><NativeDiv className="acf-layout"><NativeNav className="acf-nav" aria-label="Bereiche der Einsatzplanung">{steps.map((s, i) => <NativeButton type="button" key={s.key} aria-current={s.key === activeStep ? 'step' : undefined} onClick={() => onStepChange(s.key)}><NativeSpan>{i + 1}</NativeSpan>{s.label}</NativeButton>)}</NativeNav><NativeDiv className="acf-content"><NativeDl className="acf-summary">{summary.map(s => <NativeDiv key={s.label}><NativeDt>{s.label}</NativeDt><NativeDd>{s.value || 'Noch offen'}</NativeDd></NativeDiv>)}</NativeDl>{children}</NativeDiv></NativeDiv><NativeFooter className="acf-footer">{footer}</NativeFooter></NativeDiv>}</NativeWorkspaceStyleScope>; }
export function PlatformModal({ visible, onClose, title, subtitle, children, maxWidth = 1240 }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: ReactNode;
    maxWidth?: number;
    maxHeightRatio?: number;
    glowColor?: string;
    dismissOnBackdrop?: boolean;
    bodyStyle?: unknown;
}) { return <NativeWorkspaceStyleScope css={[...__nativeWorkspaceStyleSheets["AssignmentFormStyles"], css]}>{<NativePlatformModal visible={visible} onClose={onClose} title={title} subtitle={subtitle} maxWidth={maxWidth}><NativeDiv className="aw-workspace acf-root"><AssignmentFormStyles />{children}</NativeDiv></NativePlatformModal>}</NativeWorkspaceStyleScope>; }

export const __nativeWorkspaceStyleSheets = { "AssignmentFormStyles": [...__nativeWorkspaceImportedStyles0["AssignmentsWorkspaceStyles"], css] };
