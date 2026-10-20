import { useMemo } from 'react';
import type { SystemCatalogKey } from '@/lib/catalogs/systemCatalog.types';
import { getCatalogOptions } from '@/lib/catalogs/systemCatalogService';

export function useSystemCatalog(key: SystemCatalogKey) {
  const options = useMemo(() => getCatalogOptions(key), [key]);
  return { options, loading: false };
}
