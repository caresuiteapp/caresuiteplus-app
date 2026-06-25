import { useCallback, useEffect, useState } from 'react';
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

export function useAssistCatalogItems(catalogKey: string, filters: CatalogListFilters = {}) {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    const res = await loadCatalogItems(tenantId, catalogKey, filters, profile?.roleKey);
    if (res.ok) setItems(res.data);
    else setError(res.error);
    setLoading(false);
  }, [tenantId, catalogKey, profile?.roleKey, JSON.stringify(filters)]);

  useEffect(() => {
    void reload();
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

  useEffect(() => {
    if (!tenantId) return;
    void loadCatalogs(tenantId, filters, profile?.roleKey).then((res) => {
      if (res.ok) setDefinitions(res.data);
      setLoading(false);
    });
  }, [tenantId, profile?.roleKey, JSON.stringify(filters)]);

  return { definitions, loading };
}
