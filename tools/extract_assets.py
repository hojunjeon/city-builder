#!/usr/bin/env python3
"""Extract transparent city assets from the supplied sprite sheet.

Dependencies:
  pip install pillow numpy opencv-python

The script identifies the 23 non-white connected components, names them by
row/column, removes the off-white JPEG background with a soft alpha edge, and
writes a JSON manifest used by the demos.
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ASSETS = [
    ("road_straight_a", "도로 직선 A", "road"),
    ("road_straight_b", "도로 직선 B", "road"),
    ("road_curve_a", "도로 곡선 A", "road"),
    ("road_curve_b", "도로 곡선 B", "road"),
    ("road_cross", "사거리", "road"),
    ("road_dead_end", "회차로", "road"),
    ("park_fountain", "분수 공원", "nature"),
    ("forest_pine", "침엽수 숲", "nature"),
    ("forest_broadleaf", "활엽수 숲", "nature"),
    ("playground", "놀이터", "nature"),
    ("rail_straight", "철길", "road"),
    ("rail_crossing", "철도 건널목", "road"),
    ("house_red", "빨간 지붕 주택", "building"),
    ("house_blue", "파란 지붕 주택", "building"),
    ("house_purple", "보라 지붕 주택", "building"),
    ("shop_yellow", "노란 상점", "building"),
    ("school", "학교", "building"),
    ("church", "교회", "building"),
    ("apartment", "아파트", "building"),
    ("hospital", "병원", "building"),
    ("fire_station", "소방서", "building"),
    ("office", "사무실", "building"),
    ("shop_green", "초록 상점", "building"),
]


def component_order(stats: np.ndarray, centroids: np.ndarray) -> list[int]:
    """Return component ids in the visual row/column order of the sheet."""
    groups: list[list[tuple[float, int]]] = [[], [], [], []]
    for component_id in range(1, len(stats)):
        x, y, w, h, area = stats[component_id]
        if area < 500:
            continue
        cx, cy = centroids[component_id]
        if cy < 240:
            row = 0
        elif cy < 480:
            row = 1
        elif cy < 760:
            row = 2
        else:
            row = 3
        groups[row].append((float(cx), component_id))

    ordered: list[int] = []
    expected = [6, 6, 6, 5]
    for row, values in enumerate(groups):
        values.sort(key=lambda item: item[0])
        if len(values) != expected[row]:
            raise RuntimeError(
                f"Expected {expected[row]} assets in row {row + 1}, found {len(values)}"
            )
        ordered.extend(component_id for _, component_id in values)
    return ordered


def extract(source_path: Path, output_dir: Path, manifest_path: Path) -> None:
    bgr = cv2.imread(str(source_path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(source_path)

    height, width = bgr.shape[:2]
    border = np.concatenate(
        [
            bgr[:20].reshape(-1, 3),
            bgr[-20:].reshape(-1, 3),
            bgr[:, :20].reshape(-1, 3),
            bgr[:, -20:].reshape(-1, 3),
        ],
        axis=0,
    )
    background = np.median(border, axis=0).astype(np.float32)
    distance = np.linalg.norm(bgr.astype(np.float32) - background, axis=2)

    hard_mask = (distance > 10.0).astype(np.uint8) * 255
    hard_mask = cv2.morphologyEx(
        hard_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)
    )
    hard_mask = cv2.morphologyEx(
        hard_mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)
    )

    count, labels, stats, centroids = cv2.connectedComponentsWithStats(
        hard_mask, connectivity=8
    )
    if count < 24:
        raise RuntimeError(f"Could not identify 23 assets; components={count - 1}")

    ordered_ids = component_order(stats, centroids)
    if len(ordered_ids) != len(ASSETS):
        raise RuntimeError(
            f"Manifest has {len(ASSETS)} entries but extraction found {len(ordered_ids)}"
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    manifest: list[dict[str, object]] = []

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    for (asset_id, label, category), component_id in zip(ASSETS, ordered_ids):
        x, y, w, h, _ = stats[component_id]
        padding = 10
        x0 = max(0, int(x) - padding)
        y0 = max(0, int(y) - padding)
        x1 = min(width, int(x + w) + padding)
        y1 = min(height, int(y + h) + padding)

        component = (labels == component_id).astype(np.uint8)
        component = cv2.dilate(component, np.ones((7, 7), np.uint8), iterations=1)
        component_crop = component[y0:y1, x0:x1].astype(np.float32)
        distance_crop = distance[y0:y1, x0:x1]

        # Soft edge: fully transparent near the original background, opaque once
        # the pixel is clearly part of the illustration.
        alpha = np.clip((distance_crop - 2.5) / 13.5 * 255.0, 0, 255)
        alpha *= component_crop
        alpha[alpha < 8] = 0

        rgba = np.dstack(
            [rgb[y0:y1, x0:x1], alpha.astype(np.uint8)]
        ).astype(np.uint8)
        image = Image.fromarray(rgba, mode="RGBA")
        output_path = output_dir / f"{asset_id}.png"
        image.save(output_path, optimize=True)

        source_w, source_h = image.size
        if category == "road":
            display_w = 154
        elif category == "nature":
            display_w = 150
        else:
            display_w = 148 if source_h < 240 else 160
        display_h = max(1, round(display_w * source_h / source_w))

        manifest.append(
            {
                "id": asset_id,
                "label": label,
                "category": category,
                "file": f"sprites/{asset_id}.png",
                "sourceWidth": source_w,
                "sourceHeight": source_h,
                "defaultWidth": display_w,
                "defaultHeight": display_h,
            }
        )

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument(
        "--copy-to",
        action="append",
        type=Path,
        default=[],
        help="Additional directories that receive copies of the extracted PNGs.",
    )
    args = parser.parse_args()

    extract(args.source, args.output, args.manifest)
    for target in args.copy_to:
        target.mkdir(parents=True, exist_ok=True)
        for png in args.output.glob("*.png"):
            shutil.copy2(png, target / png.name)


if __name__ == "__main__":
    main()
