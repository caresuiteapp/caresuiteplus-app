// Exercise the real shared intake validator after its extraction from the service.
// Resolve the repository's TypeScript aliases only while this pure module loads.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    const local = specifier.startsWith('@/')
      ? path.join(root, 'src', specifier.slice(2))
      : specifier.startsWith('.') && context.parentURL?.startsWith('file:')
        ? path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
        : null;
    if (local) {
      for (const suffix of ['', '.ts', '.tsx', '.js', '/index.ts']) {
        const candidate = local + suffix;
        if (existsSync(candidate) && path.extname(candidate)) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
let validation;
try {
  const { validateIntakeStep, hasIntakeErrors } = await import('../../../src/lib/clients/clientIntakeValidation.ts');
  validation = Object.freeze({ validateIntakeStep, hasIntakeErrors });
} finally {
  hook.deregister();
}
export const currentIntakeValidation = validation;
