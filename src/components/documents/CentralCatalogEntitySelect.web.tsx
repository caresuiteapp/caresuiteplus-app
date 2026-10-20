import { useMemo, useState } from 'react';
import { groupCentralCatalogEntities, type CentralCatalogEntityOption } from '@/lib/documents/centralCatalogEntities';

export function CentralCatalogEntitySelect({ entities, label, value, selectedLabel, disabled, onChange }: {
  entities: readonly CentralCatalogEntityOption[];
  label: string;
  value: string;
  selectedLabel?: string;
  disabled: boolean;
  onChange: (id: string) => boolean;
}) {
  const groups = useMemo(() => groupCentralCatalogEntities(entities), [entities]);
  const [pendingGroup, setPendingGroup] = useState('');
  const selected = groups.find((group) => group.records.some((record) => record.id === value))
    ?? groups.find((group) => group.key === pendingGroup);
  return <div className="csdc-entity">
    <label className="csdc-field">{label}<select disabled={disabled || !groups.length} value={selected?.key ?? value} onChange={(event) => {
      const group = groups.find((entry) => entry.key === event.target.value);
      const id = group?.records.length === 1 ? group.records[0].id : '';
      if (onChange(id)) setPendingGroup(group?.key ?? '');
    }}><option value="">Bitte eine gespeicherte Akte wählen</option>{value && !selected ? <option value={value}>{selectedLabel || 'Zugeordnete Akte'}</option> : null}{groups.map((group) => <option key={group.key} value={group.key}>{group.label}</option>)}</select></label>
    {!groups.length && !disabled && !value ? <p className="csdc-entity-empty"><strong>Keine auswählbare Akte vorhanden.</strong>Für diese Vorlage wird eine gespeicherte und für Sie freigegebene Akte benötigt.</p> : null}
    {selected && selected.records.length > 1 ? <label className="csdc-field">Akte auswählen<select disabled={disabled} value={value} onChange={(event) => { onChange(event.target.value); }}>
      <option value="">Bitte die zugehörige Akte wählen</option>{selected.records.map((record) => <option key={record.id} value={record.id}>{record.detail}</option>)}
    </select></label> : null}
  </div>;
}
