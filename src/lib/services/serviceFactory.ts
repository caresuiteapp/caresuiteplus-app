import { getServiceMode, type ServiceMode } from './mode';

export type ServiceBackend<TDemo, TSupabase> = {
  demo: TDemo;
  supabase: TSupabase;
};

/** Live-only — always returns the Supabase backend. */
export function pickServiceBackend<TDemo, TSupabase>(
  backends: ServiceBackend<TDemo, TSupabase>,
): TSupabase {
  return backends.supabase;
}

export function isSupabaseServiceMode(): boolean {
  return getServiceMode() === 'supabase';
}

export function currentServiceMode(): ServiceMode {
  return getServiceMode();
}
