import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';
import { DISABLE_HOVER_EFFECTS_CSS } from '@/design/web/disableHoverEffectsCss';
import { INVISIBLE_SCROLLBARS_CSS } from '@/design/web/invisibleScrollbarsCss';
import { WEB_FONT_SCALE_CSS } from '@/design/web/webFontScaleCss';

const ROOT_BG = '#050816';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root, #expo-root {
                background-color: ${ROOT_BG} !important;
              }
              ${WEB_FONT_SCALE_CSS}
              ${DISABLE_HOVER_EFFECTS_CSS}
              ${INVISIBLE_SCROLLBARS_CSS}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
