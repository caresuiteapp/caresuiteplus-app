import fs from 'node:fs';
import path from 'node:path';

const hooksDir = path.join(process.cwd(), 'src/hooks');
const files = fs.readdirSync(hooksDir).filter((f) => f.endsWith('Module.ts') && f.startsWith('use'));

for (const file of files) {
  const filePath = path.join(hooksDir, file);
  let src = fs.readFileSync(filePath, 'utf8');
  if (!src.includes('DEMO_TENANT_ID')) continue;

  src = src.replace(
    "import { DEMO_TENANT_ID } from '@/data/demo/tenant';\n",
    "import { useServiceTenantId } from '@/hooks/useTenantId';\n",
  );

  if (!src.includes('const tenantId = useServiceTenantId()')) {
    src = src.replace(
      '  const { profile } = useAuth();\n',
      '  const { profile } = useAuth();\n  const tenantId = useServiceTenantId();\n',
    );
  }

  src = src.replace(/fetch\w+\(DEMO_TENANT_ID, profile\?\.roleKey\)/g, (match) => {
    const fn = match.match(/fetch\w+/)[0];
    return `(() => { if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant am Profil hinterlegt.' }); return ${fn}(tenantId, profile?.roleKey); })()`;
  });

  src = src.replace(/\}, \[profile\?\.roleKey\]\);/g, '}, [tenantId, profile?.roleKey]);');

  fs.writeFileSync(filePath, src);
  console.log('fixed', file);
}
