import { describe, expect, it } from 'vitest';
import { llgsCanvasClouds, llgsStarField } from '@/design/tokens/lightLiquidGlassSpace';

describe('lightLiquidGlassSpace tokens', () => {
  it('definiert mindestens 4 Canvas-Nebula-Wolken', () => {
    expect(llgsCanvasClouds.length).toBeGreaterThanOrEqual(4);
    for (const cloud of llgsCanvasClouds) {
      expect(cloud.driftX).toBeGreaterThan(100);
      expect(cloud.speed).toBeGreaterThan(0);
    }
  });

  it('platziert Wolken an Rändern und dezent in der Mitte', () => {
    const edgeClouds = llgsCanvasClouds.filter(
      (c) => c.bx < 0.2 || c.bx > 0.8 || c.by < 0.2 || c.by > 0.8,
    );
    expect(edgeClouds.length).toBeGreaterThanOrEqual(4);
  });

  it('nutzt dezente Stern-Dichte', () => {
    expect(llgsStarField.length).toBeGreaterThanOrEqual(32);
  });
});
