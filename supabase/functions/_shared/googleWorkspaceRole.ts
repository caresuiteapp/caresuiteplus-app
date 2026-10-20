const GOOGLE_WORKSPACE_ROLE_ALIASES: Readonly<Record<string, string>> = {
  owner: 'business_admin',
  admin: 'business_admin',
  system: 'business_admin',
  support: 'business_admin',
  developer_admin: 'business_admin',
  management: 'business_manager',
  office: 'business_manager',
  quality_management: 'business_manager',
  planning: 'dispatch',
  consultant: 'counselor',
  employee: 'employee_portal',
  field_worker: 'caregiver',
  client: 'client_portal',
  representative: 'family_portal',
  family_contact: 'family_portal',
  legal_guardian: 'family_portal',
};

export function normalizeGoogleWorkspaceRole(role: string | null | undefined): string {
  const normalized = role?.trim() ?? '';
  if (!normalized) return '';
  return GOOGLE_WORKSPACE_ROLE_ALIASES[normalized] ?? normalized;
}

export function isGoogleWorkspaceAdminRole(role: string | null | undefined): boolean {
  return ['business_admin', 'business_manager'].includes(
    normalizeGoogleWorkspaceRole(role),
  );
}
