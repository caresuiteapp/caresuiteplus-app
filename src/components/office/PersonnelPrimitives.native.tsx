// Generated native presentation from src/components/office/PersonnelPrimitives.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeSpan,NativeI,NativeB,NativeDiv,NativeLabel,NativeInput,NativeSection,NativeH2,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../icons/WebActionIcon.native.tsx";
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
const paths = {
    search: 'm21 21-5-5 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    plus: 'M12 5v14 M5 12h14',
    refresh: 'M20 7v5h-5 M20 12a8 8 0 1 0-2 5 M20 7l-3-3',
    arrow: 'M5 12h14 m-6-6 6 6-6 6',
    folder: 'M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9H3Z M3 8v11',
    grid: 'M3 3h7v7H3Z M14 3h7v7h-7Z M3 14h7v7H3Z M14 14h7v7h-7Z',
    list: 'M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01',
    phone: 'M7 3H4a1 1 0 0 0-1 1c0 9 8 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2Z',
    close: 'm6 6 12 12 M6 18 18 6',
    import: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
    person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
    document: 'M14 3H5v18h14V8zm0 0v5h5 M8 12h8 M8 16h6',
    shield: 'M12 3 4 6v5c0 5 8 10 8 10s8-5 8-10V6z M8 12l3 3 5-6',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 6v6l4 2',
    briefcase: 'M3 8h18v13H3z M8 8V4h8v4 M3 13h18 M10 12v3h4v-3',
    mail: 'M3 5h18v14H3z M3 6l9 7 9-7',
    edit: 'm15 5 4 4 M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15z',
    check: 'm5 12 4 4L19 6',
} as const;
export type PersonnelIconName = keyof typeof paths;
export function PersonnelIcon({ name }: {
    name: PersonnelIconName;
}) {
    return <WebActionIcon><NativeSvgPath d={paths[name]}/></WebActionIcon>;
}
export function PersonnelFolder({ firstName, lastName, large = false }: {
    firstName: string;
    lastName: string;
    large?: boolean;
}) {
    return <NativeSpan className={`cs-records-folder${large ? ' cs-records-folder--large' : ''}`} aria-hidden="true">
    <NativeSpan className="cs-records-folder-back"/><NativeSpan className="cs-records-folder-paper"><NativeI /><NativeI /><NativeI /></NativeSpan>
    <NativeSpan className="cs-records-folder-front"><NativeB>{`${firstName.charAt(0)}${lastName.charAt(0)}`.toLocaleUpperCase('de-DE') || '·'}</NativeB><NativeSpan /></NativeSpan>
  </NativeSpan>;
}
export function PersonnelField({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    error?: string;
}) {
    const id = useId();
    return <NativeDiv className="pe-field"><NativeLabel htmlFor={id}>{label}{props.required ? ' *' : ''}</NativeLabel><NativeInput {...props} id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}/>{error ? <NativeSpan id={`${id}-error`} className="pe-field-error" role="alert">{error}</NativeSpan> : null}</NativeDiv>;
}
export function PersonnelSection({ title, description, children }: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return <NativeSection className="pe-section"><NativeDiv className="pe-section-heading"><NativeH2>{title}</NativeH2>{description ? <NativeP>{description}</NativeP> : null}</NativeDiv>{children}</NativeSection>;
}
