export type DomainA11yMeta = {
  wpNumber: number;
  screenLabel: string;
  headingRole: 'header';
  minTouchSize: number;
  reduceMotionHint: string;
};

export function createDomainA11yMeta(
  wpNumber: number,
  screenLabel: string,
): DomainA11yMeta {
  return {
    wpNumber,
    screenLabel,
    headingRole: 'header',
    minTouchSize: 44,
    reduceMotionHint: 'Animationen werden bei „Bewegung reduzieren“ vereinfacht.',
  };
}
