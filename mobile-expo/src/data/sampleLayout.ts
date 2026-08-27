import type { PlacedAsset } from '../types';

// The road pieces are positioned so their semantic endpoints meet. The terrain
// renderer joins them into one road graph; it does not draw the road PNGs.
const SAMPLE_ROWS: ReadonlyArray<readonly [string, number, number, boolean, number]> = [
  ['road_cross', 400, 200, false, 10],
  ['road_straight_a', 258, 260, false, 11],
  ['road_straight_a', 542, 146, false, 12],
  ['road_straight_b', 258, 143, false, 13],
  ['road_straight_b', 542, 259, false, 14],
  ['rail_straight', 260, 430, false, 15],
  ['rail_straight', 402, 369, false, 16],
  ['rail_crossing', 544, 305, false, 17],
  ['park_fountain', 405, 36, false, 30],
  ['playground', 658, 392, false, 31],
  ['forest_pine', 40, 362, false, 32],
  ['forest_broadleaf', 760, 54, false, 33],
  ['house_red', 90, 216, false, 50],
  ['house_blue', 214, 346, false, 51],
  ['hospital', 690, 150, false, 52],
  ['fire_station', 752, 326, false, 53],
  ['shop_green', 710, 248, false, 54],
];

function stampRows(
  prefix: string,
  rows: ReadonlyArray<readonly [string, number, number, boolean, number]>,
): PlacedAsset[] {
  const stamp = Date.now().toString(36);
  return rows.map(([assetId, x, y, flipped, z], index) => ({
    id: `${prefix}-${stamp}-${index}`,
    assetId,
    x,
    y,
    flipped,
    z,
  }));
}

export function createStarterLayout(): PlacedAsset[] {
  return stampRows('starter', [['park_fountain', 400, 208, false, 10]]);
}

export function createSampleLayout(): PlacedAsset[] {
  return stampRows('sample', SAMPLE_ROWS);
}
