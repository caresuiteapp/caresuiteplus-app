import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

type Props = {
  className: string;
  label: string;
  ariaLabel: string;
  value: string;
  options: readonly { value: string; label: string }[];
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

// Keep the list in the dialog's DOM/focus scope. Its open state is independent of
// live timers and refreshed options; no browser-owned native select is involved.
export function AssistLiveFilterSelect({ className, label, ariaLabel, value, options, onChange }: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState(value);
  const activeIndex = Math.max(0, options.findIndex(option => option.value === activeValue));
  const selected = options.find(option => option.value === value) ?? options[0];
  const optionId = (index: number) => `${id}-option-${index}`;
  const openList = () => { typeahead.current = { text: '', at: 0 }; setActiveValue(selected?.value ?? ''); setOpen(true); };
  const choose = (nextValue: string) => { onChange(nextValue); setOpen(false); triggerRef.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !listRef.current || !triggerRef.current) return;
    const list = listRef.current;
    const trigger = triggerRef.current;
    // The top layer escapes clipped panels while retaining dialog containment.
    // Older browsers get an in-flow list so every option remains reachable.
    if (typeof list.showPopover !== 'function') { list.dataset.fallback = 'true'; return; }
    const place = () => {
      const rect = trigger.getBoundingClientRect();
      const gap = 6;
      const below = Math.max(0, window.innerHeight - rect.bottom - 14);
      const above = Math.max(0, rect.top - 14);
      const upwards = below < 180 && above > below;
      Object.assign(list.style, {
        position: 'fixed', right: 'auto',
        left: `${Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))}px`,
        width: `${Math.min(rect.width, Math.max(0, window.innerWidth - 16))}px`,
        maxHeight: `${Math.min(290, upwards ? above : below)}px`,
        top: upwards ? 'auto' : `${rect.bottom + gap}px`,
        bottom: upwards ? `${window.innerHeight - rect.top + gap}px` : 'auto',
      });
    };
    place();
    list.setAttribute('popover', 'manual');
    try { list.showPopover(); } catch {
      list.removeAttribute('popover'); list.removeAttribute('style'); list.dataset.fallback = 'true'; return;
    }
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(trigger);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const active = list?.children[activeIndex] as HTMLElement | undefined;
    if (!list || !active) return;
    if (active.offsetTop < list.scrollTop) list.scrollTop = active.offsetTop;
    else if (active.offsetTop + active.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = active.offsetTop + active.offsetHeight - list.clientHeight;
    }
  }, [open, activeIndex]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { openList(); return; }
      const next = Math.max(0, Math.min(options.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)));
      setActiveValue(options[next]?.value ?? '');
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); setOpen(true);
      setActiveValue(options[event.key === 'Home' ? 0 : options.length - 1]?.value ?? '');
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open && options[activeIndex]) choose(options[activeIndex].value);
      else openList();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const query = `${now - typeahead.current.at < 700 ? typeahead.current.text : ''}${event.key}`.toLocaleLowerCase('de');
      typeahead.current = { text: query, at: now };
      const match = options.find(option => option.label.toLocaleLowerCase('de').startsWith(query));
      setOpen(true);
      if (match) setActiveValue(match.value);
    }
  };

  return <div ref={rootRef} className={`${className} cs-live-filter`} data-open={open} data-cs-live-filter="controlled-list-v1">
    <style>{css}</style>
    <span id={`${id}-label`}>{label}</span>
    <button ref={triggerRef} type="button" role="combobox" className="cs-live-filter-trigger" aria-label={ariaLabel}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined}
      aria-activedescendant={open && options.length ? optionId(activeIndex) : undefined} value={value}
      onClick={() => open ? setOpen(false) : openList()} onKeyDown={onKeyDown}>
      <span>{selected?.label ?? label}</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    {open && <div ref={listRef} id={`${id}-list`} role="listbox" aria-label={ariaLabel} className="cs-live-filter-list">
      {options.map((option, index) => <div key={option.value} id={optionId(index)} role="option" aria-label={option.label}
        aria-selected={option.value === value} data-value={option.value} data-active={index === activeIndex}
        className="cs-live-filter-option" onMouseDown={event => event.preventDefault()}
        onPointerMove={() => setActiveValue(option.value)} onClick={() => choose(option.value)}>
        <span>{option.label}</span><span className="cs-live-filter-check" aria-hidden="true">{option.value === value ? '✓' : ''}</span>
      </div>)}
    </div>}
  </div>;
}
