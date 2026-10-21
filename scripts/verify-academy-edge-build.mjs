import { build } from 'esbuild';

// Includes callers of changed shared Auth/AI/Google/document helpers. Bundling
// proves local import/syntax integrity; it does not execute Hosted Edge auth.
const functions = [
  'ai-action-dispatch', 'ai-commit-approved-action', 'ai-realtime-token', 'ai-text-chat',
  'central-document-record', 'client-portal-login', 'connect-provider-proxy',
  'employee-plan-analyze', 'employee-portal-login', 'google-workspace-auth',
  'google-workspace-proxy', 'office-push-receipts', 'office-push-send',
  'portal-session-refresh', 'render-document-pdf', 'send-document-email',
  'send-document-fax', 'ti-provider-proxy', 'tv-device-login',
];
await build({
  entryPoints: functions.map(name => `supabase/functions/${name}/index.ts`),
  outdir: 'unused-academy-edge-verification', outbase: 'supabase/functions',
  bundle: true, write: false, platform: 'neutral', format: 'esm',
  external: ['https://*', 'jsr:*', 'npm:*'], logLevel: 'warning',
});
console.log(`${functions.length} affected Edge entry points bundled locally without execution or deployment.`);
