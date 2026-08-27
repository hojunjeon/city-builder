from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

for target in [
    ROOT / "shared-assets" / "sprites",
    ROOT / "shared-assets" / "objects",
    ROOT / "windows-demo" / "assets" / "sprites",
    ROOT / "windows-demo" / "assets" / "objects",
    ROOT / "mobile-expo" / "assets" / "sprites",
    ROOT / "mobile-expo" / "assets" / "objects",
]:
    count = len(list(target.glob("*.png")))
    if count != 23:
        raise SystemExit(f"{target}: expected 23 PNG files, got {count}")

for removed in [
    ROOT / "shared-assets" / "terrain",
    ROOT / "windows-demo" / "assets" / "terrain",
    ROOT / "mobile-expo" / "assets" / "terrain",
    ROOT / "mobile-expo" / "src" / "data" / "terrain.ts",
]:
    if removed.exists():
        raise SystemExit(f"Legacy patch terrain still exists: {removed}")

for json_file in [
    ROOT / "shared-assets" / "asset_manifest.json",
    ROOT / "windows-demo" / "assets" / "asset_manifest.json",
    ROOT / "mobile-expo" / "assets" / "asset_manifest.json",
    ROOT / "mobile-expo" / "package.json",
    ROOT / "mobile-expo" / "app.json",
]:
    json.loads(json_file.read_text(encoding="utf-8"))

required_text = {
    ROOT / "windows-demo" / "index.html": ["terrainCanvas", "terrain-engine.js"],
    ROOT / "windows-demo" / "app.js": ["buildTerrainGeometry", "snapNetworkItem"],
    ROOT / "mobile-expo" / "App.tsx": ["DynamicTerrain", "buildTerrainGeometry", "snapNetworkItem"],
    ROOT / "mobile-expo" / "src" / "components" / "DynamicTerrain.tsx": ["geometry.roads", "geometry.rails"],
}
for file, needles in required_text.items():
    text = file.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"Missing {needle!r} in {file}")

print("PASS: 23 assets per target, legacy patch terrain removed, configs and dynamic engine references verified")
