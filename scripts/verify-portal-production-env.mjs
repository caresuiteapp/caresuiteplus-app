#!/usr/bin/env node

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  '';

const missing = [];
if (!url) missing.push('EXPO_PUBLIC_SUPABASE_URL');
if (!publishableKey) {
  missing.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY oder EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

if (missing.length > 0) {
  throw new Error(
    `AAB-Build abgebrochen: Im EAS-Environment production fehlt ${missing.join(' und ')}. ` +
      'Ohne diese Werte zeigt die App nur zwischengespeicherte Daten und kann weder Einsätze noch Nachrichten schreiben.',
  );
}

let host = '';
try {
  host = new URL(url).hostname;
} catch {
  throw new Error('AAB-Build abgebrochen: EXPO_PUBLIC_SUPABASE_URL ist keine gültige URL.');
}

if (!host.endsWith('.supabase.co')) {
  throw new Error(`AAB-Build abgebrochen: Unerwarteter Supabase-Host ${host}.`);
}

console.log(`EAS production: Live-Konfiguration vollständig (${host}); Schlüsselwert wird nicht ausgegeben.`);
