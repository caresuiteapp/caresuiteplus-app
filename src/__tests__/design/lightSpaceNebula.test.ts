import { describe, expect, it } from 'vitest';
import {
  lightSpaceNebulaFx,
  lightSpaceNebulaStarField,
} from '@/design/tokens/lightSpaceNebula';

describe('lightSpaceNebula tokens', () => {
  it('definiert helle Basis- und Akzentfarben', () => {
    expect(lightSpaceNebulaFx.base[0]).toBe('#F7FAFF');
    expect(lightSpaceNebulaFx.orbs.length).toBeGreaterThanOrEqual(4);
  });

  it('platziert Nebula-Orbs bevorzugt an Rändern', () => {
    for (const orb of lightSpaceNebulaFx.orbs) {
      const edge =
        (orb.top?.includes('-') ?? false) ||
        (orb.left?.includes('-') ?? false) ||
        (orb.right?.includes('-') ?? false) ||
        (orb.bottom?.includes('-') ?? false);
      expect(edge).toBe(true);
    }
  });

  it('nutzt dezente Stern-Dichte', () => {
    expect(lightSpaceNebulaStarField.length).toBeGreaterThanOrEqual(40);
    expect(lightSpaceNebulaStarField.length).toBeLessThanOrEqual(64);
  });
});
