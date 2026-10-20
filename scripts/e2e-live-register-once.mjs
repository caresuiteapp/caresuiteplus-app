#!/usr/bin/env node
/** One-shot live registration E2E against register-business-tenant. */
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);

const ts = Math.floor(Date.now() / 1000);
const email = `test-admin+${ts}@caresuiteplus.local`;
const body = {
  companyName: 'Test Pflege GmbH',
  legalForm: 'GmbH',
  industry: 'Ambulanter Pflegedienst',
  street: 'Teststrasse 1',
  zip: '50667',
  city: 'Koeln',
  phone: '+49 221 123456',
  email: `kontakt+${ts}@caresuiteplus.local`,
  contactFirstName: 'Test',
  contactLastName: 'Kontakt',
  contactRole: 'Geschaeftsfuehrung',
  adminFirstName: 'Test',
  adminLastName: 'Admin',
  adminEmail: email,
  adminPassword: 'Test1234!0',
  selectedModules: ['assist'],
};

const url = `${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/register-business-tenant`;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const response = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    apikey: key,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const text = await response.text();
console.log('STATUS', response.status);
console.log(text);
console.log('TEST_EMAIL', email);
