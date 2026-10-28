// Generated native presentation from src/components/documents/CentralCatalogQuickInput.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeSpan,NativeSmall,NativeDiv,NativeLabel,NativeTextarea,NativeInput,NativeDetails,NativeSummary} from '@/components/layout/NativeWorkspaceElements.native';
import { useId, useRef, useState, type ReactNode } from 'react';
import { applyCentralQuickChoice, type CentralQuickChoice } from '@/lib/documents/centralCatalogQuickChoices';
type Change = (transform: (current: string) => string) => void;
type Props = {
    label: string;
    suffix?: ReactNode;
    value: string;
    onChange: Change;
    choices: readonly CentralQuickChoice[];
    type?: 'text' | 'multiline' | 'date';
    rows?: number;
    placeholder?: string;
    multiple?: boolean;
    compact?: boolean;
    hiddenLabel?: boolean;
    className?: string;
};
export function CentralCatalogQuickInput({ label, suffix, value, onChange, choices, type = 'multiline', rows = 3, placeholder, multiple = true, compact = false, hiddenLabel = false, className = '' }: Props) {
    const id = useId();
    const dateInput = useRef<HTMLInputElement>(null);
    const [replace, setReplace] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [undo, setUndo] = useState<{
        previous: string;
        next: string;
    }>();
    const selected = (item: CentralQuickChoice) => !!item.value && (value.trim() === item.value || (item.mode === 'unit' ? value.trim().endsWith(` ${item.value}`) : value.split(/\n\s*\n/).some((paragraph) => paragraph.trim() === item.value)));
    const apply = (item: CentralQuickChoice) => {
        const resolved = item.resolveValue ? { ...item, value: item.resolveValue(), resolveValue: undefined } : item;
        const append = multiple && !replace && resolved.mode !== 'restore';
        const next = applyCentralQuickChoice(value, resolved, append);
        if (next === value)
            return;
        setUndo({ previous: value, next });
        onChange((current) => applyCentralQuickChoice(current, resolved, append));
    };
    const pick = (item: CentralQuickChoice, preview = false) => {
        const current = item.resolveValue ? { ...item, value: item.resolveValue() } : item;
        return <NativeButton key={item.key} type="button" className={`csdc-quick-pick ${preview ? 'preview' : ''}`} disabled={!!current.unavailable} aria-pressed={selected(current)} title={current.unavailable || current.value} onClick={() => apply(item)}>
      <NativeSpan>{item.label}</NativeSpan>{preview ? <NativeSmall>{current.unavailable || current.value}</NativeSmall> : null}
    </NativeButton>;
    };
    const write = (text: string) => onChange(() => text);
    return <NativeDiv className={`csdc-field csdc-quick-field ${compact ? 'compact' : ''} ${className}`}>
    <NativeLabel htmlFor={id} className="csdc-quick-field-control">
      <NativeSpan className={compact || hiddenLabel ? 'csdc-sr-only' : ''}>{label}{suffix}</NativeSpan>
      {type === 'multiline' ? <NativeTextarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(event) => write(event.currentTarget.value)}/> : <NativeInput ref={dateInput} id={id} type={type} value={value} onChange={(event) => write(event.currentTarget.value)}/>}
    </NativeLabel>
    <NativeDiv className="csdc-quick" role="group" aria-label={`Schnellauswahl für ${label}`}>
      <NativeDiv className="csdc-quick-first">{!compact ? choices.slice(0, 3).map((item) => pick(item)) : null}
        {type === 'date' ? <NativeButton className="csdc-quick-pick" type="button" onClick={() => { const input = dateInput.current; if (input?.showPicker)
        input.showPicker();
    else
        input?.focus(); }}>Kalender öffnen</NativeButton> : null}
        {undo && value === undo.next ? <NativeButton className="csdc-quick-undo" type="button" onClick={() => { const saved = undo; onChange((current) => current === saved.next ? saved.previous : current); setUndo(undefined); }}>Rückgängig</NativeButton> : null}
      </NativeDiv>
      {choices.length ? <NativeDetails open={expanded} className="csdc-quick-more"><NativeSummary aria-expanded={expanded} onClick={(event) => { event.preventDefault(); setExpanded((value) => !value); }}>{compact ? 'Schnellauswahl' : 'Alle Auswahlen'} <NativeSpan>{choices.length}</NativeSpan></NativeSummary>
        {expanded && multiple && choices.some((item) => item.mode !== 'restore' && !item.unavailable) ? <NativeDiv className="csdc-quick-mode" role="group" aria-label="Einfügeart">
          <NativeButton type="button" aria-pressed={!replace} onClick={() => setReplace(false)}>Ergänzen</NativeButton><NativeButton type="button" aria-pressed={replace} onClick={() => setReplace(true)}>Ersetzen</NativeButton>
        </NativeDiv> : null}
        {expanded ? <NativeDiv className="csdc-quick-options">{choices.map((item) => pick(item, true))}</NativeDiv> : null}
      </NativeDetails> : null}
    </NativeDiv>
  </NativeDiv>;
}
