// Generated native presentation from src/components/wfm/WfmSecondaryWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSection,NativeStyle,NativeHeader,NativeDiv,NativeH2,NativeP,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, type ReactNode } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from "@/hooks/useNativePreventRemove.native";
export function useWfmUnsavedChanges(dirty: boolean, busy: boolean) {
    const window = useNativeWorkflowWindow();
    const navigation = useNavigation();
    usePreventRemove(dirty || busy, async ({ data }) => {
        if (!busy && (!dirty || await confirmNativeWorkspaceAction('Ungespeicherte Änderungen verwerfen?')))
            navigation.dispatch(data.action);
    });
    useEffect(() => {
        if (!dirty && !busy)
            return;
        const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', leave);
        return () => window.removeEventListener('beforeunload', leave);
    }, [dirty, busy]);
}
/** Compact web content; the Office shell owns vertical scrolling. */
export function WfmSecondaryWorkspace({ title, description, actions, children }: {
    title: string;
    description: string;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return <NativeWorkspaceStyleScope css={[`
      .wts-workspace{color:#152b46;min-width:0;padding:0;font-size:calc(14px * var(--app-font-scale,1));line-height:1.5;container-type:inline-size}
      .wts-workspace *{box-sizing:border-box}.wts-workspace h2,.wts-workspace h3,.wts-workspace p{margin:0}.wts-workspace h2{font-size:1.45em}.wts-workspace h3{font-size:1.08em}.wts-workspace p,.wts-muted{color:#52657c}
      .wts-heading,.wts-row-head{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center}.wts-heading{margin-bottom:18px}.wts-heading p{margin-top:3px}
      .wts-panel{background:#fff;border:1px solid #d7e2ef;border-radius:14px;padding:16px;margin:0 0 14px;min-width:0;box-shadow:0 2px 8px #15385b05}.wts-panel>h3{margin-bottom:12px}
      .wts-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:12px}.wts-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
      .wts-field{display:flex;flex-direction:column;gap:5px;min-width:0;font-weight:600}.wts-field input,.wts-field select,.wts-field textarea{width:100%;min-width:0;border:1px solid #aebfd3;border-radius:8px;background:#fff;color:#152b46;padding:9px 11px;font:inherit;font-weight:400}.wts-field textarea{min-height:80px;resize:vertical}
      .wts-actions,.wts-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.wts-actions{margin-top:12px}.wts-filters{margin-bottom:14px}.wts-filters .wts-field{flex:1;max-width:300px}
      .wts-workspace button{border:1px solid #aec2da;border-radius:8px;background:#fff;color:#165aab;padding:8px 12px;font:inherit;font-weight:600;cursor:pointer;transition:background .16s ease,box-shadow .16s ease}.wts-workspace button:hover:not(:disabled){background:#edf5ff;box-shadow:0 2px 5px #1767c91a}.wts-workspace button.wts-primary{background:#1767c9;color:#fff;border-color:#1767c9}.wts-workspace button.wts-primary:hover:not(:disabled){background:#1257aa}.wts-workspace button:disabled{opacity:.55;cursor:not-allowed}.wts-workspace :focus-visible{outline:3px solid #76b5ff;outline-offset:2px}
      .wts-row{padding:12px 0;border-bottom:1px solid #e3ebf4;overflow-wrap:anywhere}.wts-row:last-child{border-bottom:0}.wts-row[data-selected=true]{background:#edf5ff;border-radius:8px;padding:12px}.wts-row p{margin-top:4px}.wts-badge{font-size:.85em;font-weight:700;display:inline-block;padding:3px 9px;border-radius:20px;background:#e8f1ff;color:#165aab}.wts-badge[data-tone=good]{background:#e3f5eb;color:#16633f}.wts-badge[data-tone=muted]{background:#eef1f5;color:#52657c}.wts-badge[data-tone=warning]{background:#fff0ce;color:#805000}
      .wts-notice{padding:11px 13px;border:1px solid #c9d9ec;border-radius:9px;background:#eff6ff;margin:0 0 12px;color:#244e7d;overflow-wrap:anywhere}.wts-notice[data-tone=error]{border-color:#edb9b4;background:#fff2f0;color:#a32b22}.wts-notice[data-tone=success]{border-color:#aadbc3;background:#edfaf3;color:#16633f}.wts-notice button{margin-left:8px}.wts-check{display:flex;align-items:flex-start;gap:8px;font-weight:500}.wts-check input{margin-top:5px;accent-color:#1767c9}.wts-choice-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:8px;max-height:230px;overflow:auto;padding:8px;border:1px solid #d7e2ef;border-radius:8px}.wts-stack{display:grid;gap:12px}.wts-empty{padding:20px 4px;color:#52657c}.wts-code{font-size:1.4em;font-weight:700;letter-spacing:.15em}.wts-workspace details>summary{cursor:pointer;font-weight:600;color:#165aab}.wts-workspace details[open]>summary{margin-bottom:12px}
      @container(max-width:700px){.wts-split{grid-template-columns:1fr}.wts-heading{align-items:flex-start}}
      @media(prefers-reduced-motion:reduce){.wts-workspace button{transition:none}}
    `,
        `
      .wts-workspace{color:#152b46;min-width:0;padding:0;font-size:calc(14px * var(--app-font-scale,1));line-height:1.5;container-type:inline-size}
      .wts-workspace *{box-sizing:border-box}.wts-workspace h2,.wts-workspace h3,.wts-workspace p{margin:0}.wts-workspace h2{font-size:1.45em}.wts-workspace h3{font-size:1.08em}.wts-workspace p,.wts-muted{color:#52657c}
      .wts-heading,.wts-row-head{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center}.wts-heading{margin-bottom:18px}.wts-heading p{margin-top:3px}
      .wts-panel{background:#fff;border:1px solid #d7e2ef;border-radius:14px;padding:16px;margin:0 0 14px;min-width:0;box-shadow:0 2px 8px #15385b05}.wts-panel>h3{margin-bottom:12px}
      .wts-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:12px}.wts-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
      .wts-field{display:flex;flex-direction:column;gap:5px;min-width:0;font-weight:600}.wts-field input,.wts-field select,.wts-field textarea{width:100%;min-width:0;border:1px solid #aebfd3;border-radius:8px;background:#fff;color:#152b46;padding:9px 11px;font:inherit;font-weight:400}.wts-field textarea{min-height:80px;resize:vertical}
      .wts-actions,.wts-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.wts-actions{margin-top:12px}.wts-filters{margin-bottom:14px}.wts-filters .wts-field{flex:1;max-width:300px}
      .wts-workspace button{border:1px solid #aec2da;border-radius:8px;background:#fff;color:#165aab;padding:8px 12px;font:inherit;font-weight:600;cursor:pointer;transition:background .16s ease,box-shadow .16s ease}.wts-workspace button:hover:not(:disabled){background:#edf5ff;box-shadow:0 2px 5px #1767c91a}.wts-workspace button.wts-primary{background:#1767c9;color:#fff;border-color:#1767c9}.wts-workspace button.wts-primary:hover:not(:disabled){background:#1257aa}.wts-workspace button:disabled{opacity:.55;cursor:not-allowed}.wts-workspace :focus-visible{outline:3px solid #76b5ff;outline-offset:2px}
      .wts-row{padding:12px 0;border-bottom:1px solid #e3ebf4;overflow-wrap:anywhere}.wts-row:last-child{border-bottom:0}.wts-row[data-selected=true]{background:#edf5ff;border-radius:8px;padding:12px}.wts-row p{margin-top:4px}.wts-badge{font-size:.85em;font-weight:700;display:inline-block;padding:3px 9px;border-radius:20px;background:#e8f1ff;color:#165aab}.wts-badge[data-tone=good]{background:#e3f5eb;color:#16633f}.wts-badge[data-tone=muted]{background:#eef1f5;color:#52657c}.wts-badge[data-tone=warning]{background:#fff0ce;color:#805000}
      .wts-notice{padding:11px 13px;border:1px solid #c9d9ec;border-radius:9px;background:#eff6ff;margin:0 0 12px;color:#244e7d;overflow-wrap:anywhere}.wts-notice[data-tone=error]{border-color:#edb9b4;background:#fff2f0;color:#a32b22}.wts-notice[data-tone=success]{border-color:#aadbc3;background:#edfaf3;color:#16633f}.wts-notice button{margin-left:8px}.wts-check{display:flex;align-items:flex-start;gap:8px;font-weight:500}.wts-check input{margin-top:5px;accent-color:#1767c9}.wts-choice-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:8px;max-height:230px;overflow:auto;padding:8px;border:1px solid #d7e2ef;border-radius:8px}.wts-stack{display:grid;gap:12px}.wts-empty{padding:20px 4px;color:#52657c}.wts-code{font-size:1.4em;font-weight:700;letter-spacing:.15em}.wts-workspace details>summary{cursor:pointer;font-weight:600;color:#165aab}.wts-workspace details[open]>summary{margin-bottom:12px}
      @container(max-width:700px){.wts-split{grid-template-columns:1fr}.wts-heading{align-items:flex-start}}
      @media(prefers-reduced-motion:reduce){.wts-workspace button{transition:none}}
    `]}>{<NativeSection className="wts-workspace" aria-label={title}>
    <NativeStyle>{`
      .wts-workspace{color:#152b46;min-width:0;padding:0;font-size:calc(14px * var(--app-font-scale,1));line-height:1.5;container-type:inline-size}
      .wts-workspace *{box-sizing:border-box}.wts-workspace h2,.wts-workspace h3,.wts-workspace p{margin:0}.wts-workspace h2{font-size:1.45em}.wts-workspace h3{font-size:1.08em}.wts-workspace p,.wts-muted{color:#52657c}
      .wts-heading,.wts-row-head{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center}.wts-heading{margin-bottom:18px}.wts-heading p{margin-top:3px}
      .wts-panel{background:#fff;border:1px solid #d7e2ef;border-radius:14px;padding:16px;margin:0 0 14px;min-width:0;box-shadow:0 2px 8px #15385b05}.wts-panel>h3{margin-bottom:12px}
      .wts-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:12px}.wts-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
      .wts-field{display:flex;flex-direction:column;gap:5px;min-width:0;font-weight:600}.wts-field input,.wts-field select,.wts-field textarea{width:100%;min-width:0;border:1px solid #aebfd3;border-radius:8px;background:#fff;color:#152b46;padding:9px 11px;font:inherit;font-weight:400}.wts-field textarea{min-height:80px;resize:vertical}
      .wts-actions,.wts-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.wts-actions{margin-top:12px}.wts-filters{margin-bottom:14px}.wts-filters .wts-field{flex:1;max-width:300px}
      .wts-workspace button{border:1px solid #aec2da;border-radius:8px;background:#fff;color:#165aab;padding:8px 12px;font:inherit;font-weight:600;cursor:pointer;transition:background .16s ease,box-shadow .16s ease}.wts-workspace button:hover:not(:disabled){background:#edf5ff;box-shadow:0 2px 5px #1767c91a}.wts-workspace button.wts-primary{background:#1767c9;color:#fff;border-color:#1767c9}.wts-workspace button.wts-primary:hover:not(:disabled){background:#1257aa}.wts-workspace button:disabled{opacity:.55;cursor:not-allowed}.wts-workspace :focus-visible{outline:3px solid #76b5ff;outline-offset:2px}
      .wts-row{padding:12px 0;border-bottom:1px solid #e3ebf4;overflow-wrap:anywhere}.wts-row:last-child{border-bottom:0}.wts-row[data-selected=true]{background:#edf5ff;border-radius:8px;padding:12px}.wts-row p{margin-top:4px}.wts-badge{font-size:.85em;font-weight:700;display:inline-block;padding:3px 9px;border-radius:20px;background:#e8f1ff;color:#165aab}.wts-badge[data-tone=good]{background:#e3f5eb;color:#16633f}.wts-badge[data-tone=muted]{background:#eef1f5;color:#52657c}.wts-badge[data-tone=warning]{background:#fff0ce;color:#805000}
      .wts-notice{padding:11px 13px;border:1px solid #c9d9ec;border-radius:9px;background:#eff6ff;margin:0 0 12px;color:#244e7d;overflow-wrap:anywhere}.wts-notice[data-tone=error]{border-color:#edb9b4;background:#fff2f0;color:#a32b22}.wts-notice[data-tone=success]{border-color:#aadbc3;background:#edfaf3;color:#16633f}.wts-notice button{margin-left:8px}.wts-check{display:flex;align-items:flex-start;gap:8px;font-weight:500}.wts-check input{margin-top:5px;accent-color:#1767c9}.wts-choice-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:8px;max-height:230px;overflow:auto;padding:8px;border:1px solid #d7e2ef;border-radius:8px}.wts-stack{display:grid;gap:12px}.wts-empty{padding:20px 4px;color:#52657c}.wts-code{font-size:1.4em;font-weight:700;letter-spacing:.15em}.wts-workspace details>summary{cursor:pointer;font-weight:600;color:#165aab}.wts-workspace details[open]>summary{margin-bottom:12px}
      @container(max-width:700px){.wts-split{grid-template-columns:1fr}.wts-heading{align-items:flex-start}}
      @media(prefers-reduced-motion:reduce){.wts-workspace button{transition:none}}
    `}</NativeStyle>
    <NativeHeader className="wts-heading"><NativeDiv><NativeH2>{title}</NativeH2><NativeP>{description}</NativeP></NativeDiv>{actions}</NativeHeader>{children}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
export function WfmWebNotice({ children, tone = 'info' }: {
    children: ReactNode;
    tone?: 'info' | 'error' | 'success';
}) {
    return <NativeWorkspaceStyleScope css={[`
      .wts-workspace{color:#152b46;min-width:0;padding:0;font-size:calc(14px * var(--app-font-scale,1));line-height:1.5;container-type:inline-size}
      .wts-workspace *{box-sizing:border-box}.wts-workspace h2,.wts-workspace h3,.wts-workspace p{margin:0}.wts-workspace h2{font-size:1.45em}.wts-workspace h3{font-size:1.08em}.wts-workspace p,.wts-muted{color:#52657c}
      .wts-heading,.wts-row-head{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center}.wts-heading{margin-bottom:18px}.wts-heading p{margin-top:3px}
      .wts-panel{background:#fff;border:1px solid #d7e2ef;border-radius:14px;padding:16px;margin:0 0 14px;min-width:0;box-shadow:0 2px 8px #15385b05}.wts-panel>h3{margin-bottom:12px}
      .wts-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:12px}.wts-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
      .wts-field{display:flex;flex-direction:column;gap:5px;min-width:0;font-weight:600}.wts-field input,.wts-field select,.wts-field textarea{width:100%;min-width:0;border:1px solid #aebfd3;border-radius:8px;background:#fff;color:#152b46;padding:9px 11px;font:inherit;font-weight:400}.wts-field textarea{min-height:80px;resize:vertical}
      .wts-actions,.wts-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.wts-actions{margin-top:12px}.wts-filters{margin-bottom:14px}.wts-filters .wts-field{flex:1;max-width:300px}
      .wts-workspace button{border:1px solid #aec2da;border-radius:8px;background:#fff;color:#165aab;padding:8px 12px;font:inherit;font-weight:600;cursor:pointer;transition:background .16s ease,box-shadow .16s ease}.wts-workspace button:hover:not(:disabled){background:#edf5ff;box-shadow:0 2px 5px #1767c91a}.wts-workspace button.wts-primary{background:#1767c9;color:#fff;border-color:#1767c9}.wts-workspace button.wts-primary:hover:not(:disabled){background:#1257aa}.wts-workspace button:disabled{opacity:.55;cursor:not-allowed}.wts-workspace :focus-visible{outline:3px solid #76b5ff;outline-offset:2px}
      .wts-row{padding:12px 0;border-bottom:1px solid #e3ebf4;overflow-wrap:anywhere}.wts-row:last-child{border-bottom:0}.wts-row[data-selected=true]{background:#edf5ff;border-radius:8px;padding:12px}.wts-row p{margin-top:4px}.wts-badge{font-size:.85em;font-weight:700;display:inline-block;padding:3px 9px;border-radius:20px;background:#e8f1ff;color:#165aab}.wts-badge[data-tone=good]{background:#e3f5eb;color:#16633f}.wts-badge[data-tone=muted]{background:#eef1f5;color:#52657c}.wts-badge[data-tone=warning]{background:#fff0ce;color:#805000}
      .wts-notice{padding:11px 13px;border:1px solid #c9d9ec;border-radius:9px;background:#eff6ff;margin:0 0 12px;color:#244e7d;overflow-wrap:anywhere}.wts-notice[data-tone=error]{border-color:#edb9b4;background:#fff2f0;color:#a32b22}.wts-notice[data-tone=success]{border-color:#aadbc3;background:#edfaf3;color:#16633f}.wts-notice button{margin-left:8px}.wts-check{display:flex;align-items:flex-start;gap:8px;font-weight:500}.wts-check input{margin-top:5px;accent-color:#1767c9}.wts-choice-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:8px;max-height:230px;overflow:auto;padding:8px;border:1px solid #d7e2ef;border-radius:8px}.wts-stack{display:grid;gap:12px}.wts-empty{padding:20px 4px;color:#52657c}.wts-code{font-size:1.4em;font-weight:700;letter-spacing:.15em}.wts-workspace details>summary{cursor:pointer;font-weight:600;color:#165aab}.wts-workspace details[open]>summary{margin-bottom:12px}
      @container(max-width:700px){.wts-split{grid-template-columns:1fr}.wts-heading{align-items:flex-start}}
      @media(prefers-reduced-motion:reduce){.wts-workspace button{transition:none}}
    `]}>{<NativeDiv className="wts-notice" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>{children}</NativeDiv>}</NativeWorkspaceStyleScope>;
}
