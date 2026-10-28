// Generated native presentation from src/components/office/PersonnelCatalog.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeLabel,NativeSelect,NativeOption,NativeSpan,NativeButton} from '@/components/layout/NativeWorkspaceElements.native';
import { useId } from 'react';
import { useDropdownOptions } from '@/hooks/templates/useDropdownOptions';
import type { CatalogType } from '@/types/templates';
import { resolveEmployeeCatalogLabel } from '@/lib/office/employeeCatalogLabels';
export function PersonnelCatalog({ catalog, label, value, onChange, error, required = false, disabled = false }: {
    catalog: CatalogType;
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    required?: boolean;
    disabled?: boolean;
}) {
    const id = useId();
    const options = useDropdownOptions(catalog);
    return <NativeDiv className="pe-field"><NativeLabel htmlFor={id}>{label}{required ? ' *' : ''}</NativeLabel><NativeSelect id={id} value={value} required={required} disabled={disabled || options.loading} onChange={event => onChange(event.target.value)} aria-invalid={!!error} aria-describedby={error || options.error ? `${id}-error` : undefined}><NativeOption value="">{options.loading ? 'Auswahl wird geladen …' : 'Bitte auswählen'}</NativeOption>{value && !options.options.some(option => option.value === value) ? <NativeOption value={value}>{resolveEmployeeCatalogLabel(catalog, value)}</NativeOption> : null}{options.options.map(option => <NativeOption key={option.value} value={option.value}>{option.label}</NativeOption>)}</NativeSelect>{error ? <NativeSpan id={`${id}-error`} className="pe-field-error">{error}</NativeSpan> : options.error ? <NativeSpan id={`${id}-error`} className="pe-field-error">Auswahl konnte nicht geladen werden. <NativeButton type="button" className="pe-text-button" onClick={() => void options.refresh()}>Erneut versuchen</NativeButton></NativeSpan> : null}</NativeDiv>;
}
