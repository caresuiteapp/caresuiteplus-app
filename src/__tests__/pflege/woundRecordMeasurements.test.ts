import { describe, expect, it } from 'vitest';
import { woundPlanimetry, type PhotoPoint } from '@/lib/pflege/woundPlanimetry';
import { ageAt, scorePressureRisk, woundBmi } from '@/lib/pflege/woundRecordDomain';

const rectangle = (left: number, top: number, right: number, bottom: number): PhotoPoint[] => [
  { x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom },
];

describe('clinical wound calculations', () => {
  it('computes area and perpendicular width using the photo dimensions and the entered scale', () => {
    const outline = rectangle(.1, .1, .5, .5);
    const uncalibrated = woundPlanimetry.dimensions({ width: 900, height: 500, outline });
    expect(uncalibrated?.centimetres).toBeNull();
    const calibrated = woundPlanimetry.dimensions({ width: 900, height: 500, outline,
      scale: { from: { x: .1, y: .8 }, to: { x: .2, y: .8 }, millimetres: 10 } });
    expect(calibrated?.centimetres?.areaCm2).toBeCloseTo(360 * 200 / 90 ** 2);
    expect(calibrated?.centimetres?.lengthCm).toBeCloseTo(Math.hypot(360, 200) / 90);
    expect(calibrated?.centimetres?.widthCm).toBeCloseTo(2 * 360 * 200 / Math.hypot(360, 200) / 90);
    expect(woundPlanimetry.usableContour([outline[0], outline[2], outline[1], outline[3]])).toBe(false);
  });

  it('clips both tissue modes to the wound and replaces rather than double-counting overlaps', () => {
    const width = 10, height = 10, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) data[(y * width + x) * 4] = x >= 5 ? 75 : 150;
    }
    const result = woundPlanimetry.segment(rectangle(.2, .2, .8, .8), [
      { tissue: 'necrosis', shape: rectangle(0, 0, .7, .6) },
      { tissue: 'granulation', sample: [75, 0, 0], tolerance: 0 },
    ], { width, height, data });
    expect(result?.shares).toEqual({ necrosis: 33.33, granulation: 50, fibrin: 0, epithelium: 0, unassigned: 16.67 });
    expect(Array.from(result!.mask).filter(n => n !== 0)).toHaveLength(36);
  });

  it('validates complete Norton and Braden scores and determines age by the local day', () => {
    expect(scorePressureRisk('norton', [1,2,3,4,4])).toBe(14);
    expect(scorePressureRisk('braden', [4,4,4,4,4,3])).toBe(23);
    expect(scorePressureRisk('braden', [4,4,4,4,4,4])).toBeNull();
    expect(scorePressureRisk('norton', Array(5))).toBeNull();
    expect(ageAt('2008-11-15', '2026-11-14T23:30:00Z')).toBe(18);
    expect(woundBmi(180, 75)).toBe(23.1);
  });
});
