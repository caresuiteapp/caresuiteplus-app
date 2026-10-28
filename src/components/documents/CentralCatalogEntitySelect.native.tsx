// Generated native presentation from src/components/documents/CentralCatalogEntitySelect.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeLabel,NativeSelect,NativeOption,NativeP,NativeStrong} from '@/components/layout/NativeWorkspaceElements.native';
import { useMemo, useState } from 'react';
import { groupCentralCatalogEntities, type CentralCatalogEntityOption } from '@/lib/documents/centralCatalogEntities';
export function CentralCatalogEntitySelect({ entities, label, value, selectedLabel, disabled, onChange }: {
    entities: readonly CentralCatalogEntityOption[];
    label: string;
    value: string;
    selectedLabel?: string;
    disabled: boolean;
    onChange: (id: string) => boolean | Promise<boolean>;
}) {
    const groups = useMemo(() => groupCentralCatalogEntities(entities), [entities]);
    const [pendingGroup, setPendingGroup] = useState('');
    const selected = groups.find((group) => group.records.some((record) => record.id === value))
        ?? groups.find((group) => group.key === pendingGroup);
    return <NativeDiv className="csdc-entity">
    <NativeLabel className="csdc-field">{label}<NativeSelect disabled={disabled || !groups.length} value={selected?.key ?? value} onChange={async (event) => {
            const group = groups.find((entry) => entry.key === event.target.value);
            const id = group?.records.length === 1 ? group.records[0].id : '';
            if (await onChange(id))
                setPendingGroup(group?.key ?? '');
        }}><NativeOption value="">Bitte eine gespeicherte Akte wählen</NativeOption>{value && !selected ? <NativeOption value={value}>{selectedLabel || 'Zugeordnete Akte'}</NativeOption> : null}{groups.map((group) => <NativeOption key={group.key} value={group.key}>{group.label}</NativeOption>)}</NativeSelect></NativeLabel>
    {!groups.length && !disabled && !value ? <NativeP className="csdc-entity-empty"><NativeStrong>Keine auswählbare Akte vorhanden.</NativeStrong>Für diese Vorlage wird eine gespeicherte und für Sie freigegebene Akte benötigt.</NativeP> : null}
    {selected && selected.records.length > 1 ? <NativeLabel className="csdc-field">Akte auswählen<NativeSelect disabled={disabled} value={value} onChange={async (event) => { await onChange(event.target.value); }}>
      <NativeOption value="">Bitte die zugehörige Akte wählen</NativeOption>{selected.records.map((record) => <NativeOption key={record.id} value={record.id}>{record.detail}</NativeOption>)}
    </NativeSelect></NativeLabel> : null}
  </NativeDiv>;
}
