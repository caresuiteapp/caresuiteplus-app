import { usePathname, useRouter } from 'expo-router';
import { helpHref } from '@/features/help/helpNavigation';

export function HelpButton({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  return <>
    <style>{`.cs-help-trigger{appearance:none;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:46px;min-width:46px;height:46px;padding:0;border:1px solid rgba(139,211,255,.36);border-radius:15px;background:rgba(8,29,59,.82);color:#e6f7ff;cursor:pointer;transition:background .16s,transform .16s,box-shadow .16s}.cs-help-trigger:hover{background:#123e70;box-shadow:0 4px 18px #45acff38;transform:translateY(-1px)}.cs-help-trigger:focus-visible{outline:3px solid #63c9ff;outline-offset:3px}.cs-help-trigger[data-compact=true]{width:40px;min-width:40px;height:40px;border-radius:12px}.cs-help-trigger[data-light=true]{background:#edf5ff;color:#184e97;border-color:#bad0ed}.cs-help-trigger svg{display:block}@media(prefers-reduced-motion:reduce){.cs-help-trigger{transition:none}.cs-help-trigger:hover{transform:none}}`}</style>
    <button type="button" className="cs-help-trigger" data-compact={compact} data-light={light} aria-label="Hilfe & Anleitungen öffnen" title="Hilfe & Anleitungen" onClick={() => router.push(helpHref(pathname) as never)}>
      <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.3 8.8a2.8 2.8 0 0 1 5.4.9c0 1.9-2.7 2-2.7 3.8M12 16.8h.01"/></svg>
    </button>
  </>;
}
