// Generated native presentation from src/components/assist/AssignmentsWorkspaceShell.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeStyle,NativeDiv,NativeButton,NativeHeader,NativeH1,NativeP,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../icons/WebActionIcon.native.tsx";
import type { ReactNode } from 'react';
import { ScreenShell } from "../layout/ScreenShell.tsx";
export const assignmentsWorkspaceCss = `
.aw-workspace{--aw-ink:#18334f;--aw-muted:#5c7088;--aw-line:#dce6f2;--aw-blue:#1268d6;--aw-cyan:#0c8292;color:var(--aw-ink);font-family:inherit;line-height:1.5;width:100%;min-width:0;container-type:inline-size;padding:8px 8px 24px;box-sizing:border-box}.aw-workspace *,.aw-workspace *:before,.aw-workspace *:after{box-sizing:border-box}.aw-workspace button,.aw-workspace input,.aw-workspace select,.aw-workspace textarea{font-family:inherit}.aw-workspace svg{flex-shrink:0}.aw-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:24px;padding:30px 32px;margin-bottom:24px;border:1px solid #d4e4f5;border-radius:26px;background:radial-gradient(ellipse at 91% 4%,#bfeeff75,transparent 50%),linear-gradient(120deg,#fff 10%,#f6faff 68%,#ebf4ff);box-shadow:0 10px 32px #285a8c0a,inset 0 1px 0 #fff;position:relative;overflow:hidden}.aw-hero:before{content:'';position:absolute;inset:0 20% auto 18%;height:1px;background:linear-gradient(90deg,transparent,#50a8ff,transparent)}.aw-hero-copy,.aw-hero-side{position:relative;z-index:1;min-width:0}.aw-eyebrow{display:flex;align-items:center;gap:8px;color:#176db4;font-size:11px;font-weight:750;letter-spacing:.12em;margin-bottom:9px}.aw-eyebrow:before{content:'';width:7px;height:7px;border-radius:50%;background:#279bca;box-shadow:0 0 0 5px #dceffa}.aw-hero h1{font-size:30px;line-height:1.2;letter-spacing:-.035em;margin:0;color:#173550;font-weight:750}.aw-hero p{font-size:14px;line-height:1.7;color:#526b85;margin:10px 0 0;max-width:690px}.aw-hero-side{display:grid;justify-items:end;gap:12px}.aw-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.aw-back{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;color:#476884;font-size:12px;font-weight:650;padding:3px 0;margin-bottom:14px;cursor:pointer}.aw-back:hover{color:#1268d6}.aw-content{display:grid;gap:20px;min-width:0}.aw-panel{background:#fff;border:1px solid #dce6f2;border-radius:20px;padding:22px;min-width:0;box-shadow:0 5px 20px #28548106}.aw-panel h2{font-size:18px;line-height:1.4;color:#1c3a58;margin:0 0 10px}.aw-panel h3{font-size:15px;color:#294866;margin:0 0 8px}.aw-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:10px 15px;border:1px solid #cfdeef;border-radius:12px;background:#fff;color:#275c94;font-size:13px;line-height:1.4;font-weight:650;cursor:pointer;text-decoration:none;transition:background .16s,border-color .16s,box-shadow .16s,transform .16s;max-width:100%;text-align:center}.aw-button:hover:not(:disabled){background:#f2f8ff;border-color:#9cbee5;box-shadow:0 4px 14px #2671c512;transform:translateY(-1px)}.aw-button--primary{background:linear-gradient(135deg,#197fe9,#165ed0);border-color:#146cd8;color:#fff;box-shadow:0 6px 16px #176fcd24}.aw-button--primary:hover:not(:disabled){background:linear-gradient(135deg,#1675dc,#165bbf);color:#fff}.aw-button--quiet{background:transparent;border-color:transparent;box-shadow:none}.aw-button--danger{color:#a82f35;border-color:#edcbcd;background:#fff8f8}.aw-button:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}.aw-button[aria-pressed=true]{background:#eaf3ff;border-color:#8fb9ec;color:#155cae}.aw-button--icon{padding:10px;min-width:40px}.aw-workspace :focus-visible,.aw-back:focus-visible,.aw-button:focus-visible,.aw-input:focus-visible,.aw-select:focus-visible{outline:3px solid #8bb7ef;outline-offset:3px}.aw-field{display:grid;gap:7px;min-width:0}.aw-label{font-size:12px;font-weight:650;color:#3d5875;line-height:1.5}.aw-input,.aw-select{width:100%;min-width:0;min-height:44px;background:#fff;border:1px solid #ceddeb;border-radius:11px;color:#1c3853;padding:10px 12px;font-size:13px;line-height:1.5;box-shadow:0 1px 2px #16365004}.aw-input::placeholder{color:#77889c;opacity:1}.aw-input:focus,.aw-select:focus{border-color:#629ddd;box-shadow:0 0 0 3px #e5effd;outline:none}.aw-input:disabled,.aw-select:disabled{background:#f3f6fa;color:#63748a;cursor:not-allowed}.aw-input[aria-invalid=true],.aw-select[aria-invalid=true]{border-color:#d06368}.aw-field textarea.aw-input{min-height:105px;resize:vertical}.aw-hint{font-size:12px;line-height:1.65;color:#5e738a;margin:0}.aw-alert{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;padding:14px 17px;border:1px solid #cadff5;border-radius:13px;background:#eef6ff;color:#315676;font-size:13px;line-height:1.6;overflow-wrap:anywhere}.aw-alert p{margin:0}.aw-alert[data-tone=danger]{background:#fff4f4;border-color:#efcccf;color:#9d333c}.aw-alert[data-tone=warning]{background:#fff9ed;border-color:#ebd9b2;color:#866019}.aw-alert[data-tone=success]{background:#edf9f4;border-color:#c5e5d5;color:#24654c}.aw-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border:1px solid #d9e5f2;border-radius:8px;background:#f4f7fb;color:#4f657e;font-size:11px;line-height:1.5;font-weight:600;white-space:normal;overflow-wrap:anywhere}.aw-chip[data-tone=blue],.aw-chip[data-tone=planned]{background:#edf5ff;border-color:#cfdef4;color:#2864a8}.aw-chip[data-tone=green],.aw-chip[data-tone=completed]{background:#edf9f2;border-color:#c8e7d4;color:#286a46}.aw-chip[data-tone=cyan],.aw-chip[data-tone=running]{background:#eaf8fa;border-color:#bee3e8;color:#176876}.aw-chip[data-tone=orange],.aw-chip[data-tone=warning],.aw-chip[data-tone=follow_up]{background:#fff7e8;border-color:#f0ddba;color:#8d5e12}.aw-chip[data-tone=red],.aw-chip[data-tone=cancelled],.aw-chip[data-tone=no_show]{background:#fff0f1;border-color:#efced1;color:#a34048}.aw-empty{display:grid;justify-items:center;gap:10px;padding:45px 24px;text-align:center;border:1px dashed #cbdcec;border-radius:20px;background:linear-gradient(130deg,#fff,#f7fbff);min-width:0}.aw-empty h2,.aw-empty h3{font-size:18px;color:#294763;margin:0}.aw-empty p{font-size:13px;color:#60758c;line-height:1.7;margin:0;max-width:540px}.aw-empty-icon{display:grid;place-items:center;width:54px;height:54px;background:#eaf3ff;border-radius:17px;color:#377bbf;margin-bottom:3px}.aw-skeleton{height:180px;background:linear-gradient(100deg,#edf3f9 25%,#f9fbfe 48%,#edf3f9 72%);background-size:230% 100%;border-radius:18px;animation:aw-shimmer 1.8s ease-in-out infinite}.aw-spin{animation:aw-spin 1s linear infinite}.aw-muted{color:#62758d}.aw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.aw-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@keyframes aw-shimmer{to{background-position:-230% 0}}@keyframes aw-spin{to{transform:rotate(360deg)}}@container(max-width:900px){.aw-hero{padding:25px;gap:18px}.aw-hero h1{font-size:27px}.aw-hero-side{max-width:300px}}@container(max-width:650px){.aw-workspace{padding:3px 0 20px}.aw-hero{grid-template-columns:1fr;padding:21px;border-radius:20px;margin-bottom:18px;gap:17px}.aw-hero h1{font-size:25px}.aw-hero-side{max-width:none;justify-items:start}.aw-hero-side .aw-actions{width:100%}.aw-hero-side .aw-button{flex:1}.aw-panel{padding:17px;border-radius:16px}.aw-grid{grid-template-columns:1fr}.aw-content{gap:16px}}@media(prefers-reduced-motion:reduce){.aw-workspace *,.aw-workspace *:before,.aw-workspace *:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.aw-button:hover:not(:disabled){transform:none}}
`.replace(/font-size:(\d+(?:\.\d+)?)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
export function AssignmentsWorkspaceStyles() { return null; }
export function AssignmentWorkspaceIcon({ name, size = 20 }: {
    name: string;
    size?: number;
}) {
    const paths: Record<string, string> = {
        calendar: 'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 2v6M17 2v6M3 10h18M7 14h3M14 14h3M7 17h3',
        clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l4 2',
        check: 'm5 12 4 4L19 6',
        clipboard: 'M8 4H5v17h14V4h-3M8 2h8v5H8zM8 12h8M8 16h5',
        search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6',
        plus: 'M12 4v16M4 12h16',
        refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6',
        arrow: 'M4 12h16m-6-6 6 6-6 6',
        back: 'M20 12H4m6-6-6 6 6 6',
        close: 'm6 6 12 12M6 18 18 6',
        filter: 'M4 5h16M7 12h10M10 19h4',
        person: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21v-2a8 8 0 0 1 16 0v2',
        location: 'M12 22s8-8 8-13a8 8 0 0 0-16 0c0 5 8 13 8 13Zm0-16a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
        edit: 'm15 4 5 5M5 19l4-1L21 6a2.8 2.8 0 0 0-4-4L5 14zM3 22h18',
        grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
        list: 'M3 5h2m3 0h13M3 12h2m3 0h13M3 19h2m3 0h13',
        trash: 'M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
        alert: 'M12 3 2 21h20L12 3Zm0 6v5m0 3v1',
        play: 'm8 4 12 8-12 8z',
    };
    return <NativeWorkspaceStyleScope css={[assignmentsWorkspaceCss]}>{<WebActionIcon size={size}><NativeSvgPath d={paths[name] ?? paths.calendar}/></WebActionIcon>}</NativeWorkspaceStyleScope>;
}
export function AssignmentsWorkspaceShell({ title, description, eyebrow = 'ASSIST · EINSÄTZE', actions, onBack, children }: {
    title: string;
    description?: string;
    eyebrow?: string;
    actions?: ReactNode;
    onBack?: () => void;
    children: ReactNode;
}) {
    return <NativeWorkspaceStyleScope css={[...__nativeWorkspaceStyleSheets["AssignmentsWorkspaceStyles"], assignmentsWorkspaceCss]}>{<ScreenShell title={title} showBack={false} contentOwnsHeader>
    <NativeDiv className="aw-workspace" data-cs-assignments-surface="light">
      <AssignmentsWorkspaceStyles />
      {onBack ? <NativeButton type="button" className="aw-back" onClick={onBack}><AssignmentWorkspaceIcon name="back" size={16}/>Zurück</NativeButton> : null}
      <NativeHeader className="aw-hero"><NativeDiv className="aw-hero-copy"><NativeDiv className="aw-eyebrow">{eyebrow}</NativeDiv><NativeH1>{title}</NativeH1>{description ? <NativeP>{description}</NativeP> : null}</NativeDiv>{actions ? <NativeDiv className="aw-hero-side"><NativeDiv className="aw-actions">{actions}</NativeDiv></NativeDiv> : null}</NativeHeader>
      <NativeDiv className="aw-content">{children}</NativeDiv>
    </NativeDiv>
  </ScreenShell>}</NativeWorkspaceStyleScope>;
}

export const __nativeWorkspaceStyleSheets = { "AssignmentsWorkspaceStyles": [assignmentsWorkspaceCss] };
