/**
 * Replace hardcoded white hero text with usePremiumHeroTextStyles().
 * Run: node scripts/fix-premium-hero-text-colors.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';

const root = path.resolve(import.meta.dirname, '..');
const files = globSync('src/**/*Hero.tsx', { cwd: root, absolute: true });

let updated = 0;

function addImport(content) {
  if (content.includes('usePremiumHeroTextStyles')) return content;
  if (content.includes("from '@/design/tokens/carelightadaptive'")) {
    return content.replace(
      /import \{([^}]+)\} from '@\/design\/tokens\/carelightadaptive';/,
      (match, imports) => {
        if (imports.includes('usePremiumHeroTextStyles')) return match;
        const trimmed = imports.trim().replace(/,\s*$/, '');
        return `import { ${trimmed}, usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';`;
      },
    );
  }
  if (content.includes("from '@/design/tokens/themeBridge'")) {
    return content.replace(
      "from '@/design/tokens/themeBridge';",
      "from '@/design/tokens/themeBridge';\nimport { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';",
    );
  }
  return content;
}

function addHook(content) {
  if (content.includes('usePremiumHeroTextStyles()')) return content;
  const patterns = [
    /const \{ colors, typography, gradients, mode \} = useLegacyTheme\(\);/,
    /const \{ colors, typography, gradients \} = useLegacyTheme\(\);/,
    /const \{ colors, typography \} = useLegacyTheme\(\);/,
    /const \{ typography, colors \} = useLegacyTheme\(\);/,
  ];
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      return content.replace(pattern, (m) => `${m}\n  const heroText = usePremiumHeroTextStyles();`);
    }
  }
  return content;
}

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('PremiumListHeroFrame') || !content.includes('#FFFFFF')) continue;

  content = addImport(content);
  content = addHook(content);
  if (!content.includes('usePremiumHeroTextStyles()')) continue;

  content = content.replace(
    /title:\s*\{\s*\.\.\.typography\.h2,\s*color:\s*'#FFFFFF',\s*fontWeight:\s*'800'\s*\}/g,
    'title: heroText.title',
  );
  content = content.replace(
    /title:\s*\{\s*\.\.\.typography\.h2,\s*color:\s*'#FFFFFF',\s*fontWeight:\s*'800',\s*\}/g,
    'title: heroText.title',
  );
  content = content.replace(
    /meta:\s*\{\s*\.\.\.typography\.caption,\s*color:\s*'rgba\(255,255,255,0\.75\)'\s*\}/g,
    'meta: heroText.meta',
  );
  content = content.replace(
    /title:\s*\{\s*\.\.\.typography\.h2,\s*color:\s*'#FFFFFF',\s*fontWeight:\s*'800' as TextStyle\['fontWeight'\],\s*\}/g,
    'title: heroText.title',
  );
  content = content.replace(
    /meta:\s*\{\s*\.\.\.typography\.caption,\s*color:\s*'rgba\(255,255,255,0\.75\)',\s*\}/g,
    'meta: heroText.meta',
  );
  content = content.replace(
    /meta:\s*\{\s*\.\.\.typography\.caption,\s*color:\s*withAlpha\('#FFFFFF', 0\.75\),\s*\}/g,
    'meta: heroText.meta',
  );
  content = content.replace(
    /subtitle:\s*\{\s*\.\.\.typography\.caption,\s*color:\s*'rgba\(255,255,255,0\.85\)',\s*\}/g,
    'subtitle: heroText.subtitle',
  );
  content = content.replace(
    /subtitle:\s*\{\s*\.\.\.typography\.caption,\s*color:\s*withAlpha\('#FFFFFF', 0\.85\),\s*\}/g,
    'subtitle: heroText.subtitle',
  );
  content = content.replace(
    /eyebrow:\s*\{\s*\.\.\.typography\.caption,\s*letterSpacing: designTokens\.hero\.eyebrowLetterSpacing,\s*color:\s*withAlpha\('#FFFFFF', 0\.85\),\s*\}/g,
    'eyebrow: heroText.eyebrow',
  );
  content = content.replace(
    /eyebrow:\s*\{\s*\.\.\.typography\.caption,\s*color:\s*'rgba\(255,255,255,0\.85\)',\s*letterSpacing: designTokens\.hero\.eyebrowLetterSpacing,\s*\}/g,
    'eyebrow: heroText.eyebrow',
  );
  content = content.replace(
    /eyebrow:\s*\{\s*\.\.\.typography\.caption,\s*letterSpacing: designTokens\.hero\.eyebrowLetterSpacing,\s*color:\s*'rgba\(255,255,255,0\.85\)',\s*\}/g,
    'eyebrow: heroText.eyebrow',
  );
  content = content.replace(/borderColor:\s*'rgba\(255,255,255,0\.4\)'/g, 'borderColor: heroText.iconBadge.borderColor');
  content = content.replace(
    /backgroundColor:\s*withAlpha\('#FFFFFF', 0\.16\)/g,
    'backgroundColor: heroText.iconBadge.backgroundColor',
  );

  if (content.includes('heroText.title')) {
    content = content.replace(/\], (\[colors[^\]]*\])\)/, (match, deps) => {
      if (deps.includes('heroText')) return match;
      return `], ${deps.replace(']', ', heroText]')})`;
    });
    content = content.replace(/\], (\[colors[^\]]*\]),/g, (match, deps) => {
      if (deps.includes('heroText')) return match;
      return `], ${deps.replace(']', ', heroText]')},`;
    });
  }

  fs.writeFileSync(file, content);
  updated += 1;
  console.log('updated', path.relative(root, file));
}

console.log(`Done. Updated ${updated} hero files.`);
