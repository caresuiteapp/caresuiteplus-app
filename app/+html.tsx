import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';
import { DISABLE_HOVER_EFFECTS_CSS } from '@/product-workflows/design/web/disableHoverEffectsCss';
import { GLASS_SCROLLBARS_CSS } from '@/product-workflows/design/web/glassScrollbarsCss';
import { LLGAN_GLASS_SURFACE_CSS } from '@/product-workflows/design/web/lightLiquidGlassSurfaceCss';
import { INVISIBLE_SCROLLBARS_CSS } from '@/product-workflows/design/web/invisibleScrollbarsCss';
import { WEB_FONT_SCALE_CSS } from '@/product-workflows/design/web/webFontScaleCss';
import { HEALTHOS_PAGE_CONTRACT_CSS } from '@/product-workflows/design/web/healthOSPageContractCss';
import { WEB_SAFE_AREA_GLOBAL_CSS } from '@/lib/platform/webSafeArea';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="theme-color" content="#071225" />
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
              ${HEALTHOS_PAGE_CONTRACT_CSS}
              ${WEB_SAFE_AREA_GLOBAL_CSS}
              ${DISABLE_HOVER_EFFECTS_CSS}
              ${INVISIBLE_SCROLLBARS_CSS}
              ${GLASS_SCROLLBARS_CSS}
              #caresuite-web-boot {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background:
                  radial-gradient(circle at 72% 18%, rgba(28, 142, 255, 0.25), transparent 38%),
                  linear-gradient(145deg, #020a18 0%, #071a34 58%, #06274a 100%);
                color: #f7fbff;
                font-family: Arial, Helvetica, sans-serif;
                text-align: center;
              }
              #caresuite-web-boot-card {
                width: min(520px, 100%);
                padding: 32px 24px;
                border: 1px solid rgba(116, 194, 255, 0.42);
                border-radius: 28px;
                background: rgba(4, 20, 43, 0.82);
                box-shadow: 0 24px 72px rgba(0, 0, 0, 0.34);
              }
              #caresuite-web-boot-brand {
                margin-bottom: 20px;
                color: #7fd5ff;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: 0.02em;
              }
              #caresuite-web-boot-spinner {
                width: 44px;
                height: 44px;
                margin: 0 auto 20px;
                border: 4px solid rgba(127, 213, 255, 0.22);
                border-top-color: #47a8ff;
                border-radius: 999px;
                animation: caresuite-web-boot-spin 0.85s linear infinite;
              }
              #caresuite-web-boot-title {
                margin: 0 0 8px;
                font-size: 22px;
                line-height: 1.25;
              }
              #caresuite-web-boot-message {
                margin: 0;
                color: rgba(231, 243, 255, 0.78);
                font-size: 16px;
                line-height: 1.5;
              }
              #caresuite-web-boot-retry {
                display: none;
                width: 100%;
                margin-top: 22px;
                padding: 14px 18px;
                border: 1px solid rgba(116, 194, 255, 0.62);
                border-radius: 16px;
                background: #0b78e3;
                color: white;
                font: inherit;
                font-weight: 800;
              }
              @keyframes caresuite-web-boot-spin {
                to { transform: rotate(360deg); }
              }
              @media (prefers-reduced-motion: reduce) {
                #caresuite-web-boot-spinner { animation-duration: 1.8s; }
              }
            `,
          }}
        />
      </head>
      <body>
        <div id="caresuite-web-boot" role="status" aria-live="polite">
          <div id="caresuite-web-boot-card">
            <div id="caresuite-web-boot-brand">CareSuite HealthOS</div>
            <div id="caresuite-web-boot-spinner" aria-hidden="true" />
            <h1 id="caresuite-web-boot-title">Anwendung wird sicher geladen</h1>
            <p id="caresuite-web-boot-message">
              Sitzung und Einsatzdaten werden wiederhergestellt.
            </p>
            <button id="caresuite-web-boot-retry" type="button">
              Erneut laden
            </button>
          </div>
        </div>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.setTimeout(function () {
                var boot = document.getElementById('caresuite-web-boot');
                if (!boot) return;
                var title = document.getElementById('caresuite-web-boot-title');
                var message = document.getElementById('caresuite-web-boot-message');
                var retry = document.getElementById('caresuite-web-boot-retry');
                if (title) title.textContent = 'Die Verbindung dauert ungewöhnlich lange';
                if (message) message.textContent = 'Bitte Verbindung prüfen und anschließend erneut laden. Bereits gespeicherte Einsatzdaten bleiben erhalten.';
                if (retry) {
                  retry.style.display = 'block';
                  retry.onclick = function () { window.location.reload(); };
                }
              }, 20000);
            `,
          }}
        />
      </body>
    </html>
  );
}
