(function bootstrap(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CityTerrainEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTerrainEngine() {
  "use strict";

  const ROAD_IDS = new Set([
    "road_straight_a",
    "road_straight_b",
    "road_curve_a",
    "road_curve_b",
    "road_cross",
    "road_dead_end",
    "rail_crossing",
  ]);
  const RAIL_IDS = new Set(["rail_straight", "rail_crossing"]);
  const PROCEDURAL_IDS = new Set([...ROAD_IDS, ...RAIL_IDS]);
  const BUILDING_IDS = new Set([
    "house_red",
    "house_blue",
    "house_purple",
    "shop_yellow",
    "school",
    "church",
    "apartment",
    "hospital",
    "fire_station",
    "office",
    "shop_green",
  ]);

  const DEFAULTS = {
    width: 960,
    height: 540,
    roadConnectDistance: 88,
    railConnectDistance: 76,
    endpointSnapDistance: 42,
    drivewaySearchDistance: 285,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function pointLerp(a, b, t) {
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  }

  function sampleQuadratic(a, control, b, steps = 20) {
    const points = [];
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const u = 1 - t;
      points.push({
        x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
      });
    }
    return points;
  }

  function transformNormalized(point, flipped) {
    return { x: flipped ? 1 - point.x : point.x, y: point.y };
  }

  function worldPoint(item, asset, point) {
    const normalized = transformNormalized(point, item.flipped);
    return {
      x: item.x + normalized.x * asset.defaultWidth,
      y: item.y + normalized.y * asset.defaultHeight,
    };
  }

  function worldPolyline(item, asset, normalizedPoints) {
    const transformed = normalizedPoints.map((point) => worldPoint(item, asset, point));
    return item.flipped ? transformed.reverse() : transformed;
  }

  function normalizedAssetPaths(assetId) {
    const straightA = [
      { x: 0.04, y: 0.76 },
      { x: 0.96, y: 0.24 },
    ];
    const straightB = [
      { x: 0.04, y: 0.24 },
      { x: 0.96, y: 0.76 },
    ];

    switch (assetId) {
      case "road_straight_a":
        return { roads: [straightA], rails: [], bulbs: [] };
      case "road_straight_b":
        return { roads: [straightB], rails: [], bulbs: [] };
      case "road_curve_a":
        return {
          roads: [
            sampleQuadratic(
              { x: 0.03, y: 0.70 },
              { x: 0.50, y: 0.12 },
              { x: 0.97, y: 0.70 },
              24,
            ),
          ],
          rails: [],
          bulbs: [],
        };
      case "road_curve_b":
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
      case "road_cross":
        return { roads: [straightA, straightB], rails: [], bulbs: [] };
      case "road_dead_end":
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
          bulbs: [{ x: 0.68, y: 0.40, radius: 0.19 }],
        };
      case "rail_straight":
        return { roads: [], rails: [straightA], bulbs: [] };
      case "rail_crossing":
        return { roads: [straightB], rails: [straightA], bulbs: [] };
      default:
        return { roads: [], rails: [], bulbs: [] };
    }
  }

  function makeNetworkPaths(item, asset) {
    const local = normalizedAssetPaths(asset.id);
    const roads = local.roads.map((points, index) => ({
      id: `${item.id}:road:${index}`,
      itemId: item.id,
      kind: "road",
      points: worldPolyline(item, asset, points),
      z: item.z,
    }));
    const rails = local.rails.map((points, index) => ({
      id: `${item.id}:rail:${index}`,
      itemId: item.id,
      kind: "rail",
      points: worldPolyline(item, asset, points),
      z: item.z,
    }));
    const bulbs = local.bulbs.map((bulb, index) => {
      const center = worldPoint(item, asset, bulb);
      return {
        id: `${item.id}:bulb:${index}`,
        itemId: item.id,
        kind: "road",
        x: center.x,
        y: center.y,
        radius: bulb.radius * Math.min(asset.defaultWidth, asset.defaultHeight),
      };
    });
    return { roads, rails, bulbs };
  }

  function endpointsFor(paths) {
    const endpoints = [];
    paths.forEach((path) => {
      if (path.points.length < 2) return;
      endpoints.push({
        id: `${path.id}:0`,
        pathId: path.id,
        itemId: path.itemId,
        kind: path.kind,
        end: 0,
        point: path.points[0],
      });
      endpoints.push({
        id: `${path.id}:1`,
        pathId: path.id,
        itemId: path.itemId,
        kind: path.kind,
        end: 1,
        point: path.points[path.points.length - 1],
      });
    });
    return endpoints;
  }

  function nearestPointOnSegment(point, a, b) {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lengthSquared = vx * vx + vy * vy;
    if (lengthSquared <= 0.0001) return { point: { ...a }, t: 0, distance: distance(point, a) };
    const t = clamp(((point.x - a.x) * vx + (point.y - a.y) * vy) / lengthSquared, 0, 1);
    const candidate = { x: a.x + vx * t, y: a.y + vy * t };
    return { point: candidate, t, distance: distance(point, candidate) };
  }

  function nearestPointOnPolyline(point, polyline) {
    let best = null;
    for (let index = 0; index < polyline.length - 1; index += 1) {
      const candidate = nearestPointOnSegment(point, polyline[index], polyline[index + 1]);
      if (!best || candidate.distance < best.distance) {
        best = { ...candidate, segmentIndex: index };
      }
    }
    return best;
  }

  function buildConnections(paths, maxDistance) {
    const endpoints = endpointsFor(paths);
    const candidates = [];

    for (let left = 0; left < endpoints.length; left += 1) {
      for (let right = left + 1; right < endpoints.length; right += 1) {
        const a = endpoints[left];
        const b = endpoints[right];
        if (a.itemId === b.itemId || a.kind !== b.kind) continue;
        const gap = distance(a.point, b.point);
        if (gap <= maxDistance) candidates.push({ a, b, gap });
      }
    }

    candidates.sort((a, b) => a.gap - b.gap);
    const used = new Set();
    const connectors = [];
    for (const candidate of candidates) {
      if (used.has(candidate.a.id) || used.has(candidate.b.id)) continue;
      used.add(candidate.a.id);
      used.add(candidate.b.id);
      const midpoint = pointLerp(candidate.a.point, candidate.b.point, 0.5);
      const normalOffset = clamp(candidate.gap * 0.10, 0, 8);
      const dx = candidate.b.point.x - candidate.a.point.x;
      const dy = candidate.b.point.y - candidate.a.point.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const control = {
        x: midpoint.x - (dy / length) * normalOffset,
        y: midpoint.y + (dx / length) * normalOffset,
      };
      connectors.push({
        id: `connector:${candidate.a.id}:${candidate.b.id}`,
        itemId: `${candidate.a.itemId}|${candidate.b.itemId}`,
        kind: candidate.a.kind,
        points: sampleQuadratic(candidate.a.point, control, candidate.b.point, 8),
        generated: true,
        z: Math.min(
          paths.find((path) => path.id === candidate.a.pathId)?.z ?? 0,
          paths.find((path) => path.id === candidate.b.pathId)?.z ?? 0,
        ),
      });
    }

    // An endpoint close to the middle of another path forms a T-junction.  This is
    // what makes a newly dropped road react to the existing network instead of
    // behaving like an isolated sticker.
    for (const endpoint of endpoints) {
      if (used.has(endpoint.id)) continue;
      let best = null;
      for (const path of paths) {
        if (path.itemId === endpoint.itemId || path.kind !== endpoint.kind) continue;
        const candidate = nearestPointOnPolyline(endpoint.point, path.points);
        if (!candidate || candidate.distance > maxDistance * 0.45) continue;
        if (!best || candidate.distance < best.distance) best = { ...candidate, path };
      }
      if (!best) continue;
      used.add(endpoint.id);
      connectors.push({
        id: `junction:${endpoint.id}:${best.path.id}`,
        itemId: `${endpoint.itemId}|${best.path.itemId}`,
        kind: endpoint.kind,
        points: [endpoint.point, best.point],
        generated: true,
        z: Math.min(best.path.z ?? 0, 0),
      });
    }

    return connectors;
  }

  function assetBaseShape(item, asset, profile) {
    const centerX = item.x + asset.defaultWidth * 0.5;
    const centerY = item.y + asset.defaultHeight * (profile === "building" ? 0.79 : 0.73);
    if (profile === "building") {
      return {
        id: item.id,
        kind: "lot",
        cx: centerX,
        cy: centerY,
        rx: asset.defaultWidth * 0.68,
        ry: asset.defaultHeight * 0.33,
        z: item.z,
      };
    }
    if (profile === "park") {
      return {
        id: item.id,
        kind: "park",
        cx: centerX,
        cy: centerY,
        rx: asset.defaultWidth * 0.78,
        ry: asset.defaultHeight * 0.43,
        z: item.z,
      };
    }
    return {
      id: item.id,
      kind: "nature",
      cx: centerX,
      cy: centerY,
      rx: asset.defaultWidth * 0.83,
      ry: asset.defaultHeight * 0.48,
      z: item.z,
    };
  }

  function entranceFor(item, asset) {
    const side = item.flipped ? -1 : 1;
    return {
      x: item.x + asset.defaultWidth * (0.50 + side * 0.12),
      y: item.y + asset.defaultHeight * 0.89,
    };
  }

  function nearestNetworkPoint(point, paths, maxDistance) {
    let best = null;
    for (const path of paths) {
      const candidate = nearestPointOnPolyline(point, path.points);
      if (!candidate || candidate.distance > maxDistance) continue;
      if (!best || candidate.distance < best.distance) best = { ...candidate, path };
    }
    return best;
  }

  function makeDriveway(start, end, itemId, kind) {
    const midpoint = pointLerp(start, end, 0.5);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const bend = clamp(length * 0.12, 4, 18);
    const control = {
      x: midpoint.x - (dy / length) * bend,
      y: midpoint.y + (dx / length) * bend,
    };
    return {
      id: `driveway:${itemId}`,
      itemId,
      kind,
      points: sampleQuadratic(start, control, end, 16),
    };
  }

  function buildTerrainGeometry(items, assetMap, options = {}) {
    const settings = { ...DEFAULTS, ...options };
    const roads = [];
    const rails = [];
    const bulbs = [];
    const lots = [];
    const parks = [];
    const nature = [];
    const buildings = [];
    const visualObjects = [];

    [...items]
      .sort((a, b) => a.z - b.z)
      .forEach((item) => {
        const asset = assetMap.get(item.assetId);
        if (!asset) return;
        if (PROCEDURAL_IDS.has(asset.id)) {
          const network = makeNetworkPaths(item, asset);
          roads.push(...network.roads);
          rails.push(...network.rails);
          bulbs.push(...network.bulbs);
          if (asset.id === "rail_crossing") visualObjects.push(item);
          return;
        }
        visualObjects.push(item);
        if (BUILDING_IDS.has(asset.id) || asset.category === "building") {
          lots.push(assetBaseShape(item, asset, "building"));
          buildings.push({ item, asset, entrance: entranceFor(item, asset) });
        } else if (asset.id === "park_fountain" || asset.id === "playground") {
          parks.push(assetBaseShape(item, asset, "park"));
        } else {
          nature.push(assetBaseShape(item, asset, "nature"));
        }
      });

    const roadConnectors = buildConnections(roads, settings.roadConnectDistance);
    const railConnectors = buildConnections(rails, settings.railConnectDistance);
    const completeRoads = [...roads, ...roadConnectors];
    const completeRails = [...rails, ...railConnectors];

    const driveways = [];
    const parkAnchors = parks.map((shape) => ({ x: shape.cx, y: shape.cy, id: shape.id }));
    for (const building of buildings) {
      const roadTarget = nearestNetworkPoint(
        building.entrance,
        completeRoads,
        settings.drivewaySearchDistance,
      );
      if (roadTarget) {
        driveways.push(makeDriveway(building.entrance, roadTarget.point, building.item.id, "driveway"));
        continue;
      }
      let nearestPark = null;
      for (const park of parkAnchors) {
        const gap = distance(building.entrance, park);
        if (gap > settings.drivewaySearchDistance * 1.15) continue;
        if (!nearestPark || gap < nearestPark.gap) nearestPark = { park, gap };
      }
      if (nearestPark) {
        driveways.push(
          makeDriveway(building.entrance, nearestPark.park, building.item.id, "footpath"),
        );
      }
    }

    return {
      width: settings.width,
      height: settings.height,
      roads: completeRoads,
      rails: completeRails,
      roadConnectors,
      railConnectors,
      bulbs,
      lots,
      parks,
      nature,
      driveways,
      visualObjects,
      stats: {
        roadSegments: roads.length,
        railSegments: rails.length,
        autoConnections: roadConnectors.length + railConnectors.length,
        driveways: driveways.length,
        terrainRegions: lots.length + parks.length + nature.length,
      },
    };
  }

  function snapNetworkItem(item, asset, items, assetMap, options = {}) {
    if (!PROCEDURAL_IDS.has(asset.id)) return { x: item.x, y: item.y, snapped: false };
    const settings = { ...DEFAULTS, ...options };
    const candidateGeometry = makeNetworkPaths(item, asset);
    const candidatePaths = [...candidateGeometry.roads, ...candidateGeometry.rails];
    const existing = [];
    for (const other of items) {
      if (other.id === item.id) continue;
      const otherAsset = assetMap.get(other.assetId);
      if (!otherAsset || !PROCEDURAL_IDS.has(otherAsset.id)) continue;
      const geometry = makeNetworkPaths(other, otherAsset);
      existing.push(...geometry.roads, ...geometry.rails);
    }

    const candidateEndpoints = endpointsFor(candidatePaths);
    const existingEndpoints = endpointsFor(existing);
    let best = null;
    for (const source of candidateEndpoints) {
      for (const target of existingEndpoints) {
        if (source.kind !== target.kind) continue;
        const gap = distance(source.point, target.point);
        if (gap > settings.endpointSnapDistance) continue;
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
      x: clamp(item.x + best.dx, 0, settings.width - asset.defaultWidth),
      y: clamp(item.y + best.dy, 0, settings.height - asset.defaultHeight),
      snapped: true,
    };
  }

  function createCanvas(width, height) {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
    throw new Error("Canvas rendering is only available in a browser context.");
  }

  function drawDiamond(ctx, shape, scale = 1) {
    const rx = shape.rx * scale;
    const ry = shape.ry * scale;
    ctx.beginPath();
    ctx.moveTo(shape.cx, shape.cy - ry);
    ctx.lineTo(shape.cx + rx, shape.cy);
    ctx.lineTo(shape.cx, shape.cy + ry);
    ctx.lineTo(shape.cx - rx, shape.cy);
    ctx.closePath();
  }

  function drawMask(width, height, shapes, type, blurPixels) {
    const raw = createCanvas(width, height);
    const rawCtx = raw.getContext("2d");
    rawCtx.fillStyle = "#fff";
    for (const shape of shapes) {
      if (type === "ellipse") {
        rawCtx.beginPath();
        rawCtx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
        rawCtx.fill();
      } else {
        drawDiamond(rawCtx, shape);
        rawCtx.fill();
      }
    }
    if (!blurPixels) return raw;
    const blurred = createCanvas(width, height);
    const blurredCtx = blurred.getContext("2d");
    blurredCtx.filter = `blur(${blurPixels}px)`;
    blurredCtx.drawImage(raw, 0, 0);
    blurredCtx.filter = "none";
    return blurred;
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return function next() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function hashText(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function makeTexture(width, height, config) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = config.base;
    ctx.fillRect(0, 0, width, height);
    const random = seededRandom(config.seed);
    const count = config.count ?? Math.round((width * height) / 2800);
    for (let index = 0; index < count; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = lerp(config.radiusMin ?? 0.7, config.radiusMax ?? 2.2, random());
      const color = config.accents[Math.floor(random() * config.accents.length)];
      ctx.globalAlpha = lerp(0.14, 0.44, random());
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return canvas;
  }

  function paintMaskedTexture(ctx, width, height, mask, config) {
    const layer = createCanvas(width, height);
    const layerCtx = layer.getContext("2d");
    const texture = makeTexture(width, height, config);
    layerCtx.drawImage(texture, 0, 0);
    layerCtx.globalCompositeOperation = "destination-in";
    layerCtx.drawImage(mask, 0, 0);
    layerCtx.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.globalAlpha = config.opacity ?? 1;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }

  function strokePolyline(ctx, points) {
    if (!points || points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.stroke();
  }

  function strokePaths(ctx, paths, style) {
    ctx.save();
    ctx.lineCap = style.lineCap ?? "round";
    ctx.lineJoin = style.lineJoin ?? "round";
    ctx.lineWidth = style.width;
    ctx.strokeStyle = style.color;
    ctx.globalAlpha = style.opacity ?? 1;
    ctx.setLineDash(style.dash ?? []);
    if (style.filter) ctx.filter = style.filter;
    paths.forEach((path) => strokePolyline(ctx, path.points));
    ctx.restore();
  }

  function drawBulbs(ctx, bulbs, style, radiusAdd = 0) {
    ctx.save();
    ctx.fillStyle = style.color;
    ctx.globalAlpha = style.opacity ?? 1;
    if (style.filter) ctx.filter = style.filter;
    bulbs.forEach((bulb) => {
      ctx.beginPath();
      ctx.arc(bulb.x, bulb.y, Math.max(2, bulb.radius + radiusAdd), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawOffsetRail(ctx, points, offset, color, width) {
    if (points.length < 2) return;
    const shifted = [];
    for (let index = 0; index < points.length; index += 1) {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      shifted.push({
        x: points[index].x - (dy / length) * offset,
        y: points[index].y + (dx / length) * offset,
      });
    }
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    strokePolyline(ctx, shifted);
    ctx.restore();
  }

  function polylineSamples(points, spacing) {
    const samples = [];
    let carry = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index];
      const b = points[index + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length < 0.001) continue;
      let position = spacing - carry;
      while (position <= length) {
        const t = position / length;
        samples.push({
          point: { x: a.x + dx * t, y: a.y + dy * t },
          tangent: { x: dx / length, y: dy / length },
        });
        position += spacing;
      }
      carry = Math.max(0, length - (position - spacing));
    }
    return samples;
  }

  function drawRailSleepers(ctx, rails) {
    ctx.save();
    ctx.strokeStyle = "#6f4930";
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    for (const rail of rails) {
      for (const sample of polylineSamples(rail.points, 13)) {
        const nx = -sample.tangent.y;
        const ny = sample.tangent.x;
        const half = 12;
        ctx.beginPath();
        ctx.moveTo(sample.point.x - nx * half, sample.point.y - ny * half);
        ctx.lineTo(sample.point.x + nx * half, sample.point.y + ny * half);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawLotDetails(ctx, lots) {
    ctx.save();
    ctx.lineJoin = "round";
    for (const shape of lots) {
      drawDiamond(ctx, shape, 0.76);
      ctx.fillStyle = "rgba(218, 204, 160, 0.26)";
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(96, 112, 73, 0.33)";
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTerrain(canvas, geometry, options = {}) {
    if (!canvas) return;
    const width = geometry.width || canvas.width || DEFAULTS.width;
    const height = geometry.height || canvas.height || DEFAULTS.height;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    if (options.grassImage && options.grassImage.complete) {
      ctx.drawImage(options.grassImage, 0, 0, width, height);
    } else {
      ctx.fillStyle = "#8fcb35";
      ctx.fillRect(0, 0, width, height);
    }

    if (geometry.nature.length) {
      const mask = drawMask(width, height, geometry.nature, "ellipse", 18);
      paintMaskedTexture(ctx, width, height, mask, {
        base: "rgba(63, 126, 51, 0.38)",
        accents: ["#2f703c", "#85b843", "#214f31"],
        seed: hashText("nature"),
        count: 190,
        radiusMin: 0.8,
        radiusMax: 3.2,
        opacity: 0.72,
      });
    }

    if (geometry.parks.length) {
      const mask = drawMask(width, height, geometry.parks, "diamond", 14);
      paintMaskedTexture(ctx, width, height, mask, {
        base: "rgba(117, 181, 58, 0.38)",
        accents: ["#65a747", "#b7d95d", "#f0d763", "#e8f1bc"],
        seed: hashText("parks"),
        count: 150,
        radiusMin: 0.6,
        radiusMax: 2.3,
        opacity: 0.76,
      });
    }

    if (geometry.lots.length) {
      const mask = drawMask(width, height, geometry.lots, "diamond", 12);
      paintMaskedTexture(ctx, width, height, mask, {
        base: "rgba(150, 165, 91, 0.34)",
        accents: ["#d1c49f", "#7ca052", "#b7ad83", "#7b8b63"],
        seed: hashText("lots"),
        count: 170,
        radiusMin: 0.5,
        radiusMax: 2.1,
        opacity: 0.78,
      });
      drawLotDetails(ctx, geometry.lots);
    }

    const driveways = geometry.driveways.filter((path) => path.kind === "driveway");
    const footpaths = geometry.driveways.filter((path) => path.kind === "footpath");
    strokePaths(ctx, footpaths, { width: 18, color: "rgba(87, 122, 56, .20)", filter: "blur(7px)" });
    strokePaths(ctx, footpaths, { width: 8, color: "#d8c99e", opacity: 0.76 });
    strokePaths(ctx, driveways, { width: 25, color: "rgba(95, 106, 68, .22)", filter: "blur(8px)" });
    strokePaths(ctx, driveways, { width: 15, color: "#cfbf96", opacity: 0.92 });
    strokePaths(ctx, driveways, { width: 10, color: "#a99f82", opacity: 0.48 });

    if (geometry.roads.length || geometry.bulbs.length) {
      strokePaths(ctx, geometry.roads, {
        width: 86,
        color: "rgba(74, 103, 49, .30)",
        filter: "blur(12px)",
      });
      drawBulbs(ctx, geometry.bulbs, { color: "rgba(74, 103, 49, .30)", filter: "blur(12px)" }, 21);
      strokePaths(ctx, geometry.roads, { width: 64, color: "#d6c89f" });
      drawBulbs(ctx, geometry.bulbs, { color: "#d6c89f" }, 12);
      strokePaths(ctx, geometry.roads, { width: 53, color: "#8c8576" });
      drawBulbs(ctx, geometry.bulbs, { color: "#8c8576" }, 7);
      strokePaths(ctx, geometry.roads, { width: 47, color: "#3d4549" });
      drawBulbs(ctx, geometry.bulbs, { color: "#3d4549" }, 4);
      strokePaths(ctx, geometry.roads, { width: 39, color: "#454d51" });
      drawBulbs(ctx, geometry.bulbs, { color: "#454d51" }, 0);
      strokePaths(ctx, geometry.roads, {
        width: 2.4,
        color: "rgba(248,247,236,.92)",
        dash: [12, 10],
      });
    }

    if (geometry.rails.length) {
      strokePaths(ctx, geometry.rails, {
        width: 54,
        color: "rgba(102, 90, 55, .25)",
        filter: "blur(10px)",
      });
      strokePaths(ctx, geometry.rails, { width: 34, color: "#8e806b" });
      strokePaths(ctx, geometry.rails, { width: 26, color: "#806d58" });
      drawRailSleepers(ctx, geometry.rails);
      geometry.rails.forEach((rail) => {
        drawOffsetRail(ctx, rail.points, -6.3, "#34383a", 3.2);
        drawOffsetRail(ctx, rail.points, 6.3, "#34383a", 3.2);
        drawOffsetRail(ctx, rail.points, -6.3, "rgba(236,231,215,.50)", 1.0);
        drawOffsetRail(ctx, rail.points, 6.3, "rgba(236,231,215,.50)", 1.0);
      });
    }

    // Small deterministic ground details make terrain regions read as modified
    // land rather than translucent color overlays.
    ctx.save();
    for (const region of [...geometry.parks, ...geometry.nature]) {
      const random = seededRandom(hashText(region.id));
      const detailCount = region.kind === "park" ? 8 : 12;
      for (let index = 0; index < detailCount; index += 1) {
        const angle = random() * Math.PI * 2;
        const radius = Math.sqrt(random());
        const x = region.cx + Math.cos(angle) * region.rx * radius * 0.82;
        const y = region.cy + Math.sin(angle) * region.ry * radius * 0.72;
        ctx.globalAlpha = 0.35 + random() * 0.35;
        ctx.fillStyle = random() > 0.55 ? "#f4df6a" : "#e9f0cf";
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + random() * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  return {
    ROAD_IDS,
    RAIL_IDS,
    PROCEDURAL_IDS,
    BUILDING_IDS,
    buildTerrainGeometry,
    drawTerrain,
    makeNetworkPaths,
    normalizedAssetPaths,
    nearestPointOnPolyline,
    snapNetworkItem,
  };
});
