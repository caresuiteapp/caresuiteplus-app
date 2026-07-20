import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';
import { DISABLE_HOVER_EFFECTS_CSS } from '@/design/web/disableHoverEffectsCss';
import { GLASS_SCROLLBARS_CSS } from '@/design/web/glassScrollbarsCss';
import { LLGAN_GLASS_SURFACE_CSS } from '@/design/web/lightLiquidGlassSurfaceCss';
import { INVISIBLE_SCROLLBARS_CSS } from '@/design/web/invisibleScrollbarsCss';
import { WEB_FONT_SCALE_CSS } from '@/design/web/webFontScaleCss';
import { WEB_SAFE_AREA_GLOBAL_CSS } from '@/lib/platform/webSafeArea';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="theme-color" content="#030A18" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              ${LLGAN_GLASS_SURFACE_CSS}
              ${WEB_FONT_SCALE_CSS}
              ${WEB_SAFE_AREA_GLOBAL_CSS}
              ${DISABLE_HOVER_EFFECTS_CSS}
              ${INVISIBLE_SCROLLBARS_CSS}
              ${GLASS_SCROLLBARS_CSS}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
