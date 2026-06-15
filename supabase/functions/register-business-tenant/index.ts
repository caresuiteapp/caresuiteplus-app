import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, getServiceClient, jsonResponse, readClientMeta, tryInsert } from '../_shared/http.ts';

const USERNAME_MAX = 20;

type RegisterBody = {
  companyName: string;
  legalForm: string;
  industry: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  website?: string;
  contactFirstName: string;
  contactLastName: string;
  contactRole: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
  selectedModules: string[];
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'mandant';
}

function normalizePart(value: string, max: number): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, max);
}

function pickUsername(
  companyName: string,
  firstName: string,
  lastName: string,
  existing: string[],
): string {
  const company = normalizePart(companyName.split(/\s+/)[0] ?? 'firma', 5);
  const first = normalizePart(firstName, 4);
  const last = normalizePart(lastName, 6);
  let base = `${company}.${first}.${last}`.replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
  if (base.length > USERNAME_MAX) base = base.slice(0, USERNAME_MAX);
  if (!existing.includes(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const suffix = String(i);
    const candidate = `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`;
    if (!existing.includes(candidate)) return candidate;
  }
  return `${base.slice(0, 12)}${Date.now().toString(36).slice(-4)}`;
}

function validateBody(body: RegisterBody): string | null {
  if (!body.companyName?.trim()) return 'Firmenname fehlt.';
  if (!body.adminEmail?.trim()) return 'Admin-E-Mail fehlt.';
  if (!body.adminPassword || body.adminPassword.length < 10) {
    return 'Admin-Passwort muss mindestens 10 Zeichen haben.';
  }
  return null;
}

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('already been registered') || lower.includes('already registered')) {
    return 'Diese Admin-E-Mail ist bereits registriert. Bitte melden Sie sich an oder nutzen Sie eine andere E-Mail.';
  }
  if (lower.includes('password')) {
    return 'Passwort entspricht nicht den Sicherheitsanforderungen.';
  }
  return message;
}

function mapTenantError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('tenants_slug_unique') || (lower.includes('duplicate key') && lower.includes('slug'))) {
    return 'Diese Firma wurde bereits registriert. Bitte melden Sie sich an oder wenden Sie sich an den Support.';
  }
  return message;
}

async function ensureOwnerRole(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('roles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('key', 'owner')
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('roles')
    .insert({
      tenant_id: tenantId,
      key: 'owner',
      name: 'Inhaber',
      is_admin_role: true,
      can_manage_tenant: true,
      can_manage_users: true,
    })
    .select('id')
    .single();

  if (error) {
    console.warn(`[edge] owner role not created: ${error.message}`);
    return null;
  }

  return created?.id ?? null;
}

async function resolveTenant(
  supabase: ReturnType<typeof getServiceClient>,
  body: RegisterBody,
  slug: string,
): Promise<{ tenant: { id: string } | null; error: string | null; resumed: boolean }> {
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existingTenant?.id) {
    const { count, error: countError } = await supabase
      .from('tenant_users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', existingTenant.id);

    if (countError) {
      return { tenant: null, error: countError.message, resumed: false };
    }

    if ((count ?? 0) > 0) {
      return {
        tenant: null,
        error: 'Diese Firma ist bereits registriert. Bitte melden Sie sich an.',
        resumed: false,
      };
    }

    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        name: body.companyName.trim(),
        legal_form: body.legalForm,
        industry: body.industry,
        phone: body.phone,
        email: body.email,
        website: body.website ?? null,
        street: body.street,
        postal_code: body.zip,
        city: body.city,
      })
      .eq('id', existingTenant.id);

    if (updateError) {
      return { tenant: null, error: updateError.message, resumed: false };
    }

    return { tenant: existingTenant, error: null, resumed: true };
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: body.companyName.trim(),
      slug,
      legal_form: body.legalForm,
      industry: body.industry,
      phone: body.phone,
      email: body.email,
      website: body.website ?? null,
      street: body.street,
      postal_code: body.zip,
      city: body.city,
    })
    .select('id')
    .single();

  if (tenantError || !tenant) {
    return {
      tenant: null,
      error: mapTenantError(tenantError?.message ?? 'Mandant konnte nicht angelegt werden.'),
      resumed: false,
    };
  }

  return { tenant, error: null, resumed: false };
}

async function resolveAuthUser(
  supabase: ReturnType<typeof getServiceClient>,
  body: RegisterBody,
  tenantId: string,
  adminEmail: string,
): Promise<{ user: { id: string } | null; error: string | null }> {
  const displayName = `${body.adminFirstName.trim()} ${body.adminLastName.trim()}`;

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: body.adminPassword,
    email_confirm: true,
    app_metadata: {
      tenant_id: tenantId,
      role_key: 'business_admin',
    },
    user_metadata: {
      display_name: displayName,
    },
  });

  if (created?.user) {
    return { user: created.user, error: null };
  }

  const createMessage = createError?.message ?? '';
  const alreadyExists =
    createMessage.toLowerCase().includes('already been registered') ||
    createMessage.toLowerCase().includes('already registered');

  if (!alreadyExists) {
    return {
      user: null,
      error: mapAuthError(createMessage || 'Auth-Benutzer konnte nicht angelegt werden.'),
    };
  }

  const { data: existing, error: lookupError } = await supabase.auth.admin.getUserByEmail(adminEmail);
  if (lookupError || !existing?.user) {
    return {
      user: null,
      error: 'Diese Admin-E-Mail ist bereits registriert, konnte aber nicht verknüpft werden.',
    };
  }

  const linkedTenantId = existing.user.app_metadata?.tenant_id as string | undefined;
  if (linkedTenantId && linkedTenantId !== tenantId) {
    return {
      user: null,
      error: 'Diese Admin-E-Mail ist bereits einem anderen Mandanten zugeordnet.',
    };
  }

  const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(existing.user.id, {
    password: body.adminPassword,
    email_confirm: true,
    app_metadata: {
      ...existing.user.app_metadata,
      tenant_id: tenantId,
      role_key: 'business_admin',
    },
    user_metadata: {
      ...existing.user.user_metadata,
      display_name: displayName,
    },
  });

  if (updateError || !updated?.user) {
    return {
      user: null,
      error: mapAuthError(updateError?.message ?? 'Auth-Benutzer konnte nicht aktualisiert werden.'),
    };
  }

  return { user: updated.user, error: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as RegisterBody;
    const validationError = validateBody(body);
    if (validationError) {
      return jsonResponse({ ok: false, error: validationError }, 400);
    }

    const supabase = getServiceClient();
    const adminEmail = body.adminEmail.trim().toLowerCase();
    const slug = slugify(body.companyName);

    const tenantResult = await resolveTenant(supabase, body, slug);
    if (tenantResult.error || !tenantResult.tenant) {
      const status = tenantResult.error?.includes('bereits registriert') ? 409 : 500;
      return jsonResponse({ ok: false, error: tenantResult.error ?? 'Mandant konnte nicht angelegt werden.' }, status);
    }

    const tenant = tenantResult.tenant;

    if (!tenantResult.resumed) {
      await tryInsert(supabase, 'tenant_addresses', {
        tenant_id: tenant.id,
        street: body.street,
        zip: body.zip,
        city: body.city,
      });

      await tryInsert(supabase, 'tenant_contacts', {
        tenant_id: tenant.id,
        first_name: body.contactFirstName,
        last_name: body.contactLastName,
        role: body.contactRole,
        email: body.email,
        is_primary: true,
      });
    }

    const authResult = await resolveAuthUser(supabase, body, tenant.id, adminEmail);
    if (authResult.error || !authResult.user) {
      return jsonResponse(
        { ok: false, error: authResult.error ?? 'Auth-Benutzer konnte nicht angelegt werden.' },
        authResult.error?.includes('bereits') ? 409 : 500,
      );
    }

    const authUser = { user: authResult.user };

    const ownerRoleId = await ensureOwnerRole(supabase, tenant.id);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        tenant_id: tenant.id,
        role_id: ownerRoleId,
        first_name: body.adminFirstName.trim(),
        last_name: body.adminLastName.trim(),
        full_name: `${body.adminFirstName.trim()} ${body.adminLastName.trim()}`,
        email: adminEmail,
        status: 'active',
      })
      .eq('auth_user_id', authUser.user.id);

    if (profileError) {
      console.warn(`[edge] profile update: ${profileError.message}`);
    }

    const { data: existingUsers } = await supabase
      .from('tenant_users')
      .select('username')
      .eq('tenant_id', tenant.id);

    const username = pickUsername(
      body.companyName,
      body.adminFirstName,
      body.adminLastName,
      (existingUsers ?? []).map((row) => row.username),
    );

    const now = new Date().toISOString();
    const { data: owner, error: ownerError } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: tenant.id,
        auth_user_id: authUser.user.id,
        display_name: `${body.adminFirstName.trim()} ${body.adminLastName.trim()}`,
        first_name: body.adminFirstName.trim(),
        last_name: body.adminLastName.trim(),
        email: adminEmail,
        username,
        role_key: 'owner',
        status: 'active',
        must_change_password: false,
        first_login_completed: true,
        last_password_change_at: now,
      })
      .select('id, tenant_id, username, role_key, email, display_name')
      .single();

    if (ownerError || !owner) {
      return jsonResponse(
        { ok: false, error: ownerError?.message ?? 'Owner-Benutzer konnte nicht angelegt werden.' },
        500,
      );
    }

    const moduleKeys = Array.from(new Set(['office', ...(body.selectedModules ?? [])]));
    const { data: products } = await supabase
      .from('products')
      .select('id, product_key')
      .in('product_key', moduleKeys);

    if (products?.length) {
      const { error: productsError } = await supabase.from('tenant_products').insert(
        products.map((product) => ({
          tenant_id: tenant.id,
          product_id: product.id,
          product_key: product.product_key,
          status: 'active',
          is_default: product.product_key === 'office',
        })),
      );
      if (productsError) {
        console.warn(`[edge] tenant_products skipped: ${productsError.message}`);
      }
    }

    await tryInsert(supabase, 'tenant_subscriptions', {
      tenant_id: tenant.id,
      status: 'active',
    });

    const meta = readClientMeta(req);
    await tryInsert(supabase, 'login_audit_events', {
      tenant_id: tenant.id,
      login_type: 'business',
      account_id: owner.id,
      username_or_code_hint: username,
      success: true,
      failure_reason: null,
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    });

    return jsonResponse({
      ok: true,
      tenantId: tenant.id,
      owner: {
        id: owner.id,
        tenantId: owner.tenant_id,
        username: owner.username,
        roleKey: owner.role_key,
        email: owner.email,
        displayName: owner.display_name,
      },
      credentials: { username },
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
