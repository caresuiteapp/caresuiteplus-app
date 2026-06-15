import { getServiceMode, type ServiceMode } from './mode';

export type ServiceBackend<TDemo, TSupabase> = {
  demo: TDemo;
  supabase: TSupabase;
};

/** Wählt Demo- oder Supabase-Backend basierend auf getServiceMode(). */
export function pickServiceBackend<TDemo, TSupabase>(
  backends: ServiceBackend<TDemo, TSupabase>,
): TDemo | TSupabase {
  return getServiceMode() === 'supabase' ? backends.supabase : backends.demo;
}

export function isSupabaseServiceMode(): boolean {
  return getServiceMode() === 'supabase';
}

export function currentServiceMode(): ServiceMode {
  return getServiceMode();
}
