import type {ReactNode} from 'react';
import {Link} from 'expo-router';
import {LiquidLogo,LiquidVisualModeProvider} from './LiquidPrimitives';

/** Public pages do not import an authenticated workspace or trigger sign-in. */
export function PublicAccessShell({children}:{children:ReactNode}) {
  return <LiquidVisualModeProvider mode="classic"><main className="cs-public-shell">
    <style>{`.cs-public-shell{box-sizing:border-box;min-height:100vh;width:100%;overflow:auto;background:radial-gradient(ellipse at top left,#0b2a50 0%,#061324 45%,#030812 100%);padding:25px max(18px,calc((100% - 1100px)/2)) 55px;color:#eaf3ff;font-family:Arial,Helvetica,sans-serif}.cs-public-shell nav{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:45px}.cs-public-shell nav a{color:#a6d9ff;padding:11px 15px;text-decoration:none;border:1px solid #345681;border-radius:12px}.cs-public-shell header{max-width:740px;margin-bottom:28px}.cs-public-shell .eyebrow{color:#86cbff;font-size:11px;letter-spacing:2px;font-weight:700}.cs-public-shell h1{font-size:clamp(34px,5vw,56px);line-height:1.1;letter-spacing:-1.5px;margin:17px 0 20px;color:white}.cs-public-shell .intro{font-size:16px;line-height:1.8;color:#b5cbe4}.cs-public-shell .content{max-width:900px}@media(max-width:600px){.cs-public-shell{padding-top:18px}.cs-public-shell nav{margin-bottom:28px}}`}</style>
    <nav aria-label="Öffentliche Navigation"><LiquidLogo width={260}/><Link href="/auth">Zur Login-Übersicht →</Link></nav>
    <header><p className="eyebrow">CARESUITE HEALTHOS · ÖFFENTLICHER SUPPORT</p><h1>Wir sind für Sie da.</h1><p className="intro">Fragen zu CareSuite HealthOS, Hilfe bei der Anmeldung oder ein technisches Problem? Reichen Sie Ihr Ticket hier ein – auch ohne Konto und ohne Anmeldung.</p></header>
    <div className="content">{children}</div>
  </main></LiquidVisualModeProvider>;
}
