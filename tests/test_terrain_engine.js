"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const engine = require(path.join(root, "windows-demo", "terrain-engine.js"));
const sandbox = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(root, "windows-demo", "assets.js"), "utf8"),
  sandbox,
);
const assets = sandbox.window.CITY_ASSETS;
const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

const rows = [
  ["road_cross", 400, 200, false, 10],
  ["road_straight_a", 258, 260, false, 11],
  ["road_straight_a", 542, 146, false, 12],
  ["road_straight_b", 258, 143, false, 13],
  ["road_straight_b", 542, 259, false, 14],
  ["rail_straight", 260, 430, false, 15],
  ["rail_straight", 402, 369, false, 16],
  ["rail_crossing", 544, 305, false, 17],
  ["park_fountain", 405, 36, false, 30],
  ["house_red", 90, 216, false, 50],
  ["hospital", 690, 150, false, 52],
];
const items = rows.map(([assetId, x, y, flipped, z], index) => ({
  id: `test-${index}`,
  assetId,
  x,
  y,
  flipped,
  z,
}));

const geometry = engine.buildTerrainGeometry(items, assetMap);
if (geometry.roads.length < 7) throw new Error("Road geometry was not generated");
if (geometry.rails.length < 3) throw new Error("Rail geometry was not generated");
if (geometry.stats.autoConnections < 4) throw new Error("Neighbor connections were not generated");
if (geometry.stats.driveways < 1) throw new Error("Building driveway was not generated");
if (geometry.lots.length !== 2) throw new Error("Building lots were not generated");

const afterDeletion = engine.buildTerrainGeometry(
  items.filter((item) => !item.assetId.startsWith("road_") && item.assetId !== "rail_crossing"),
  assetMap,
);
if (afterDeletion.roads.length !== 0) {
  throw new Error("Deleted roads remained in derived terrain");
}

const candidate = {
  id: "snap-candidate",
  assetId: "road_straight_a",
  x: 250,
  y: 262,
  flipped: false,
  z: 99,
};
const snapped = engine.snapNetworkItem(
  candidate,
  assetMap.get(candidate.assetId),
  items,
  assetMap,
);
if (!snapped.snapped || snapped.x !== 258 || snapped.y !== 260) {
  throw new Error(`Network snapping failed: ${JSON.stringify(snapped)}`);
}

console.log(
  JSON.stringify(
    {
      result: "PASS",
      roadPolylines: geometry.roads.length,
      railPolylines: geometry.rails.length,
      autoConnections: geometry.stats.autoConnections,
      driveways: geometry.stats.driveways,
      terrainRegions: geometry.stats.terrainRegions,
      deletionRestoresRoadCount: afterDeletion.roads.length,
      snapped,
    },
    null,
    2,
  ),
);
