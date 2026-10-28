/** Legacy command retained; native icons use the approved Play artwork. */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.argv.length > 2) {
  throw new Error('Use the approved source in scripts/generate-app-icons.py; mascot overrides are no longer supported.');
}
execFileSync(process.env.PYTHON ?? 'python3', [fileURLToPath(new URL('./generate-app-icons.py', import.meta.url))], { stdio: 'inherit' });

