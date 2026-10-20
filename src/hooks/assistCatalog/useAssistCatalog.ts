import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AssistAssignmentOptions,
  CatalogDefinition,
  CatalogItem,
  CatalogListFilters,
} from '@/types/assistCatalog';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  loadAssistAssignmentOptions,
  loadAssistDocumentationBlocks,
  loadCatalogItems,
  loadCatalogs,
} from '@/lib/assistCatalog';

function useStableFilters(filters: CatalogListFilters): CatalogListFilters {
  const { groupKey, catalogKey, catalogType, moduleScope, isActive, isSystem, targetArea, search, includeInactive } = filters;
  return useMemo(() => ({ groupKey, catalogKey, catalogType, moduleScope, isActive, isSystem, targetArea, search, includeInactive }),
    [groupKey, catalogKey, catalogType, moduleScope, isActive, isSystem, targetArea, search, includeInactive]);
}

export function useAssistCatalogItems(catalogKey: string, filters: CatalogListFilters = {}) {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stableFilters = useStableFilters(filters);
  const request = useRef(0);

  const reload = useCallback(async () => {
    const id = ++request.current;
    if (!tenantId) { setItems([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await loadCatalogItems(tenantId, catalogKey, stableFilters, profile?.roleKey);
      if (id !== request.current) return;
      if (res.ok) setItems(res.data);
      else { setItems([]); setError(res.error); }
    } catch {
      if (id === request.current) { setItems([]); setError('Die Leistungen konnten nicht geladen werden. Bitte erneut versuchen.'); }
    } finally { if (id === request.current) setLoading(false); }
  }, [tenantId, catalogKey, stableFilters, profile?.roleKey]);

  useEffect(() => {
    setItems([]);
    void reload();
    return () => { request.current += 1; };
  }, [reload]);

  return { items, loading, error, reload };
}

export function useAssistAssignmentOptions() {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [options, setOptions] = useState<AssistAssignmentOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    void loadAssistAssignmentOptions(tenantId, profile?.roleKey).then((res) => {
      if (res.ok) setOptions(res.data);
      else setError(res.error);
      setLoading(false);
    });
  }, [tenantId, profile?.roleKey]);

  return { options, loading, error };
}

export function useAssistDocumentationBlocks() {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [blocks, setBlocks] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    void loadAssistDocumentationBlocks(tenantId, profile?.roleKey).then((res) => {
      if (res.ok) setBlocks(res.data);
      setLoading(false);
    });
  }, [tenantId, profile?.roleKey]);

  return { blocks, loading };
}

export function useAssistCatalogDefinitions(filters: CatalogListFilters = {}) {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [definitions, setDefinitions] = useState<CatalogDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const stableFilters = useStableFilters(filters);

  useEffect(() => {
    let cancelled = false;
    setDefinitions([]);
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    void loadCatalogs(tenantId, stableFilters, profile?.roleKey).then((res) => {
      if (cancelled) return;
      if (res.ok) setDefinitions(res.data);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId, profile?.roleKey, stableFilters]);

  return { definitions, loading };
}
