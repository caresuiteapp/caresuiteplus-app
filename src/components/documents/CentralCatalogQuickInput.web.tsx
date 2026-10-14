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
  const [undo, setUndo] = useState<{ previous: string; next: string }>();
  const selected = (item: CentralQuickChoice) => !!item.value && (value.trim() === item.value || (item.mode === 'unit' ? value.trim().endsWith(` ${item.value}`) : value.split(/\n\s*\n/).some((paragraph) => paragraph.trim() === item.value)));
  const apply = (item: CentralQuickChoice) => {
    const resolved = item.resolveValue ? { ...item, value: item.resolveValue(), resolveValue: undefined } : item;
    const append = multiple && !replace && resolved.mode !== 'restore';
    const next = applyCentralQuickChoice(value, resolved, append);
    if (next === value) return;
    setUndo({ previous: value, next });
    onChange((current) => applyCentralQuickChoice(current, resolved, append));
  };
  const pick = (item: CentralQuickChoice, preview = false) => {
    const current = item.resolveValue ? { ...item, value: item.resolveValue() } : item;
    return <button key={item.key} type="button" className={`csdc-quick-pick ${preview ? 'preview' : ''}`} disabled={!!current.unavailable} aria-pressed={selected(current)} title={current.unavailable || current.value} onClick={() => apply(item)}>
      <span>{item.label}</span>{preview ? <small>{current.unavailable || current.value}</small> : null}
    </button>;
  };
  const write = (text: string) => onChange(() => text);
  return <div className={`csdc-field csdc-quick-field ${compact ? 'compact' : ''} ${className}`}>
    <label htmlFor={id} className="csdc-quick-field-control">
      <span className={compact || hiddenLabel ? 'csdc-sr-only' : ''}>{label}{suffix}</span>
      {type === 'multiline' ? <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(event) => write(event.currentTarget.value)} /> : <input ref={dateInput} id={id} type={type} value={value} onChange={(event) => write(event.currentTarget.value)} />}
    </label>
    <div className="csdc-quick" role="group" aria-label={`Schnellauswahl für ${label}`}>
      <div className="csdc-quick-first">{!compact ? choices.slice(0, 3).map((item) => pick(item)) : null}
        {type === 'date' ? <button className="csdc-quick-pick" type="button" onClick={() => { const input = dateInput.current; if (input?.showPicker) input.showPicker(); else input?.focus(); }}>Kalender öffnen</button> : null}
        {undo && value === undo.next ? <button className="csdc-quick-undo" type="button" onClick={() => { const saved = undo; onChange((current) => current === saved.next ? saved.previous : current); setUndo(undefined); }}>Rückgängig</button> : null}
      </div>
      {choices.length ? <details open={expanded} className="csdc-quick-more"><summary aria-expanded={expanded} onClick={(event) => { event.preventDefault(); setExpanded((value) => !value); }}>{compact ? 'Schnellauswahl' : 'Alle Auswahlen'} <span>{choices.length}</span></summary>
        {expanded && multiple && choices.some((item) => item.mode !== 'restore' && !item.unavailable) ? <div className="csdc-quick-mode" role="group" aria-label="Einfügeart">
          <button type="button" aria-pressed={!replace} onClick={() => setReplace(false)}>Ergänzen</button><button type="button" aria-pressed={replace} onClick={() => setReplace(true)}>Ersetzen</button>
        </div> : null}
        {expanded ? <div className="csdc-quick-options">{choices.map((item) => pick(item, true))}</div> : null}
      </details> : null}
    </div>
  </div>;
}
