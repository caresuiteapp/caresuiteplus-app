// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { HEALTHOS_PAGE_CONTRACT_CSS as fallback } from '@/design/web/healthOSPageContractCss';
import { HEALTHOS_PAGE_CONTRACT_CSS as web } from '@/design/web/healthOSPageContractCss.web';

afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; document.documentElement.removeAttribute('data-cs-portal-premium'); });
describe.each([['web bundle', web], ['fallback', fallback]])('portal CSS cascade: %s', (_name, css) => {
  it.each(['employee', 'client'])('keeps %s text and form fields readable over the actual page surface', kind => {
    document.documentElement.setAttribute('data-cs-portal-premium', kind);
    const style = document.createElement('style'); style.textContent = css; document.head.append(style);
    document.body.innerHTML = '<div data-cs-healthos-page="surface" style="background:transparent"><p style="color:#123251">Offene Einsätze</p><input value="Kommentar"></div>';
    const surface = getComputedStyle(document.querySelector('div')!);
    expect(surface.backgroundColor).toBe('#F7FBFF');
    expect(surface.backgroundImage).not.toContain('gradient');
    expect(surface.boxShadow).toBe('none');
    expect(getComputedStyle(document.querySelector('input')!).color).toBe('#061B35');
  });
});
