import { ScreenShell } from '@/components/layout';
import { FilterChipGroup, PremiumCard } from '@/components/ui';
import { useState } from 'react';

/** WP304 */
export function TripLogFilterListScreen() {
  const [filter, setFilter] = useState('alle');
  return (
    <ScreenShell title="Fahrtenbuch Filter" subtitle="WP 304">
      <PremiumCard>
        <FilterChipGroup options={[{ key: 'alle', label: 'Alle' }, { key: 'heute', label: 'Heute' }]} value={filter} onChange={setFilter} />
      </PremiumCard>
    </ScreenShell>
  );
}
