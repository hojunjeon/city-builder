"""Create object sprites whose baked square/diamond ground fades into the dynamic terrain.

The source sheet contains complete isometric tiles.  The runtime now derives terrain
procedurally, so the outer ground plate and its drop shadow must not read as a card
placed on top of the field.  This script keeps architecture/props opaque and fades
only the lower, wide terrain component.
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import cv2
import numpy as np

NETWORK_IDS = {
    "road_straight_a",
    "road_straight_b",
    "road_curve_a",
    "road_curve_b",
    "road_cross",
    "road_dead_end",
    "rail_straight",
    "rail_crossing",
}


def soften_sprite(source: Path, destination: Path) -> None:
    rgba = cv2.imread(str(source), cv2.IMREAD_UNCHANGED)
    if rgba is None or rgba.ndim != 3 or rgba.shape[2] != 4:
        raise ValueError(f"Expected RGBA PNG: {source}")

    bgr = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    hue, saturation, value = cv2.split(hsv)
    height, width = alpha.shape

    y = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None]
    x = np.linspace(0.0, 1.0, width, dtype=np.float32)[None, :]

    # Ground candidates: green turf, beige paving and muted shadow/curb pixels.
    green = (
        (hue >= 28)
        & (hue <= 96)
        & (saturation >= 42)
        & (value >= 38)
        & (y > 0.37)
    )
    paving = (
        (hue >= 7)
        & (hue <= 37)
        & (saturation >= 16)
        & (saturation <= 158)
        & (value >= 92)
        & (y > 0.50)
    )
    muted_surface = (
        (saturation < 58)
        & (value >= 42)
        & (value <= 228)
        & (y > 0.59)
    )
    lower_shadow = (value < 96) & (y > 0.67)
    candidates = (green | paving | muted_surface | lower_shadow) & (alpha > 0)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    connected = cv2.morphologyEx(
        candidates.astype(np.uint8) * 255,
        cv2.MORPH_CLOSE,
        kernel,
        iterations=2,
    )

    # Select only broad components reaching the lower terrain plane.  Small green
    # components such as shrubs and tree crowns therefore remain visible.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        (connected > 0).astype(np.uint8), 8
    )
    terrain = np.zeros_like(connected)
    for index in range(1, count):
        left, top, comp_width, comp_height, area = stats[index]
        broad = comp_width > width * 0.34
        reaches_base = top + comp_height > height * 0.64
        substantial = area > width * height * 0.021
        if broad and reaches_base and substantial:
            terrain[labels == index] = 255

    terrain = cv2.GaussianBlur(terrain, (0, 0), 3.1)
    lower_ramp = np.clip((y - 0.41) / 0.48, 0.0, 1.0)
    removal = (terrain.astype(np.float32) / 255.0) * lower_ramp * 0.93

    # Preserve the building/prop core.  The ground at the outer rim fades most,
    # while doors, fences and the lower façade remain readable.
    preserve = (y < 0.47).astype(np.float32)
    preserve = np.maximum(
        preserve,
        ((y < 0.79) & (x > 0.21) & (x < 0.79)).astype(np.float32) * 0.73,
    )
    removal *= 1.0 - preserve * 0.76

    dark_rim = (
        (value < 82)
        & (saturation < 135)
        & (y > 0.68)
        & (alpha > 0)
    ).astype(np.float32)
    removal = np.maximum(removal, dark_rim * 0.88)

    new_alpha = np.clip(alpha.astype(np.float32) * (1.0 - removal), 0, 255)

    # Feather the lower cut edge only.  Upper architecture keeps its crisp outline.
    binary = (new_alpha > 12).astype(np.uint8)
    distance = cv2.distanceTransform(binary, cv2.DIST_L2, 3)
    edge_fade = np.clip(distance / 4.0, 0.0, 1.0)
    lower_weight = np.clip((y - 0.51) / 0.37, 0.0, 1.0)
    new_alpha *= 1.0 - lower_weight + lower_weight * edge_fade

    output = rgba.copy()
    output[:, :, 3] = np.clip(new_alpha, 0, 255).astype(np.uint8)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(destination), output):
        raise OSError(f"Could not write {destination}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    for source in sorted(args.source_dir.glob("*.png")):
        soften_sprite(source, args.output_dir / source.name)

    print(f"generated {len(list(args.output_dir.glob('*.png')))} object sprites")


if __name__ == "__main__":
    main()
