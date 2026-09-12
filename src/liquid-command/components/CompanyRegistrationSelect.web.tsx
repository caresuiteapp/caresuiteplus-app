import React, { useId, type CSSProperties } from 'react';
import {
  COMPANY_REGISTRATION_CATALOG,
  resolveCompanyCatalogChoice,
  type CompanyCatalogKind,
} from '@/lib/catalogs/companyRegistrationCatalog';

type Props = {
  kind: CompanyCatalogKind;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showError?: boolean;
};

const control: CSSProperties = {
  width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: 50,
  padding: '12px 14px', borderRadius: 12, border: '1px solid #C8D5E5',
  color: '#102F50', backgroundColor: '#FFFFFF', fontFamily: 'inherit',
  fontSize: '1rem', lineHeight: 1.5,
};

export function CompanyRegistrationSelect({ kind, label, value, onChange, disabled, showError }: Props) {
  const id = useId();
  const choice = resolveCompanyCatalogChoice(kind, value);
  const other = choice?.key === 'sonstige';
  const detail = other && /^sonstige:/i.test(value) ? value.replace(/^sonstige:\s?/i, '') : '';
  const invalid = Boolean(showError && (!choice || (other && detail.trim().length < 2)));
  const hint = !choice && value.trim()
    ? `Bisherige Angabe: ${value}. Bitte ordnen Sie diese einer Vorgabe zu oder wählen Sie „Sonstige“.`
    : kind === 'legal_form'
      ? 'Wählen Sie die Rechtsform, unter der Ihr Unternehmen geführt wird.'
      : 'Wählen Sie den hauptsächlichen Leistungsbereich Ihrer Einrichtung.';

  return (
    <div className="cs-registration-choice" style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <style>{`.cs-registration-choice select:focus-visible,.cs-registration-choice input:focus-visible{outline:3px solid #93C5FD;outline-offset:2px;border-color:#1683FF}.cs-registration-choice select:disabled,.cs-registration-choice input:disabled{opacity:.65}`}</style>
      <label htmlFor={id} style={{ color: '#172B45', fontSize: '1rem', fontWeight: 700 }}>
        {label} <span aria-hidden="true" style={{ color: '#1683FF' }}>*</span>
      </label>
      <select
        id={id}
        value={choice?.key ?? ''}
        disabled={disabled}
        required
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
        style={{ ...control, cursor: disabled ? 'default' : 'pointer', borderColor: invalid ? '#B42318' : '#C8D5E5' }}
        onChange={event => {
          const selected = COMPANY_REGISTRATION_CATALOG[kind].find(row => row.key === event.target.value);
          if (selected) onChange(selected.key === 'sonstige' ? 'Sonstige: ' : selected.label);
        }}
      >
        <option value="" disabled>Bitte auswählen …</option>
        {COMPANY_REGISTRATION_CATALOG[kind].map(row => (
          <option key={row.key} value={row.key}>{row.optionLabel ?? row.label}</option>
        ))}
      </select>
      {choice?.optionLabel ? <span style={{ color: '#334E6D', fontSize: '.875rem', overflowWrap: 'anywhere' }}>{choice.label}</span> : null}
      {other ? (
        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <label htmlFor={`${id}-other`} style={{ color: '#172B45', fontWeight: 600 }}>
            {kind === 'legal_form' ? 'Andere Rechtsform angeben' : 'Anderen Einrichtungstyp angeben'} *
          </label>
          <input
            id={`${id}-other`}
            value={detail}
            maxLength={180}
            required
            disabled={disabled}
            aria-invalid={invalid}
            placeholder="Bitte genauer beschreiben"
            style={control}
            onChange={event => onChange(`Sonstige: ${event.target.value}`)}
          />
        </div>
      ) : null}
      <p id={`${id}-hint`} style={{ margin: 0, color: '#48627D', fontSize: '.875rem', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{hint}</p>
    </div>
  );
}
