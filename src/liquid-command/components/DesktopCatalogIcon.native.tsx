// Generated native presentation from src/liquid-command/components/DesktopCatalogIcon.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import { WebActionIcon } from "../../components/icons/WebActionIcon.native.tsx";
import React from 'react';
import { desktopCatalogIconName, type DesktopCatalogIconName } from "./desktopCatalogIconModel.native.ts";
// A consistent 24 px outline set: no icon fonts, remote images or platform glyphs.
const ICON_PATHS: Record<DesktopCatalogIconName, string> = {
    apps: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    home: 'm3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9',
    company: 'M4 21V5l11-2v18M15 9h5v12M2 21h20M8 7h3M8 11h3M8 15h3M8 21v-3h3v3M17 13h1M17 17h1',
    clients: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M13 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0M17 5a3 3 0 0 1 0 6M18 14a4 4 0 0 1 3 4v2',
    people: 'M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16zM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0M8 18v-1a4 4 0 0 1 8 0v1M10 3V1M14 3V1',
    profile: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M16 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0M5 19a7 7 0 0 1 14 0',
    clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2',
    payroll: 'M3 21h18M5 17v-5M10 17V8M15 17v-4M20 17V3M3 6l5-3 5 4 7-5',
    invoice: 'M5 3h14v18l-3-2-4 2-4-2-3 2zM8 7h8M8 11h8M8 15h3M15 15h1',
    wallet: 'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v11H5a3 3 0 0 1-3-3V6M21 12h-5a2 2 0 0 0 0 4h5M16 14h.01',
    folder: 'M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18',
    document: 'M5 3h9l5 5v13H5zM14 3v5h5M8 12h8M8 16h8',
    templates: 'M8 3h8l5 5v10H8zM16 3v5h5M5 6H3v15h13v-1M11 12h7M11 15h5',
    catalog: 'M2 3h5v18H2zM9 3h5v18H9zM16 4l4-1 3 17-4 1zM2 7h5M9 7h5M2 17h5M9 17h5',
    signature: 'M13 4H4v17h16v-8M8 16l1-5 9-9 4 4-9 9zM16 4l4 4M7 18h10',
    notes: 'M5 3h15v18H5zM2 7h5M2 12h5M2 17h5M9 7h7M9 11h7M9 15h4',
    calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2M7 3v4M17 3v4M3 10h18M7 14h2M15 14h2M7 17h2M15 17h2',
    messages: 'M21 11a8 8 0 0 1-8 8H8l-5 3V7a4 4 0 0 1 4-4h6a8 8 0 0 1 8 8M7 8h10M7 12h7',
    mail: 'M3 5h18v14H3zM3 6l9 7 9-7M3 18l6-6M21 18l-6-6',
    video: 'M3 6h12v12H3zM15 10l6-4v12l-6-4',
    table: 'M3 3h18v18H3zM3 8h18M3 14h18M9 8v13M15 8v13',
    presentation: 'M2 3h20M4 3v13h16V3M12 16v5M8 21l4-3 4 3M8 12V8M12 12V6M16 12V9',
    tasks: 'M8 4H4v17h16V4h-4M8 2h8v4H8zM7 11l2 2 4-4M14 11h3M7 17h10',
    route: 'M8 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M22 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0M9 5h7a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h7',
    car: 'M3 16V9l2-5h14l2 5v7zM3 10h18M6 14h2M16 14h2M4 16v4h3v-4M17 16v4h3v-4',
    activity: 'M2 12h5l3-8 4 16 3-8h5',
    audit: 'M11 3H4v18h16v-7M8 8h3M8 12h3M8 16h8M21 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 4v2l2 1',
    chart: 'M3 3v18h18M7 16v-5M12 16V7M17 16v-3M6 7l5-4 6 4 4-3',
    inventory: 'm3 7 9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5M12 12v10M7 4l10 5',
    key: 'M14 8a6 6 0 1 1-2 4l-7 7H2v-3l7-7M17 5h.01',
    shield: 'm12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5zM8 11l3 3 5-6',
    settings: 'M4 3v7M4 14v7M12 3v2M12 9v12M20 3v10M20 17v4M2 10h4v4H2zM10 5h4v4h-4zM18 13h4v4h-4z',
    palette: 'M12 2a10 10 0 0 0 0 20h1a2 2 0 0 0 1-4l-1-1a2 2 0 0 1 1-3h4a4 4 0 0 0 4-4c0-5-5-8-10-8M7 7h.01M12 5h.01M17 7h.01M5 12h.01',
    plug: 'M8 2v5M16 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5M4 7h16',
    help: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M9 8a3 3 0 1 1 5 2c-1 1-2 1-2 4M12 18h.01',
    robot: 'M5 7h14v13H5zM12 7V3M10 2h4M2 11v5M22 11v5M8 11h1M15 11h1M9 16h6',
    handover: 'M3 7h17M16 3l4 4-4 4M21 17H4M8 13l-4 4 4 4',
    medical: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    bed: 'M3 3v18M21 11v10M3 17h18M3 11h18v6H3M5 7h5v4H5zM12 11V7h6a3 3 0 0 1 3 3v1',
    learning: 'm2 8 10-5 10 5-10 5zM6 10v7l6 4 6-4v-7M22 8v8',
    flag: 'M4 22V3h7l2 3h7v11h-7l-2-3H4',
    'academy-overview': 'm2 8 10-5 10 5-10 5zM6 10v7c3 3 9 3 12 0v-7M22 8v8',
    'academy-courses': 'M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2zM12 6v15M6 8l3 1M6 12l3 1M15 8l3 2-3 2z',
    'academy-templates': 'M3 3h8v8H3zM15 3h6v6h-6zM3 15h6v6H3zM12 21l1-4 6-6 3 3-6 6zM17 13l3 3',
    'academy-participants': 'M10 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M20 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M2 19v-2a5 5 0 0 1 10 0v2M14 13a5 5 0 0 1 8 4v2M14 19l2 2 5-5',
    'academy-schedule': 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2M7 3v4M17 3v4M3 10h18M7 15l3 3 7-5',
    'academy-mandatory': 'M8 4H4v17h16V4h-4M8 2h8v4H8zM7 10l2 2 3-4M7 16l2 2 3-4M15 10h2M15 16h2',
    'academy-reviews': 'M18 8V3H4v18h7M7 7h7M7 11h3M20 15a5 5 0 1 1-10 0 5 5 0 0 1 10 0M19 19l3 3M12 15l2 2 3-4',
    'academy-certificates': 'M14 21H4V3h16v10M7 7h10M7 11h5M21 16a4 4 0 1 1-8 0 4 4 0 0 1 8 0M14 19l-1 4 4-2 4 2-1-4M7 16h3',
    'academy-library': 'M3 3h5v18H3zM8 5h5v16H8zM15 4l4-1 3 17-4 1zM3 7h5M8 9h5M3 17h5M8 17h5M16 8l4-1',
    'academy-reports': 'M3 3v18h18M7 17v-5M12 17V8M17 17v-3M7 7l5-4 5 5 4-3',
};
export type DesktopCatalogIconProps = {
    route: string;
    label?: string;
    className?: string;
    size?: number;
};
/** Decorative; the enclosing app, widget or workflow supplies its visible label. */
export function DesktopCatalogIcon({ route, className, size = 24 }: DesktopCatalogIconProps) {
    return (<WebActionIcon size={size} className={className}>
      <NativeSvgPath d={ICON_PATHS[desktopCatalogIconName(route)]}/>
    </WebActionIcon>);
}
export default DesktopCatalogIcon;
