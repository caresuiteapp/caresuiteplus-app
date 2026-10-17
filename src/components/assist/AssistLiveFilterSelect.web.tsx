import { memo } from 'react';

type Props = {
  className: string;
  label: string;
  ariaLabel: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
};

// Native dropdowns must not be reconciled on every live timer tick. React writes
// option.selected even for an unchanged value, interrupting the open picker.
export const AssistLiveFilterSelect = memo(function AssistLiveFilterSelect({ className, label, ariaLabel, value, options, onChange }: Props) {
  return <label className={className}><span>{label}</span><select aria-label={ariaLabel} value={value} onChange={event => onChange(event.currentTarget.value)}>
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select></label>;
}, (previous, next) => previous.className === next.className && previous.label === next.label &&
  previous.ariaLabel === next.ariaLabel && previous.value === next.value && previous.onChange === next.onChange &&
  previous.options.length === next.options.length && previous.options.every((option, index) =>
    option.value === next.options[index].value && option.label === next.options[index].label));
