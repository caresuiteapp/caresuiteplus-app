import { useId } from 'react';
import { useDropdownOptions } from '@/hooks/templates/useDropdownOptions';
import type { CatalogType } from '@/types/templates';
import { resolveEmployeeCatalogLabel } from '@/lib/office/employeeCatalogLabels';

export function PersonnelCatalog({ catalog, label, value, onChange, error, required = false, disabled = false }: {
  catalog: CatalogType; label: string; value: string; onChange: (value: string) => void; error?: string; required?: boolean; disabled?: boolean;
}) {
  const id = useId();
  const options = useDropdownOptions(catalog);
  return <div className="pe-field"><label htmlFor={id}>{label}{required ? ' *' : ''}</label><select id={id} value={value} required={required} disabled={disabled || options.loading} onChange={event => onChange(event.target.value)} aria-invalid={!!error} aria-describedby={error || options.error ? `${id}-error` : undefined}><option value="">{options.loading ? 'Auswahl wird geladen …' : 'Bitte auswählen'}</option>{value && !options.options.some(option => option.value === value) ? <option value={value}>{resolveEmployeeCatalogLabel(catalog, value)}</option> : null}{options.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error ? <span id={`${id}-error`} className="pe-field-error">{error}</span> : options.error ? <span id={`${id}-error`} className="pe-field-error">Auswahl konnte nicht geladen werden. <button type="button" className="pe-text-button" onClick={() => void options.refresh()}>Erneut versuchen</button></span> : null}</div>;
}
