import type { ReactNode } from 'react';
import type { TenantCenterSectionKey, TenantCenterSnapshot, TenantCustomFieldDefinition } from '@/types/tenant/tenantCenter';
import type { CompanyTab } from '@/lib/tenant/companyWorkspaceModel';

export type CompanyWorkspaceViewProps = {
  snapshot: TenantCenterSnapshot;
  tab: CompanyTab;
  onTab: (tab: CompanyTab) => void;
  activeAreas: readonly string[];
  canEdit: boolean;
  canDocuments: boolean;
  canInventory?: boolean;
  inventoryContent?: ReactNode;
  settingsContent?: ReactNode;
  refreshing: boolean;
  refreshError?: string | null;
  notice?: string | null;
  noticeTone?: 'success' | 'error';
  onRefresh: () => void;
  onOpen: (key: TenantCenterSectionKey) => void;
  onCustomField: (field: TenantCustomFieldDefinition) => void;
  onCopy: (value: string, description: string) => void;
  onDocuments: () => void;
};
