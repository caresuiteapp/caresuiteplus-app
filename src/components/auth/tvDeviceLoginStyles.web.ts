export const tvDeviceLoginStyles = `
.cs-device-login{--device-accent:#70dbff;color:#f3f8ff;font-family:inherit;box-sizing:border-box;width:100%;font-size:clamp(17px,1.18vw,25px)}
.cs-device-login *{box-sizing:border-box}.cs-tv-device{height:100%;min-height:0;overflow:auto;padding:clamp(24px,3.7vw,80px);background:radial-gradient(ellipse at 12% 5%,#1b4267 0,transparent 52%),radial-gradient(ellipse at 96% 100%,#103b58 0,transparent 45%),#06162b}.cs-tv-device>.cs-device-heading,.cs-tv-device>.cs-device-roles,.cs-tv-device>.cs-device-stage{max-width:2000px;margin-left:auto;margin-right:auto}.cs-tv-device .cs-device-button{min-height:64px}.cs-tv-device .cs-device-roles{scroll-margin-top:20px}.cs-device-login button,.cs-device-login a{font:inherit}.cs-device-login button{cursor:pointer}.cs-device-login button:disabled{cursor:wait;opacity:.56}.cs-device-login button:focus-visible,.cs-device-login a:focus-visible,.cs-device-login input:focus-visible{outline:4px solid #92e9ff;outline-offset:5px}
.cs-device-login h1,.cs-device-login h2,.cs-device-login h3,.cs-device-login p{margin:0}.cs-device-login p{line-height:1.55;color:#c9d8eb}.cs-device-kicker{font-size:.72em;letter-spacing:.19em;font-weight:800;color:var(--device-accent);text-transform:uppercase}.cs-device-heading{display:flex;justify-content:space-between;gap:24px;align-items:center;margin-bottom:24px}.cs-device-heading h2{font-size:clamp(29px,2.8vw,55px);line-height:1.13;margin:8px 0 12px;letter-spacing:-.025em}.cs-device-button{border:1px solid #496581;border-radius:16px;background:#102a44;color:#f6fbff;padding:14px 22px;min-height:54px;font-weight:700;transition:background .18s,border-color .18s}.cs-device-button:hover{background:#193a58;border-color:#91deff}.cs-device-button.primary{background:#b7edff;color:#062035;border-color:#b7edff}.cs-device-button.primary:hover{background:#e0f8ff}.cs-device-button.quiet{background:transparent}.cs-device-roles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:22px}.cs-device-role{border:1px solid #39526e;border-radius:22px;padding:21px;text-align:left;background:rgba(9,28,51,.9);color:#f5f9ff;min-height:108px}.cs-device-role[aria-pressed=true]{background:linear-gradient(125deg,#173f62,#112b49);border:2px solid #8adeff;padding:20px;box-shadow:0 0 32px #48bbff15}.cs-device-role strong{display:block;font-size:1.12em;margin-bottom:6px}.cs-device-role span{display:block;font-size:.78em;color:#bbcee4;line-height:1.4}.cs-device-stage{display:grid;grid-template-columns:minmax(255px,.72fr) minmax(0,1.28fr);gap:clamp(26px,3vw,64px);align-items:center;padding:clamp(24px,2.7vw,48px);border:1px solid #355271;border-radius:30px;background:linear-gradient(140deg,rgba(18,45,72,.96),rgba(5,20,40,.97));box-shadow:0 30px 85px #0004}.cs-device-qr-wrap{display:flex;flex-direction:column;gap:14px;align-items:center;text-align:center}.cs-device-qr{background:#fff;padding:12px;border-radius:19px;width:min(100%,360px);aspect-ratio:1;display:grid;place-items:center;overflow:hidden}.cs-device-qr img{width:100%;height:100%;display:block;image-rendering:pixelated}.cs-device-qr-empty{color:#173953;font-size:.88em;line-height:1.5;padding:25px}.cs-device-code{font-variant-numeric:tabular-nums;letter-spacing:.15em;font-weight:800;color:#e9f8ff;font-size:1.35em}.cs-device-code-label{font-size:.7em;letter-spacing:.08em;text-transform:uppercase;color:#b7cde3}.cs-device-steps{list-style:none;padding:0;margin:22px 0;display:grid;gap:20px}.cs-device-step{display:flex;gap:16px;align-items:flex-start}.cs-device-step-number{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border:1px solid #578bad;border-radius:12px;color:#aeeaff;font-weight:800}.cs-device-step strong{display:block;margin-bottom:5px;font-size:1.02em}.cs-device-step p{font-size:.85em}.cs-device-status{padding:13px 17px;border-radius:13px;background:#75d1ff0e;border:1px solid #416b88;line-height:1.45;font-size:.86em;color:#d7ecfa}.cs-device-error{border-color:#a9655a;background:#ff967a12;color:#ffd4c9}.cs-device-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}.cs-device-note{font-size:.72em!important;margin-top:20px!important;max-width:66ch}.cs-device-timer{font-size:.76em;color:#c2d8e9;font-variant-numeric:tabular-nums}.cs-device-timer progress{width:100%;height:4px;display:block;margin-top:9px;accent-color:#75d9ff}
/* Phone approval is a standalone surface, with one content frame and native scrolling. */
.cs-phone-device{height:100%;min-height:0;overflow:auto;overscroll-behavior-y:contain;font-size:16px;padding:max(20px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(28px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:radial-gradient(ellipse at 20% 0,#153b60 0,transparent 60%),#06162b}
.cs-phone-device-inner{width:100%;max-width:560px;min-width:0;margin:0 auto}
.cs-phone-device-brand{color:#f6faff;text-decoration:none;display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:20px;font-weight:800;min-height:44px;margin-bottom:12px}
.cs-phone-device-brand span{color:#85d6fb;font-weight:400}
.cs-phone-device-card{min-width:0;padding:26px;border-radius:24px;border:1px solid #3e5f7f;background:rgba(9,29,52,.94);box-shadow:0 14px 46px #0003}
.cs-phone-device h1{font-size:clamp(27px,5vw,34px);line-height:1.18;letter-spacing:-.02em;margin:10px 0 16px;overflow-wrap:break-word}
.cs-phone-device .cs-device-kicker{font-size:11px;letter-spacing:.14em}
.cs-phone-device .cs-device-code{font-size:clamp(34px,8vw,44px);margin:9px 0;letter-spacing:.12em;white-space:nowrap}
.cs-phone-device .cs-device-code-label{font-size:11px;line-height:1.5}
.cs-phone-device-code{margin:18px 0;padding:16px;text-align:center;border-radius:16px;border:1px solid #4a718f;background:#a1dfff09}
.cs-phone-device .cs-phone-device-hint{font-size:13px;line-height:1.5}
.cs-phone-device-account{padding:14px 0;border-top:1px solid #324f6c;border-bottom:1px solid #324f6c;margin:18px 0;overflow-wrap:anywhere}
.cs-phone-device .cs-phone-device-account-name{color:#f5faff;margin-top:6px;font-weight:700}
.cs-phone-device .cs-phone-device-account-role{font-size:13px;margin-top:2px}
.cs-phone-device .cs-device-button.cs-phone-device-switch{margin-top:12px;font-size:14px;min-height:44px;padding:10px 14px}
.cs-phone-device-check{display:flex;gap:11px;align-items:flex-start;margin:18px 0;line-height:1.5;font-size:15px;cursor:pointer}
.cs-phone-device-check input{margin:3px 0 0;width:23px;height:23px;flex:0 0 23px;accent-color:#79dbff}
.cs-phone-device .cs-device-actions{gap:10px;margin-top:16px}
.cs-phone-device .cs-device-actions>.primary{flex:1}
.cs-phone-device .cs-device-button{font-size:16px;line-height:1.4;min-height:48px;max-width:100%;padding:12px 16px;border-radius:14px;white-space:normal;overflow-wrap:anywhere}
.cs-phone-device .cs-device-status{font-size:14px;padding:12px 14px;overflow-wrap:anywhere}
.cs-phone-device .cs-device-note{font-size:13px!important;margin-top:16px!important}
.cs-device-login .cs-device-link{color:#a8e8ff;text-underline-offset:4px}
.cs-phone-device-close{display:inline-flex;align-items:center;min-height:44px;margin-top:16px;font-size:14px!important}
/* Keep the TV canvas bounded at Full HD and 4K; extra pixels become breathing room.
   These TV rules do not scale the phone confirmation surface. */
@media(min-width:781px){
  .cs-tv-device{font-size:17px;padding:clamp(20px,3vh,32px) clamp(24px,3vw,48px)}
  .cs-tv-device>.cs-device-heading,.cs-tv-device>.cs-device-roles,.cs-tv-device>.cs-device-stage{max-width:1180px}
  .cs-tv-device .cs-device-heading{gap:24px;margin-bottom:20px}
  .cs-tv-device .cs-device-heading h2{font-size:36px;margin:8px 0 10px}
  .cs-tv-device .cs-device-button{font-size:16px;min-height:48px;padding:12px 18px;border-radius:13px}
  .cs-tv-device .cs-device-heading>.cs-device-button{flex-shrink:0}
  .cs-tv-device .cs-device-roles{gap:14px;margin-bottom:18px}
  .cs-tv-device .cs-device-role{min-height:86px;padding:16px 18px;border-radius:18px}
  .cs-tv-device .cs-device-role[aria-pressed=true]{padding:15px 17px}
  .cs-tv-device .cs-device-stage{grid-template-columns:minmax(240px,.72fr) minmax(0,1.28fr);gap:32px;padding:26px;border-radius:24px}
  .cs-tv-device .cs-device-qr{width:min(100%,300px);padding:10px;border-radius:16px}
  .cs-tv-device .cs-device-qr-wrap{gap:10px}
  .cs-tv-device .cs-device-steps{margin:18px 0;gap:16px}
  .cs-tv-device .cs-device-step{gap:12px}
  .cs-tv-device .cs-device-step-number{width:34px;height:34px;flex-basis:34px;border-radius:10px}
  .cs-tv-device .cs-device-status{padding:11px 14px}
  .cs-tv-device .cs-device-actions{margin-top:14px}
  .cs-tv-device .cs-device-note{margin-top:14px!important}
}
@media(min-width:781px) and (max-height:800px){
  .cs-tv-device{font-size:16px;padding:18px 24px}
  .cs-tv-device .cs-device-heading{margin-bottom:14px;gap:18px}
  .cs-tv-device .cs-device-heading h2{font-size:30px;margin:6px 0}
  .cs-tv-device .cs-device-roles{gap:12px;margin-bottom:14px}
  .cs-tv-device .cs-device-role{min-height:74px;padding:12px 16px}
  .cs-tv-device .cs-device-role[aria-pressed=true]{padding:11px 15px}
  .cs-tv-device .cs-device-role strong{margin-bottom:4px}
  .cs-tv-device .cs-device-stage{gap:26px;padding:20px;grid-template-columns:minmax(220px,.66fr) minmax(0,1.34fr)}
  .cs-tv-device .cs-device-qr{width:min(100%,260px)}
  .cs-tv-device .cs-device-steps{gap:12px;margin:14px 0}
  .cs-tv-device .cs-device-step strong{margin-bottom:3px}
  .cs-tv-device .cs-device-actions{margin-top:12px}
  .cs-tv-device .cs-device-note{margin-top:12px!important}
}

@media(max-width:780px){.cs-tv-device{padding:24px 16px 42px}.cs-tv-device .cs-device-button{min-height:54px}.cs-device-heading{align-items:flex-start;flex-direction:column}.cs-device-heading>.cs-device-button{align-self:flex-end}.cs-device-roles{gap:8px}.cs-device-role{padding:13px 10px;border-radius:16px;min-height:96px}.cs-device-role[aria-pressed=true]{padding:12px 9px}.cs-device-role strong{font-size:.9em;overflow-wrap:anywhere}.cs-device-role span{font-size:.68em}.cs-device-stage{grid-template-columns:1fr;padding:23px;border-radius:23px;gap:26px}.cs-device-qr{width:270px}.cs-device-stage h3{font-size:1.25em}.cs-device-heading h2{font-size:31px}.cs-device-steps{gap:18px}.cs-device-actions>.cs-device-button{flex:1}.cs-phone-device .cs-device-actions{flex-direction:column}}
@media(max-width:480px){
  .cs-phone-device{padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right));padding-top:max(12px,env(safe-area-inset-top))}
  .cs-phone-device-card{padding:20px 18px;border-radius:20px}
  .cs-phone-device-brand{margin-bottom:8px}
  .cs-phone-device-code{padding:14px}
}
@media(prefers-reduced-motion:reduce){.cs-device-login *{transition:none!important}}
`;
