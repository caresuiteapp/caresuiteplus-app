import { WebActionIcon } from '@/components/icons/WebActionIcon.web';
import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { usePermissions } from '@/hooks/usePermissions';
import { documentsWorkspaceCss } from './documentsWorkspaceCss.web';

export type DocumentsWorkspaceSection = 'catalog' | 'library' | 'signatures' | 'settings';

const NAVIGATION: { id: DocumentsWorkspaceSection; label: string; route: string; icon: string }[] = [
  { id: 'catalog', label: 'Vorlagenkatalog', route: '/business/office/document-catalog', icon: 'catalog' },
  { id: 'library', label: 'Dokumentenablage', route: '/business/office/documents', icon: 'folder' },
  { id: 'signatures', label: 'Unterschriften', route: '/business/office/documents/signatures', icon: 'signature' },
];

export function DocumentWorkspaceIcon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    document: 'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6',
    catalog: 'M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3zM12 6v15M6 8h3M6 12h3M15 8h3M15 12h3',
    folder: 'M3 5h7l2 3h9v12H3zM3 10h18',
    signature: 'm15 4 5 5M5 19l4-1L21 6a2.8 2.8 0 0 0-4-4L5 14zM3 22h18',
    settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M9 15v6',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6',
    upload: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
    download: 'M12 3v13m-5-5 5 5 5-5M4 15v6h16v-6',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6',
    close: 'm6 6 12 12M6 18 18 6',
    check: 'm5 12 4 4L19 6',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l4 2',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    plus: 'M12 4v16M4 12h16',
  };
  return <WebActionIcon size={size}><path d={paths[name] ?? paths.document} /></WebActionIcon>;
}

export function DocumentsWorkspaceShell({ active, title, description, eyebrow = 'OFFICE · DOKUMENTE', actions, stats, back, beforeNavigate, children }: {
  active: DocumentsWorkspaceSection;
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  stats?: ReactNode;
  back?: { label: string; onClick: () => void };
  beforeNavigate?: () => boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const { can } = usePermissions();
  const showSettings = can('settings.templates.view') || can('office.catalogs.view');
  return <ScreenShell title={title} showBack={false} contentOwnsHeader>
    <div className="dw-workspace" data-cs-documents-surface="light">
      <style>{documentsWorkspaceCss}</style>
      <nav className="dw-navigation" aria-label="Dokumentenbereiche">
        {NAVIGATION.map(item => <button key={item.id} type="button" aria-current={active === item.id ? 'page' : undefined} onClick={() => { if (active !== item.id && beforeNavigate?.() !== false) router.push(item.route as never); }}><DocumentWorkspaceIcon name={item.icon} size={20} />{item.label}</button>)}
        {showSettings ? <button type="button" className="dw-settings-link" aria-current={active === 'settings' ? 'page' : undefined} onClick={() => { if (active !== 'settings' && beforeNavigate?.() !== false) router.push('/business/templates/documents-hub' as never); }}><DocumentWorkspaceIcon name="settings" size={20} />Vorlageneinstellungen</button> : null}
      </nav>
      {back ? <button type="button" className="dw-back" onClick={() => { if (beforeNavigate?.() !== false) back.onClick(); }}><span aria-hidden="true">←</span>{back.label}</button> : null}
      <header className="dw-hero">
        <div className="dw-hero-copy"><div className="dw-eyebrow">{eyebrow}</div><h1>{title}</h1>{description ? <p>{description}</p> : null}{actions ? <div className="dw-hero-actions">{actions}</div> : null}</div>
        {stats ? <div className="dw-hero-stats">{stats}</div> : <div className="dw-hero-art" aria-hidden="true"><div className="dw-paper"><DocumentWorkspaceIcon name={active === 'signatures' ? 'signature' : 'document'} size={32} /><span /><span /></div></div>}
      </header>
      <div className="dw-content">{children}</div>
    </div>
  </ScreenShell>;
}
