import { getServiceClient, jsonResponse } from '../_shared/http.ts';
import {
  authorizeRegistrationWelcomeWorker,
  dispatchRegistrationWelcomeEmails,
  REGISTRATION_WELCOME_ENV_KEYS,
  type RegistrationWelcomeClient,
} from './worker.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  try {
    const client = getServiceClient() as unknown as RegistrationWelcomeClient;
    // Scheduled calls use a dedicated random token, never an exposed service key.
    if (!await authorizeRegistrationWelcomeWorker(client, req.headers.get('authorization'))) {
      return jsonResponse({ ok: false, error: 'Nicht autorisiert.' }, 401);
    }
    const env = Object.fromEntries(REGISTRATION_WELCOME_ENV_KEYS.map(key => [key, Deno.env.get(key)]));
    const result = await dispatchRegistrationWelcomeEmails(client, env);
    if (!result.configured) return jsonResponse({ ok: false, error: 'registration_mail_not_configured' }, 503);
    return jsonResponse({ ok: true, ...result });
  } catch {
    // Do not log recipients, raw provider errors, request bodies or credentials.
    return jsonResponse({ ok: false, error: 'registration_mail_dispatch_unconfirmed' }, 503);
  }
});
