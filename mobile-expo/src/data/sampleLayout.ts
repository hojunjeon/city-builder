import type { PlacedAsset } from '../types';

const SAMPLE_ROWS: ReadonlyArray<readonly [string, number, number, boolean, number]> = [
  ['road_curve_a', 64, 64, false, 1],
  ['road_straight_a', 224, 78, false, 2],
  ['road_cross', 382, 76, false, 3],
  ['road_straight_b', 542, 78, false, 4],
  ['road_curve_b', 704, 64, false, 5],
  ['rail_straight', 318, 300, false, 6],
  ['rail_crossing', 472, 292, false, 7],
  ['park_fountain', 174, 248, false, 10],
  ['playground', 626, 252, false, 11],
  ['forest_pine', 44, 356, false, 12],
  ['forest_broadleaf', 564, 382, false, 13],
  ['house_red', 88, 144, false, 20],
  ['house_blue', 236, 360, false, 21],
  ['hospital', 362, 162, false, 22],
  ['fire_station', 520, 126, false, 23],
  ['office', 690, 132, false, 24],
  ['shop_green', 744, 356, true, 25],
];

export function createSampleLayout(): PlacedAsset[] {
  const stamp = Date.now().toString(36);
  return SAMPLE_ROWS.map(([assetId, x, y, flipped, z], index) => ({
    id: `sample-${stamp}-${index}`,
    assetId,
    x,
    y,
    flipped,
    z,
  }));
}
