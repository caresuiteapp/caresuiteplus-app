import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { enforcePermission } from '@/lib/permissions';
import type { RoleKey, ServiceResult } from '@/types';
import type { TenantBudgetDefault, TenantBudgetType, TenantBudgetYear } from '@/types/clientCore';

export type CompanyServiceType = { id: string; name: string; description: string; key: string; active: boolean };
export type CompanyBillingRule = { id: string; serviceTypeId: string; rate: number | null; unit: string; signature: boolean; approval: boolean; budget: boolean; active: boolean };
export type CompanyServiceSettings = { types: CompanyServiceType[]; rules: CompanyBillingRule[] };
export type CompanyBudgetSettings = { years: TenantBudgetYear[]; types: TenantBudgetType[]; defaults: TenantBudgetDefault[] };
type Row = Record<string, unknown>;
const text = (value: unknown) => typeof value === 'string' ? value : '';
const optionalNumber = (value: unknown) => value == null ? null : Number(value);
const denied = <T>(tenantId: string, roleKey: RoleKey | null): ServiceResult<T> | null => enforcePermission<T>(roleKey, 'business.tenant.manage') ?? guardServiceTenant(tenantId);
const mapType = (row: Row): CompanyServiceType => ({ id: text(row.id), name: text(row.name), description: text(row.description), key: text(row.service_type_key), active: !!row.is_active });
const mapRule = (row: Row): CompanyBillingRule => ({ id: text(row.id), serviceTypeId: text(row.service_type_id), rate: optionalNumber(row.default_rate_amount), unit: text(row.default_unit), signature: !!row.require_signature, approval: !!row.require_approval, budget: !!row.require_budget, active: !!row.is_active });
const mapDefault = (row: Row): TenantBudgetDefault => ({ id: text(row.id), tenantId: text(row.tenant_id), budgetYearId: text(row.budget_year_id), budgetTypeId: text(row.budget_type_id), amountCents: Number(row.amount_cents), monthlyAmountCents: optionalNumber(row.monthly_amount_cents), yearlyAmountCents: optionalNumber(row.yearly_amount_cents), conversionRatePct: optionalNumber(row.conversion_rate_pct), notes: text(row.notes) || null });

/** Administrative reads never seed or change records. */
export async function fetchCompanyServiceSettings(tenantId: string, roleKey: RoleKey | null): Promise<ServiceResult<CompanyServiceSettings>> {
  return runService(async () => {
    const block = denied<CompanyServiceSettings>(tenantId, roleKey); if (block) return block;
    const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Verbindung zu den Unternehmensdaten nicht verfügbar.' };
    const [types, rules] = await Promise.all([
      fromUnknownTable(client, 'tenant_client_service_types').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('sort_order'),
      fromUnknownTable(client, 'tenant_service_type_billing_rules').select('*').eq('tenant_id', tenantId).eq('is_active', true),
    ]);
    const error = types.error ?? rules.error; if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { types: (types.data ?? []).map(mapType), rules: (rules.data ?? []).map(mapRule) } };
  });
}

export async function fetchCompanyBudgetSettings(tenantId: string, roleKey: RoleKey | null): Promise<ServiceResult<CompanyBudgetSettings>> {
  return runService(async () => {
    const block = denied<CompanyBudgetSettings>(tenantId, roleKey); if (block) return block;
    const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Verbindung zu den Unternehmensdaten nicht verfügbar.' };
    const [years, types, defaults] = await Promise.all([
      fromUnknownTable(client, 'tenant_budget_years').select('*').eq('tenant_id', tenantId).order('budget_year', { ascending: false }),
      fromUnknownTable(client, 'tenant_budget_types').select('*').eq('tenant_id', tenantId).order('sort_order'),
      fromUnknownTable(client, 'tenant_budget_defaults').select('*').eq('tenant_id', tenantId),
    ]);
    const error = years.error ?? types.error ?? defaults.error; if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: {
      years: (years.data ?? []).map((row: Row) => ({ id: text(row.id), tenantId, budgetYear: Number(row.budget_year), label: text(row.label) || null, isActive: !!row.is_active })),
      types: (types.data ?? []).map((row: Row) => ({ id: text(row.id), tenantId, budgetTypeKey: text(row.budget_type_key), name: text(row.name), description: text(row.description) || null, period: row.period as TenantBudgetType['period'], currency: text(row.currency), isActive: !!row.is_active, sortOrder: Number(row.sort_order) })),
      defaults: (defaults.data ?? []).map(mapDefault),
    } };
  });
}

export function parseCompanyAmount(value: string, percent = false): ServiceResult<number | null> {
  const trimmed = value.trim(); if (!trimmed) return { ok: true, data: null };
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(trimmed)) return { ok: false, error: 'Bitte einen Betrag ab 0 mit höchstens zwei Nachkommastellen eintragen.' };
  const amount = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100))) return { ok: false, error: 'Der eingegebene Betrag ist zu groß.' };
  if (percent && amount > 100) return { ok: false, error: 'Der Prozentsatz muss zwischen 0 und 100 liegen.' };
  return { ok: true, data: amount };
}

export async function saveCompanyServiceType(tenantId: string, roleKey: RoleKey | null, id: string, values: { name: string; description: string }): Promise<ServiceResult<CompanyServiceType>> {
  return runService(async () => {
    const block = denied<CompanyServiceType>(tenantId, roleKey); if (block) return block;
    if (!id || !values.name.trim()) return { ok: false, error: 'Bitte eine Bezeichnung eintragen.' };
    const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Verbindung zu den Unternehmensdaten nicht verfügbar.' };
    const { data, error } = await fromUnknownTable(client, 'tenant_client_service_types').update({ name: values.name.trim(), description: values.description.trim() || null }).eq('tenant_id', tenantId).eq('id', id).select('*').maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return data ? { ok: true, data: mapType(data) } : { ok: false, error: 'Die Leistungsart wurde nicht gespeichert. Bitte den gespeicherten Stand neu laden.' };
  });
}

export async function saveCompanyBillingRate(tenantId: string, roleKey: RoleKey | null, id: string, rate: string): Promise<ServiceResult<CompanyBillingRule>> {
  return runService(async () => {
    const block = denied<CompanyBillingRule>(tenantId, roleKey); if (block) return block;
    const amount = parseCompanyAmount(rate); if (!amount.ok) return amount;
    const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Verbindung zu den Unternehmensdaten nicht verfügbar.' };
    const { data, error } = await fromUnknownTable(client, 'tenant_service_type_billing_rules').update({ default_rate_amount: amount.data }).eq('tenant_id', tenantId).eq('id', id).select('*').maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return data ? { ok: true, data: mapRule(data) } : { ok: false, error: 'Die Abrechnungsregel wurde nicht gespeichert. Bitte den gespeicherten Stand neu laden.' };
  });
}

export async function saveCompanyBudgetDefault(tenantId: string, roleKey: RoleKey | null, id: string, values: { amount: string; monthly: string; yearly: string; conversion: string; notes: string }): Promise<ServiceResult<TenantBudgetDefault>> {
  return runService(async () => {
    const block = denied<TenantBudgetDefault>(tenantId, roleKey); if (block) return block;
    const amount = parseCompanyAmount(values.amount); if (!amount.ok) return amount;
    if (amount.data === null) return { ok: false, error: 'Bitte den Grundbetrag eintragen. Für keinen Betrag können Sie 0 verwenden.' };
    const monthly = parseCompanyAmount(values.monthly); if (!monthly.ok) return monthly;
    const yearly = parseCompanyAmount(values.yearly); if (!yearly.ok) return yearly;
    const conversion = parseCompanyAmount(values.conversion, true); if (!conversion.ok) return conversion;
    const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Verbindung zu den Unternehmensdaten nicht verfügbar.' };
    const cents = (value: number | null) => value === null ? null : Math.round(value * 100);
    const { data, error } = await fromUnknownTable(client, 'tenant_budget_defaults').update({ amount_cents: cents(amount.data), monthly_amount_cents: cents(monthly.data), yearly_amount_cents: cents(yearly.data), conversion_rate_pct: conversion.data, notes: values.notes.trim() || null }).eq('tenant_id', tenantId).eq('id', id).select('*').maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return data ? { ok: true, data: mapDefault(data) } : { ok: false, error: 'Die Budgetvorlage wurde nicht gespeichert. Bitte den gespeicherten Stand neu laden.' };
  });
}

export const companyRateUnit = (value: string): string => ({ hour: 'Stunde', hours: 'Stunde', visit: 'Einsatz', day: 'Tag', flat: 'Pauschale', km: 'Kilometer', month: 'Monat', minute: 'Minute' })[value] ?? 'Einheit';
export const companyMoney = (value: number | null | undefined, cents = false) => value == null || !Number.isFinite(value) ? 'Nicht hinterlegt' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents ? value / 100 : value);
export const currentCompanyBudgetYear = () => Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date()));
