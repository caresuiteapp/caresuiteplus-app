import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(file, 'utf8');

describe('systemweite Workflow-Rückmeldungen', () => {
  const provider = read('src/components/ui/GlobalWorkflowFeedback.tsx');
  const root = read('app/_layout.tsx');
  const states = read('src/components/ui/StateViews.tsx');
  const banners = read('src/components/ui/InfoBanner.tsx');
  const history = read('src/components/wfm/WfmOfficeTimeHistoryPanel.tsx');
  const detail = read('src/components/wfm/WfmOfficeTimeReviewDetailPanel.tsx');

  it('montiert genau eine globale Feedback-Ebene am App-Root', () => {
    expect(root).toContain('<GlobalWorkflowFeedbackProvider>');
    expect(root).toContain('</GlobalWorkflowFeedbackProvider>');
    expect(root).toMatch(
      /<GlobalWorkflowFeedbackProvider>[\s\S]*<ModalStackProvider>[\s\S]*<\/ModalStackProvider>[\s\S]*<\/GlobalWorkflowFeedbackProvider>/,
    );
    expect(provider).toContain('<WorkflowFeedbackOverlay');
    expect(provider).toContain('testID="global-workflow-feedback"');
  });

  it('unterstützt Erfolg, Fehler, Warnung, Information und blockierendes Laden', () => {
    expect(provider).toContain('showSuccess');
    expect(provider).toContain('showError');
    expect(provider).toContain('showWarning');
    expect(provider).toContain('showInfo');
    expect(provider).toContain('showLoading');
    expect(provider).toContain('loading: true');
    expect(provider).toContain('queueRef');
    expect(provider).toContain('queueRef.current.push(next)');
  });

  it('leitet die gemeinsamen Statuskomponenten standardmäßig ins Overlay', () => {
    expect(states).toContain("presentation = 'overlay'");
    expect(states).toContain('feedback.showLoading(message)');
    expect(states).toContain('feedback.showError(');
    expect(states).toContain('feedback.showSuccess(');
    expect(states.match(/if \(presentation === 'overlay'\) return null;/g)).toHaveLength(3);
  });

  it('zeigt transiente Erfolgs- und Fehlermeldungen aus InfoBanner als Popup', () => {
    expect(banners).toContain("presentation === 'auto'");
    expect(banners).toContain("variant === 'success'");
    expect(banners).toContain("variant === 'danger'");
    expect(banners).toContain("variant === 'error'");
    expect(banners).toContain('feedback.show({');
  });

  it('entfernt die Arbeitszeit-Rückmeldung aus dem Seiteninhalt', () => {
    expect(history).toContain("feedback.showLoading('Einsatz-Ist wird als Buchung übernommen…')");
    expect(history).toContain("feedback.showSuccess('Einsatz-Ist wurde als Buchung übernommen.'");
    expect(history).toContain('feedback.showError(');
    expect(history).not.toContain('setActionMessage');
    expect(detail).not.toContain('{actionMessage ? (');
  });
});
