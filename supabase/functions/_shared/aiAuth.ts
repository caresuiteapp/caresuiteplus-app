import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2';

export type AiTenantMembership = {
  tenant_id: string;
  role: string;
  permissions: Record<string, unknown>;
};

export type AiAuthContext = {
  user: User;
  membership: AiTenantMembership;
  userClient: SupabaseClient;
};

export async function verifyAiTenantAccess(
  req: Request,
  tenantId: string,
): Promise<AiAuthContext | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return null;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return null;

  const user = authData.user;

  const { data: membership } = await userClient
    .from('tenant_memberships')
    .select('tenant_id, role, permissions')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (membership) {
    return {
      user,
      membership: {
        tenant_id: membership.tenant_id,
        role: membership.role ?? 'staff',
        permissions: (membership.permissions ?? {}) as Record<string, unknown>,
      },
      userClient,
    };
  }

  const service = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await service
    .from('profiles')
    .select('tenant_id, role_key')
    .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
    .maybeSingle();

  if (!profile?.tenant_id || profile.tenant_id !== tenantId) {
    return null;
  }

  return {
    user,
    membership: {
      tenant_id: profile.tenant_id,
      role: profile.role_key ?? 'staff',
      permissions: {},
    },
    userClient,
  };
}
