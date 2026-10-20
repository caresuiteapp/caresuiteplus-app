export const webStartChoiceStyles = String.raw`
.cs-start-screen{position:relative;isolation:isolate;width:100%;height:100%;min-height:0;overflow:auto;background:#040c1b;color:#f5f9ff;font-family:"CareSuite Century Gothic","Century Gothic",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;color-scheme:dark;overscroll-behavior:contain}
.cs-start-screen *{box-sizing:border-box}
.cs-start-atmosphere{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:-1;min-height:100%}
.cs-start-halo{position:absolute;border-radius:50%;filter:blur(85px);opacity:.24;will-change:transform}
.cs-start-halo-one{width:min(75vw,1000px);height:650px;left:-20%;top:-300px;background:#155ac9}
.cs-start-halo-two{width:660px;height:660px;right:-280px;top:30%;background:#047d8b;opacity:.13}
.cs-start-stars{position:absolute;inset:0;opacity:.5;background:radial-gradient(1px 1px at 13% 19%,#b2eaff,transparent),radial-gradient(2px 2px at 73% 12%,#b2eaff,transparent),radial-gradient(1px 1px at 39% 32%,#b2eaff,transparent),radial-gradient(1px 1px at 87% 39%,#b2eaff,transparent),radial-gradient(1px 1px at 7% 74%,#b2eaff,transparent),radial-gradient(2px 2px at 92% 82%,#b2eaff,transparent),radial-gradient(1px 1px at 59% 91%,#b2eaff,transparent)}
.cs-start-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(135,191,229,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(135,191,229,.035) 1px,transparent 1px);background-size:100px 100px;mask-image:linear-gradient(#000,transparent 80%)}
.cs-start-horizon{position:absolute;left:8%;right:8%;top:53%;height:1px;background:linear-gradient(90deg,transparent,#428ecd55,#4bdfe078,transparent);box-shadow:0 0 70px 15px #1395ff0a}
.cs-start-opening{position:absolute;inset:0;overflow:hidden;pointer-events:none;opacity:0}
.cs-start-opening-left,.cs-start-opening-right{position:absolute;top:-20%;bottom:-20%;width:55%;filter:blur(25px);background:linear-gradient(90deg,transparent,#078ce415 50%,#52d9ff70 99%,#d8faff);opacity:0}
.cs-start-opening-left{right:50%}.cs-start-opening-right{left:50%;transform:scaleX(-1)}
.cs-start-opening-flare{position:absolute;width:2px;height:80%;top:5%;left:50%;background:#dcfaff;box-shadow:0 0 35px 14px #3bb8ef90,0 0 120px 45px #0868eb55;opacity:0}
.cs-start-opening-ring{position:absolute;left:50%;top:47%;width:52vw;height:52vw;margin-left:-26vw;margin-top:-26vw;border:1px solid #a4eaff70;border-radius:50%;box-shadow:0 0 40px #40baff15,inset 0 0 35px #67bdff10;opacity:0}
.cs-start-inner{position:relative;max-width:1424px;width:100%;min-height:100%;margin:0 auto;padding:32px 64px 25px;display:flex;flex-direction:column}
.cs-start-topbar{display:flex;align-items:center;justify-content:space-between;gap:20px;flex:none}
.cs-start-brand{width:280px;max-width:45%;height:auto;object-fit:contain}
.cs-start-motion{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:8px 14px;border:1px solid #a5c4f122;background:#d8eaff06;color:#a6bdd6;font-family:inherit;font-size:12px;font-weight:500;line-height:1.4;border-radius:50px;cursor:pointer;transition:background .2s,color .2s}
.cs-start-motion:hover{background:#d8eaff10;color:#fff}
.cs-start-motion:disabled{opacity:.7;cursor:default}
.cs-start-motion svg{width:17px;height:17px;flex:none}
.cs-start-heading{margin:clamp(40px,6.1vh,78px) 0 34px;text-align:center}
.cs-start-eyebrow{margin:0 0 18px;display:flex;align-items:center;justify-content:center;gap:9px;color:#a7bfd9;font-size:11px;font-weight:600;letter-spacing:.19em;text-transform:uppercase}
.cs-start-eyebrow>span{width:5px;height:5px;border-radius:50%;background:#7ee8f4;box-shadow:0 0 12px #47ddec;flex:none}
.cs-start-heading h1{font-size:clamp(34px,3.5vw,54px);line-height:1.12;letter-spacing:-.045em;font-weight:600;margin:0;color:#fff;text-wrap:balance}
.cs-start-heading h1>span{color:#9edcff}
.cs-start-introduction{font-size:15px;line-height:1.65;color:#9eafc4;margin:18px auto 0;max-width:650px;text-wrap:balance}
.cs-start-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;perspective:1500px;width:100%;max-width:1110px;margin:0 auto}
.cs-start-card{position:relative;isolation:isolate;display:flex;flex-direction:column;min-width:0;padding:0;text-align:left;color:inherit;text-decoration:none;font:inherit;border:1px solid #adcaff30;background:linear-gradient(140deg,#17263ee8,#0b172de8 65%);border-radius:24px;box-shadow:0 16px 60px #0004;cursor:pointer;transform:perspective(1200px) rotateX(var(--cs-start-rx,0deg)) rotateY(var(--cs-start-ry,0deg));transition:transform .24s ease,border-color .24s ease,box-shadow .24s ease;overflow:hidden;-webkit-tap-highlight-color:transparent}
.cs-start-card:hover{border-color:#8edcff77;box-shadow:0 16px 80px #0589e922,0 0 0 1px #77bbff11}
.cs-start-card-media{position:relative;display:block;width:100%;height:213px;overflow:hidden;background:#05111f;border-bottom:1px solid #8fc5ff18}
.cs-start-card-media img{display:block;user-select:none;pointer-events:none}
.cs-start-orbit-image{width:100%;height:100%;object-fit:cover;object-position:68% 52%;transform:scale(1.02);transition:transform 1.2s cubic-bezier(.2,.7,.2,1)}
.cs-start-media-shade{position:absolute;inset:0;background:linear-gradient(0deg,#07162da1,transparent 55%);pointer-events:none}
.cs-start-website .cs-start-media-shade{background:linear-gradient(90deg,#061324b0,transparent 68%),linear-gradient(0deg,#07162d77,transparent 55%)}
.cs-start-media-label{position:absolute;left:22px;top:19px;border:1px solid #bddcff35;padding:6px 9px;border-radius:30px;background:#07132299;backdrop-filter:blur(12px);font-size:9px;line-height:1.3;letter-spacing:.13em;text-transform:uppercase;color:#d4e7fa;font-weight:500}
.cs-start-media-word{position:absolute;left:29px;bottom:24px;font-size:36px;line-height:1.03;letter-spacing:-.045em;font-weight:500;color:#eef8ff}
.cs-start-media-word em{font-style:normal;color:#94dfff}
.cs-start-software-glow{position:absolute;inset:0;background:radial-gradient(ellipse at 65% 15%,#2278bf65,transparent 70%)}
.cs-start-desktop-image{position:absolute;width:82%;height:auto;max-width:none;left:12%;top:34px;transform:perspective(900px) rotateY(-8deg) rotateX(4deg) rotateZ(-2deg);transform-origin:center center;border:1px solid #c5e6ff80;border-radius:7px;box-shadow:-12px 12px 50px #0009;transition:transform 1s cubic-bezier(.2,.7,.2,1)}
.cs-start-software .cs-start-media-label{top:auto;bottom:16px;z-index:1;background:#061321cf}
.cs-start-card-content{position:relative;display:flex;flex:1;flex-direction:column;padding:26px 30px 25px;z-index:2}
.cs-start-card-kicker{display:block;font-size:10px;line-height:1.4;letter-spacing:.18em;text-transform:uppercase;color:#7f9bbb;font-weight:600}
.cs-start-card-title{display:block;font-size:31px;line-height:1.18;letter-spacing:-.035em;font-weight:600;margin-top:11px}
.cs-start-card-description{display:block;font-size:14px;line-height:1.65;color:#a7bad1;margin-top:11px;max-width:350px;min-height:47px}
.cs-start-card-action{display:flex;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid #b8d4ff1a;padding-top:21px;margin-top:23px;color:#d5edff;font-size:13px;line-height:1.4;font-weight:600}
.cs-start-arrow{display:grid;place-items:center;width:35px;height:35px;border:1px solid #9bdcff4a;border-radius:50%;color:#8bdbff;background:#208ac10a;transition:background .24s,transform .24s}
.cs-start-arrow svg{width:19px;height:19px}
.cs-start-software .cs-start-arrow{background:#b4e9ff;color:#072740;border-color:#d4f3ff}
.cs-start-card-sheen{position:absolute;inset:0;border-radius:inherit;z-index:3;pointer-events:none;background:radial-gradient(500px circle at var(--cs-start-x,50%) var(--cs-start-y,0%),#b1eaff10,transparent 55%);opacity:0;transition:opacity .3s}
.cs-start-card:hover .cs-start-card-sheen{opacity:1}
.cs-start-card:hover .cs-start-arrow{transform:translateX(3px);background:#4abaff30}
.cs-start-software:hover .cs-start-arrow{background:#e2f8ff}
.cs-start-screen[data-motion="true"] .cs-start-card:hover .cs-start-orbit-image{transform:scale(1.085)}
.cs-start-screen[data-motion="true"] .cs-start-card:hover .cs-start-desktop-image{transform:perspective(900px) rotateY(-3deg) rotateX(1deg) rotateZ(-1deg) translateY(-3px)}
.cs-start-footer{display:flex;justify-content:space-between;align-items:center;gap:16px;font-size:10px;line-height:1.5;letter-spacing:.02em;color:#69819e;max-width:1110px;width:100%;margin:27px auto 0;padding-top:16px;padding-bottom:4px}
.cs-start-footer strong{color:#8cabc6;font-weight:500}
.cs-start-card:focus-visible,.cs-start-motion:focus-visible{outline:3px solid #a0e5ff;outline-offset:5px;box-shadow:0 0 0 7px #061326,0 0 40px #299de844}
.cs-start-screen[data-opening="true"][data-motion="true"] .cs-start-opening{opacity:1}
.cs-start-screen[data-opening="true"][data-motion="true"] .cs-start-opening-left{animation:cs-start-open-left 1.65s cubic-bezier(.16,.8,.2,1) both}
.cs-start-screen[data-opening="true"][data-motion="true"] .cs-start-opening-right{animation:cs-start-open-right 1.65s cubic-bezier(.16,.8,.2,1) both}
.cs-start-screen[data-opening="true"][data-motion="true"] .cs-start-opening-flare{animation:cs-start-flare 1.3s ease-out both}
.cs-start-screen[data-opening="true"][data-motion="true"] .cs-start-opening-ring{animation:cs-start-ring 1.8s .05s cubic-bezier(.16,.8,.2,1) both}
.cs-start-screen[data-opening="true"][data-motion="true"] .cs-start-heading{animation:cs-start-reveal 1s .12s both}
.cs-start-screen[data-opening="true"][data-motion="true"] .cs-start-card{animation:cs-start-reveal 1.2s .28s both}
.cs-start-screen[data-opening="true"][data-motion="true"] .cs-start-software{animation-delay:.4s}
.cs-start-screen[data-active="true"][data-motion="true"] .cs-start-halo-one{animation:cs-start-drift 18s ease-in-out infinite alternate}
.cs-start-screen[data-active="true"][data-motion="true"] .cs-start-halo-two{animation:cs-start-drift 24s ease-in-out infinite alternate-reverse}
.cs-start-screen[data-active="true"][data-motion="true"] .cs-start-stars{animation:cs-start-starlight 7s ease-in-out infinite alternate}
.cs-start-screen[data-motion="false"] .cs-start-card{transform:none}
.cs-start-screen[data-motion="false"] *{animation:none!important;transition:none!important}
@keyframes cs-start-reveal{from{opacity:0;translate:0 20px;filter:blur(5px)}to{opacity:1;translate:0 0;filter:blur(0)}}
@keyframes cs-start-open-left{0%{opacity:0;translate:8% 0}10%{opacity:.9}100%{opacity:0;translate:-110% 0}}
@keyframes cs-start-open-right{0%{opacity:0;translate:-8% 0}10%{opacity:.9}100%{opacity:0;translate:110% 0}}
@keyframes cs-start-flare{0%{opacity:0;scale:1 .15}12%{opacity:.85;scale:1 .8}100%{opacity:0;scale:5 1.25}}
@keyframes cs-start-ring{0%{opacity:0;scale:.05}15%{opacity:.65}100%{opacity:0;scale:2.8}}
@keyframes cs-start-starlight{from{opacity:.22}to{opacity:.7}}
@keyframes cs-start-drift{from{transform:translate3d(0,0,0)}to{transform:translate3d(8%,9%,0)}}
/* Large screens gain surrounding space; content keeps a bounded visual scale. */
@media(min-width:901px){
  .cs-start-inner{max-width:1280px;padding:28px 48px 24px;justify-content:center}
  .cs-start-brand{width:260px}
  .cs-start-heading{margin:clamp(28px,4vh,48px) 0 26px}
  .cs-start-heading h1{font-size:clamp(36px,2.6vw,48px)}
  .cs-start-choices{max-width:1040px}
  .cs-start-card-media{height:180px;flex-shrink:0}
  .cs-start-media-word{font-size:32px;left:26px;bottom:20px}
  .cs-start-desktop-image{top:26px}
  .cs-start-card-content{padding:22px 26px}
  .cs-start-card-title{font-size:29px;margin-top:10px}
  .cs-start-card-description{margin-top:10px}
  .cs-start-card-action{padding-top:17px;margin-top:18px}
  .cs-start-footer{max-width:1040px;margin-top:18px;padding-top:12px}
}
/* Compress the image stages and spacing when TV/browser chrome leaves less height. */
@media(min-width:901px) and (max-height:800px){
  .cs-start-inner{padding:20px 36px}
  .cs-start-brand{width:240px}
  .cs-start-heading{margin:24px 0 22px}
  .cs-start-eyebrow{margin-bottom:12px}
  .cs-start-heading h1{font-size:38px}
  .cs-start-introduction{margin-top:12px}
  .cs-start-card-media{height:145px}
  .cs-start-media-label{top:14px;left:20px}
  .cs-start-media-word{font-size:28px;left:23px;bottom:16px}
  .cs-start-desktop-image{top:18px}
  .cs-start-software .cs-start-media-label{top:auto;bottom:12px}
  .cs-start-card-content{padding:18px 24px}
  .cs-start-card-title{font-size:28px;margin-top:8px}
  .cs-start-card-description{margin-top:9px}
  .cs-start-card-action{padding-top:13px;margin-top:14px}
  .cs-start-footer{margin-top:15px;padding-top:8px}
}
@media(max-width:900px){.cs-start-inner{padding:25px 28px}.cs-start-brand{width:245px}.cs-start-heading{margin:44px 0 30px}.cs-start-heading h1{font-size:39px;max-width:640px;margin:auto}.cs-start-choices{gap:18px}.cs-start-card-media{height:190px}.cs-start-card-content{padding:23px}.cs-start-card-title{font-size:28px}.cs-start-card-description{font-size:13px;min-height:65px}.cs-start-card-action{font-size:12px}.cs-start-media-word{font-size:30px;left:23px}}
@media(max-width:620px){.cs-start-inner{padding:20px 20px 24px}.cs-start-topbar{gap:10px;flex-wrap:wrap}.cs-start-brand{width:225px;max-width:100%}.cs-start-motion{min-height:44px;padding:8px 11px;font-size:10px;margin-left:auto}.cs-start-motion svg{width:15px;height:15px}.cs-start-heading{margin:35px 0 25px;text-align:left}.cs-start-eyebrow{justify-content:flex-start;font-size:9px;letter-spacing:.14em;margin-bottom:15px}.cs-start-heading h1{font-size:35px;line-height:1.12;letter-spacing:-.045em}.cs-start-heading h1>span{display:block;margin-top:3px;max-width:320px}.cs-start-introduction{font-size:13px;line-height:1.6;margin-top:15px;max-width:340px;text-wrap:initial}.cs-start-choices{grid-template-columns:1fr;gap:19px;max-width:460px}.cs-start-card{border-radius:21px}.cs-start-card-media{height:170px}.cs-start-card-content{padding:22px 23px 19px}.cs-start-card-title{font-size:29px;margin-top:9px}.cs-start-card-description{font-size:13px;min-height:0;max-width:310px;margin-top:10px}.cs-start-card-kicker{font-size:9px}.cs-start-card-action{font-size:13px;margin-top:18px;padding-top:16px;min-height:54px}.cs-start-media-label{left:18px;top:15px;font-size:8px}.cs-start-media-word{left:24px;bottom:20px;font-size:31px}.cs-start-desktop-image{top:27px}.cs-start-footer{font-size:9px;align-items:flex-start;margin-top:17px;gap:12px}.cs-start-footer>span:last-child{max-width:145px;text-align:right}}
@media(prefers-reduced-motion:reduce){.cs-start-screen *{animation:none!important;transition:none!important}.cs-start-card{transform:none!important}.cs-start-halo{will-change:auto}}
@media(forced-colors:active){.cs-start-card,.cs-start-motion{border:1px solid ButtonText}.cs-start-card:focus-visible,.cs-start-motion:focus-visible{outline:3px solid Highlight}.cs-start-card-description,.cs-start-introduction,.cs-start-card-kicker{color:CanvasText}}
`;
