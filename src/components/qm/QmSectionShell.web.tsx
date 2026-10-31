import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { qmWorkspaceCss } from './qmWorkspaceCss.web';

export function QmSectionShell({ title, subtitle, actions, children }: {
  title: string; subtitle: string; actions?: ReactNode; children: ReactNode;
}) {
  const router = useRouter();
  return <ScreenShell title={title} subtitle={subtitle} contentOwnsHeader showBack={false}>
    <style>{qmWorkspaceCss}</style>
    <div className="qm-workspace qm-section-workspace">
      <header className="qm-panel qm-section-heading">
        <div>
          <button type="button" className="qm-section-back" onClick={() => router.push('/business/office/qm' as never)}>← Qualitätsmanagement</button>
          <h1 className="qm-section-title">{title}</h1>
          <p className="qm-section-subtitle">{subtitle}</p>
        </div>
        {actions ? <div className="qm-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
    <style>{`
      .qm-section-workspace{display:grid;gap:20px;min-width:0}
      .qm-section-workspace .qm-section-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;padding:24px;background:linear-gradient(120deg,#fff,#f0f8ff)}
      .qm-section-workspace .qm-section-heading>div:first-child{min-width:0;flex:1 1 320px}
      .qm-section-workspace .qm-section-back{border:0;background:transparent;color:#075bbf;font:inherit;font-size:calc(13px * var(--app-font-scale,1));font-weight:700;padding:0 0 12px;cursor:pointer;text-align:left}
      .qm-section-workspace .qm-section-back:focus-visible{outline:3px solid #079ad5;outline-offset:4px;border-radius:4px}
      .qm-section-workspace .qm-section-title{margin:0;font-size:calc(clamp(23px,2.5cqi,32px) * var(--app-font-scale,1));line-height:1.2;overflow-wrap:anywhere;color:var(--qm-ink,#122b49)}
      .qm-section-workspace .qm-section-subtitle{margin:9px 0 0;color:var(--qm-muted,#52677d);line-height:1.5;max-width:76ch}
      @container(max-width:640px){.qm-section-workspace .qm-section-heading{padding:18px;gap:16px}}
    `}</style>
  </ScreenShell>;
}
