import type { CityAsset, PlacedAsset } from '../types';

export type TerrainPoint = { x: number; y: number };
export type TerrainPolyline = {
  id: string;
  itemId: string;
  kind: 'road' | 'rail' | 'driveway' | 'footpath';
  points: TerrainPoint[];
  generated?: boolean;
};
export type TerrainRegion = {
  id: string;
  kind: 'lot' | 'park' | 'nature';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};
export type TerrainBulb = {
  id: string;
  itemId: string;
  x: number;
  y: number;
  radius: number;
};
export type TerrainGeometry = {
  roads: TerrainPolyline[];
  rails: TerrainPolyline[];
  driveways: TerrainPolyline[];
  lots: TerrainRegion[];
  parks: TerrainRegion[];
  nature: TerrainRegion[];
  bulbs: TerrainBulb[];
  stats: {
    autoConnections: number;
    driveways: number;
    terrainRegions: number;
  };
};

export const PROCEDURAL_ASSET_IDS = new Set([
  'road_straight_a',
  'road_straight_b',
  'road_curve_a',
  'road_curve_b',
  'road_cross',
  'road_dead_end',
  'rail_straight',
  'rail_crossing',
]);

const BUILDING_IDS = new Set([
  'house_red',
  'house_blue',
  'house_purple',
  'shop_yellow',
  'school',
  'church',
  'apartment',
  'hospital',
  'fire_station',
  'office',
  'shop_green',
]);

const BOARD_WIDTH = 960;
const BOARD_HEIGHT = 540;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(a: TerrainPoint, b: TerrainPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function sampleQuadratic(
  a: TerrainPoint,
  control: TerrainPoint,
  b: TerrainPoint,
  steps = 20,
): TerrainPoint[] {
  const result: TerrainPoint[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const u = 1 - t;
    result.push({
      x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
    });
  }
  return result;
}

function localPaths(assetId: string): {
  roads: TerrainPoint[][];
  rails: TerrainPoint[][];
  bulbs: Array<TerrainPoint & { radius: number }>;
} {
  const straightA = [
    { x: 0.04, y: 0.76 },
    { x: 0.96, y: 0.24 },
  ];
  const straightB = [
    { x: 0.04, y: 0.24 },
    { x: 0.96, y: 0.76 },
  ];
  switch (assetId) {
    case 'road_straight_a':
      return { roads: [straightA], rails: [], bulbs: [] };
    case 'road_straight_b':
      return { roads: [straightB], rails: [], bulbs: [] };
    case 'road_curve_a':
      return {
        roads: [
          sampleQuadratic(
            { x: 0.03, y: 0.7 },
            { x: 0.5, y: 0.12 },
            { x: 0.97, y: 0.7 },
            24,
          ),
        ],
        rails: [],
        bulbs: [],
      };
    case 'road_curve_b':
      return {
        roads: [
          sampleQuadratic(
            { x: 0.04, y: 0.76 },
            { x: 0.48, y: 0.78 },
            { x: 0.96, y: 0.25 },
            22,
          ),
        ],
        rails: [],
        bulbs: [],
      };
    case 'road_cross':
      return { roads: [straightA, straightB], rails: [], bulbs: [] };
    case 'road_dead_end':
      return {
        roads: [
          sampleQuadratic(
            { x: 0.04, y: 0.76 },
            { x: 0.36, y: 0.58 },
            { x: 0.62, y: 0.43 },
            14,
          ),
        ],
        rails: [],
        bulbs: [{ x: 0.68, y: 0.4, radius: 0.19 }],
      };
    case 'rail_straight':
      return { roads: [], rails: [straightA], bulbs: [] };
    case 'rail_crossing':
      return { roads: [straightB], rails: [straightA], bulbs: [] };
    default:
      return { roads: [], rails: [], bulbs: [] };
  }
}

function worldPoint(
  item: PlacedAsset,
  asset: CityAsset,
  point: TerrainPoint,
): TerrainPoint {
  const normalizedX = item.flipped ? 1 - point.x : point.x;
  return {
    x: item.x + normalizedX * asset.defaultWidth,
    y: item.y + point.y * asset.defaultHeight,
  };
}

function worldPolyline(
  item: PlacedAsset,
  asset: CityAsset,
  points: TerrainPoint[],
): TerrainPoint[] {
  const result = points.map((point) => worldPoint(item, asset, point));
  return item.flipped ? result.reverse() : result;
}

function networkPaths(item: PlacedAsset, asset: CityAsset): {
  roads: TerrainPolyline[];
  rails: TerrainPolyline[];
  bulbs: TerrainBulb[];
} {
  const local = localPaths(asset.id);
  return {
    roads: local.roads.map((points, index) => ({
      id: `${item.id}:road:${index}`,
      itemId: item.id,
      kind: 'road',
      points: worldPolyline(item, asset, points),
    })),
    rails: local.rails.map((points, index) => ({
      id: `${item.id}:rail:${index}`,
      itemId: item.id,
      kind: 'rail',
      points: worldPolyline(item, asset, points),
    })),
    bulbs: local.bulbs.map((bulb, index) => {
      const point = worldPoint(item, asset, bulb);
      return {
        id: `${item.id}:bulb:${index}`,
        itemId: item.id,
        x: point.x,
        y: point.y,
        radius: bulb.radius * Math.min(asset.defaultWidth, asset.defaultHeight),
      };
    }),
  };
}

function endpoints(paths: TerrainPolyline[]): Array<{
  id: string;
  path: TerrainPolyline;
  point: TerrainPoint;
}> {
  const result: Array<{ id: string; path: TerrainPolyline; point: TerrainPoint }> = [];
  paths.forEach((path) => {
    const first = path.points[0];
    const last = path.points[path.points.length - 1];
    if (!first || !last) return;
    result.push({ id: `${path.id}:0`, path, point: first });
    result.push({ id: `${path.id}:1`, path, point: last });
  });
  return result;
}

function nearestPointOnSegment(
  point: TerrainPoint,
  a: TerrainPoint,
  b: TerrainPoint,
): { point: TerrainPoint; distance: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lengthSquared = vx * vx + vy * vy;
  if (lengthSquared < 0.0001) return { point: a, distance: distance(point, a) };
  const t = clamp(
    ((point.x - a.x) * vx + (point.y - a.y) * vy) / lengthSquared,
    0,
    1,
  );
  const candidate = { x: a.x + vx * t, y: a.y + vy * t };
  return { point: candidate, distance: distance(point, candidate) };
}

function nearestPointOnPolyline(
  point: TerrainPoint,
  points: TerrainPoint[],
): { point: TerrainPoint; distance: number } | null {
  let best: { point: TerrainPoint; distance: number } | null = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    if (!a || !b) continue;
    const candidate = nearestPointOnSegment(point, a, b);
    if (!best || candidate.distance < best.distance) best = candidate;
  }
  return best;
}

function connectPaths(paths: TerrainPolyline[], maxDistance: number): TerrainPolyline[] {
  const ends = endpoints(paths);
  const pairs: Array<{
    a: (typeof ends)[number];
    b: (typeof ends)[number];
    gap: number;
  }> = [];

  // First connect compatible endpoints. This makes two nearby road or rail pieces
  // behave as one network instead of two independent pictures.
  for (let left = 0; left < ends.length; left += 1) {
    const a = ends[left];
    if (!a) continue;
    for (let right = left + 1; right < ends.length; right += 1) {
      const b = ends[right];
      if (!b || a.path.itemId === b.path.itemId || a.path.kind !== b.path.kind) continue;
      const gap = distance(a.point, b.point);
      if (gap <= maxDistance) pairs.push({ a, b, gap });
    }
  }

  pairs.sort((a, b) => a.gap - b.gap);
  const used = new Set<string>();
  const connectors: TerrainPolyline[] = [];
  pairs.forEach(({ a, b, gap }) => {
    if (used.has(a.id) || used.has(b.id)) return;
    used.add(a.id);
    used.add(b.id);
    const middle = {
      x: (a.point.x + b.point.x) / 2,
      y: (a.point.y + b.point.y) / 2,
    };
    const dx = b.point.x - a.point.x;
    const dy = b.point.y - a.point.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const bend = clamp(gap * 0.1, 0, 8);
    const control = {
      x: middle.x - (dy / length) * bend,
      y: middle.y + (dx / length) * bend,
    };
    connectors.push({
      id: `connector:${a.id}:${b.id}`,
      itemId: `${a.path.itemId}|${b.path.itemId}`,
      kind: a.path.kind,
      points: sampleQuadratic(a.point, control, b.point, 8),
      generated: true,
    });
  });

  // Then connect a free endpoint to the middle of another compatible path.
  // This is the T-junction reaction seen in terrain-aware builders.
  for (const end of ends) {
    if (used.has(end.id)) continue;
    let best: { point: TerrainPoint; distance: number; path: TerrainPolyline } | null = null;
    for (const path of paths) {
      if (path.itemId === end.path.itemId || path.kind !== end.path.kind) continue;
      const candidate = nearestPointOnPolyline(end.point, path.points);
      if (!candidate || candidate.distance > maxDistance * 0.45) continue;
      if (!best || candidate.distance < best.distance) best = { ...candidate, path };
    }
    if (!best) continue;
    used.add(end.id);
    connectors.push({
      id: `junction:${end.id}:${best.path.id}`,
      itemId: `${end.path.itemId}|${best.path.itemId}`,
      kind: end.path.kind,
      points: [end.point, best.point],
      generated: true,
    });
  }

  return connectors;
}

function regionFor(
  item: PlacedAsset,
  asset: CityAsset,
  kind: TerrainRegion['kind'],
): TerrainRegion {
  const building = kind === 'lot';
  const park = kind === 'park';
  return {
    id: item.id,
    kind,
    cx: item.x + asset.defaultWidth * 0.5,
    cy: item.y + asset.defaultHeight * (building ? 0.79 : 0.73),
    rx: asset.defaultWidth * (building ? 0.68 : park ? 0.78 : 0.83),
    ry: asset.defaultHeight * (building ? 0.33 : park ? 0.43 : 0.48),
  };
}

function entrance(item: PlacedAsset, asset: CityAsset): TerrainPoint {
  const direction = item.flipped ? -1 : 1;
  return {
    x: item.x + asset.defaultWidth * (0.5 + direction * 0.12),
    y: item.y + asset.defaultHeight * 0.89,
  };
}

function curvedConnection(
  start: TerrainPoint,
  end: TerrainPoint,
  itemId: string,
  kind: 'driveway' | 'footpath',
): TerrainPolyline {
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const bend = clamp(length * 0.12, 4, 18);
  const control = {
    x: midpoint.x - (dy / length) * bend,
    y: midpoint.y + (dx / length) * bend,
  };
  return {
    id: `${kind}:${itemId}`,
    itemId,
    kind,
    points: sampleQuadratic(start, control, end, 16),
  };
}

export function buildTerrainGeometry(
  items: PlacedAsset[],
  assetMap: ReadonlyMap<string, CityAsset>,
): TerrainGeometry {
  const roads: TerrainPolyline[] = [];
  const rails: TerrainPolyline[] = [];
  const bulbs: TerrainBulb[] = [];
  const lots: TerrainRegion[] = [];
  const parks: TerrainRegion[] = [];
  const nature: TerrainRegion[] = [];
  const buildings: Array<{ item: PlacedAsset; asset: CityAsset; entrance: TerrainPoint }> = [];

  items.forEach((item) => {
    const asset = assetMap.get(item.assetId);
    if (!asset) return;
    if (PROCEDURAL_ASSET_IDS.has(asset.id)) {
      const network = networkPaths(item, asset);
      roads.push(...network.roads);
      rails.push(...network.rails);
      bulbs.push(...network.bulbs);
    } else if (BUILDING_IDS.has(asset.id) || asset.category === 'building') {
      lots.push(regionFor(item, asset, 'lot'));
      buildings.push({ item, asset, entrance: entrance(item, asset) });
    } else if (asset.id === 'park_fountain' || asset.id === 'playground') {
      parks.push(regionFor(item, asset, 'park'));
    } else {
      nature.push(regionFor(item, asset, 'nature'));
    }
  });

  const roadConnections = connectPaths(roads, 88);
  const railConnections = connectPaths(rails, 76);
  const completeRoads = [...roads, ...roadConnections];
  const completeRails = [...rails, ...railConnections];
  const driveways: TerrainPolyline[] = [];

  for (const building of buildings) {
    let roadTarget: { point: TerrainPoint; distance: number } | null = null;
    for (const road of completeRoads) {
      const candidate = nearestPointOnPolyline(building.entrance, road.points);
      if (!candidate || candidate.distance > 285) continue;
      if (!roadTarget || candidate.distance < roadTarget.distance) roadTarget = candidate;
    }
    if (roadTarget) {
      driveways.push(
        curvedConnection(building.entrance, roadTarget.point, building.item.id, 'driveway'),
      );
      continue;
    }

    let parkTarget: { point: TerrainPoint; distance: number } | null = null;
    for (const park of parks) {
      const point = { x: park.cx, y: park.cy };
      const gap = distance(building.entrance, point);
      if (gap > 325) continue;
      if (!parkTarget || gap < parkTarget.distance) parkTarget = { point, distance: gap };
    }
    if (parkTarget) {
      driveways.push(
        curvedConnection(building.entrance, parkTarget.point, building.item.id, 'footpath'),
      );
    }
  }

  return {
    roads: completeRoads,
    rails: completeRails,
    driveways,
    lots,
    parks,
    nature,
    bulbs,
    stats: {
      autoConnections: roadConnections.length + railConnections.length,
      driveways: driveways.length,
      terrainRegions: lots.length + parks.length + nature.length,
    },
  };
}

export function snapNetworkItem(
  item: PlacedAsset,
  asset: CityAsset,
  items: PlacedAsset[],
  assetMap: ReadonlyMap<string, CityAsset>,
): { x: number; y: number; snapped: boolean } {
  if (!PROCEDURAL_ASSET_IDS.has(asset.id)) {
    return { x: item.x, y: item.y, snapped: false };
  }
  const candidate = networkPaths(item, asset);
  const candidateEnds = endpoints([...candidate.roads, ...candidate.rails]);
  const existingPaths: TerrainPolyline[] = [];
  items.forEach((other) => {
    if (other.id === item.id) return;
    const otherAsset = assetMap.get(other.assetId);
    if (!otherAsset || !PROCEDURAL_ASSET_IDS.has(otherAsset.id)) return;
    const network = networkPaths(other, otherAsset);
    existingPaths.push(...network.roads, ...network.rails);
  });
  const existingEnds = endpoints(existingPaths);
  let best: { gap: number; dx: number; dy: number } | null = null;
  for (const source of candidateEnds) {
    for (const target of existingEnds) {
      if (source.path.kind !== target.path.kind) continue;
      const gap = distance(source.point, target.point);
      if (gap > 42) continue;
      if (!best || gap < best.gap) {
        best = {
          gap,
          dx: target.point.x - source.point.x,
          dy: target.point.y - source.point.y,
        };
      }
    }
  }
  if (!best) return { x: item.x, y: item.y, snapped: false };
  return {
    x: clamp(item.x + best.dx, 0, BOARD_WIDTH - asset.defaultWidth),
    y: clamp(item.y + best.dy, 0, BOARD_HEIGHT - asset.defaultHeight),
    snapped: true,
  };
}
