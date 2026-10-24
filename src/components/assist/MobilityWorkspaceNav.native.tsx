// Generated native presentation from src/components/assist/MobilityWorkspaceNav.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgCircle,NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeNav,NativeStyle,NativeA,NativeSpan,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { WebActionIcon } from "../icons/WebActionIcon.native.tsx";
import type { MouseEvent, ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePermissions } from '@/hooks/usePermissions';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import type { PermissionKey } from '@/types/permissions';
export type MobilityWorkspaceSection = 'tours' | 'replacement' | 'journal' | 'tracking';
const entries: {
    key: MobilityWorkspaceSection;
    label: string;
    href: string;
    permission: PermissionKey;
}[] = [
    { key: 'tours', label: 'Tourenplanung', href: '/assist/touren', permission: 'assist.assignments.view' },
    { key: 'replacement', label: 'Touren & Vertretung', href: '/assist/touren-vertretung', permission: 'assist.assignments.view' },
    { key: 'journal', label: 'Fahrtenbuch', href: '/assist/fahrten?tab=fahrten', permission: 'assist.trips.view' },
    { key: 'tracking', label: 'Tracking', href: '/assist/fahrten?tab=tracking', permission: 'assist.tracking.view' },
];
const icons: Record<MobilityWorkspaceSection, ReactNode> = {
    tours: <><NativeSvgCircle cx="6" cy="5" r="2"/><NativeSvgCircle cx="18" cy="19" r="2"/><NativeSvgPath d="M6 7v8a4 4 0 0 0 4 4h6M8 5h6a4 4 0 0 1 0 8h-4"/></>,
    replacement: <><NativeSvgCircle cx="8" cy="6" r="3"/><NativeSvgPath d="M2 20v-3a6 6 0 0 1 10-4M15 7h7m-3-3 3 3-3 3M22 17h-7m3-3-3 3 3 3"/></>,
    journal: <><NativeSvgPath d="M4 3h14a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V3Zm0 14h16M8 7h8M8 11h5"/></>,
    tracking: <><NativeSvgPath d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><NativeSvgCircle cx="12" cy="10" r="2.5"/></>,
};
const styles = `
.mw-nav{display:flex;flex-wrap:wrap;align-items:stretch;gap:6px;flex-shrink:0;min-width:0;padding:5px;border:1px solid #d5e3ef;border-radius:15px;background:linear-gradient(120deg,#f7fbff,#edf5fc);box-shadow:inset 0 1px 0 #fff}
.mw-nav a{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:0;min-height:38px;padding:8px 13px;border:1px solid transparent;border-radius:10px;color:#426179;background:transparent;font:inherit;font-size:calc(12px * var(--app-font-scale,1));font-weight:650;line-height:1.4;text-decoration:none;overflow-wrap:anywhere;transition:background .16s,border-color .16s,box-shadow .16s,transform .16s}
.mw-nav a span{min-width:0}.mw-nav svg{flex-shrink:0}.mw-nav a:hover{background:#fff;border-color:#bad5e9;transform:translateY(-1px)}
.mw-nav a[aria-current=page]{color:#135e97;background:#fff;border-color:#9cc4e2;box-shadow:0 3px 10px #1b639416,inset 0 -2px 0 #2584ca}
.mw-nav a:focus-visible{outline:3px solid #278bd2;outline-offset:2px}
@container(max-width:560px){.mw-nav a{flex:1 1 calc(50% - 6px);padding:8px;font-size:calc(11px * var(--app-font-scale,1))}}
@media(prefers-reduced-motion:reduce){.mw-nav a{transition:none;transform:none!important}}
`;
/** One set of real, permission-aware destinations for the four related workspaces. */
export function MobilityWorkspaceNav({ active, beforeNavigate }: {
    active: MobilityWorkspaceSection;
    beforeNavigate?: () => boolean | Promise<boolean>;
}) {
    const router = useRouter();
    const params = useLocalSearchParams<{
        tourDate?: string | string[];
    }>();
    const { can, roleKey } = usePermissions();
    if (!roleKey || isPortalOnlyRole(roleKey) || !can('assist.access'))
        return null;
    function destination(entry: typeof entries[number]) {
        const date = Array.isArray(params.tourDate) ? params.tourDate[0] : params.tourDate;
        if ((active === 'tours' || active === 'replacement') && (entry.key === 'tours' || entry.key === 'replacement') && date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return entry.href + '?tourDate=' + encodeURIComponent(date);
        }
        return entry.href;
    }
    async function navigate(event: MouseEvent<HTMLAnchorElement>, entry: typeof entries[number]) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        event.preventDefault();
        if (entry.key === active)
            return;
        if (beforeNavigate && !await beforeNavigate())
            return;
        if ((active === 'journal' || active === 'tracking') && (entry.key === 'journal' || entry.key === 'tracking')) {
            router.setParams({ tab: entry.key === 'journal' ? 'fahrten' : 'tracking' });
        }
        else {
            router.push(destination(entry) as never);
        }
    }
    return <NativeWorkspaceStyleScope css={[styles, styles]}>{<NativeNav className="mw-nav" aria-label="Touren und Mobilität">
    <NativeStyle>{styles}</NativeStyle>
    {entries.filter(entry => can(entry.permission) && (entry.key !== 'tracking' || can('assist.assignments.view'))).map(entry => <NativeA key={entry.key} href={destination(entry)} aria-current={entry.key === active ? 'page' : undefined} onClick={async (event) => await navigate(event, entry)}>
      <WebActionIcon size={16}>{icons[entry.key]}</WebActionIcon>
      <NativeSpan>{entry.label}</NativeSpan>
    </NativeA>)}
  </NativeNav>}</NativeWorkspaceStyleScope>;
}
