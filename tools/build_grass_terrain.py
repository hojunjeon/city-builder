#!/usr/bin/env python3
"""Build the grassy starter field and automatic terrain-blend overlays.

The source is the supplied finished-city reference. Only bright grass patches
are sampled; buildings, roads and trees are rejected by color/edge scoring.
The resulting field is then quilted from many small real-image patches so its
palette matches the supplied artwork without using the whole city as a fixed
background.

Dependencies:
  pip install pillow numpy opencv-python
"""
from __future__ import annotations

import argparse
import math
import random
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BOARD_SIZE = (960, 540)
PATCH_SIZE = 56
PATCH_STEP = 32
RANDOM_SEED = 408


def select_grass_patches(source: np.ndarray) -> list[np.ndarray]:
    hsv = cv2.cvtColor(source, cv2.COLOR_BGR2HSV)
    hue, saturation, value = cv2.split(hsv)
    blue, green, red = cv2.split(source)

    grass = (
        (hue >= 34)
        & (hue <= 52)
        & (saturation >= 105)
        & (saturation <= 240)
        & (value >= 125)
        & (value <= 245)
        & (green > red * 1.12)
        & (green > blue * 1.35)
    ).astype(np.uint8)

    height, width = source.shape[:2]
    candidates: list[tuple[float, int, int]] = []
    for y in range(0, height - PATCH_SIZE + 1, 12):
        for x in range(0, width - PATCH_SIZE + 1, 12):
            mask_patch = grass[y : y + PATCH_SIZE, x : x + PATCH_SIZE]
            ratio = float(mask_patch.mean())
            image_patch = source[y : y + PATCH_SIZE, x : x + PATCH_SIZE]
            gray = cv2.cvtColor(image_patch, cv2.COLOR_BGR2GRAY)
            dark_ratio = float((gray < 95).mean())
            edge_ratio = float((cv2.Canny(image_patch, 70, 130) > 0).mean())
            score = ratio - 1.8 * dark_ratio - 0.8 * max(0.0, edge_ratio - 0.08)
            if ratio > 0.92 and dark_ratio < 0.025:
                candidates.append((score, x, y))

    candidates.sort(reverse=True)
    selected: list[tuple[float, int, int]] = []
    for candidate in candidates:
        _, x, y = candidate
        if all((x - px) ** 2 + (y - py) ** 2 > 32**2 for _, px, py in selected):
            selected.append(candidate)
        if len(selected) >= 100:
            break

    if len(selected) < 12:
        raise RuntimeError(f"Not enough clean grass patches were found: {len(selected)}")

    return [
        source[y : y + PATCH_SIZE, x : x + PATCH_SIZE].astype(np.float32)
        for _, x, y in selected
    ]


def build_grass_field(source: np.ndarray) -> Image.Image:
    patches = select_grass_patches(source)
    board_width, board_height = BOARD_SIZE
    canvas = np.zeros((board_height, board_width, 3), np.float32)
    weights = np.zeros((board_height, board_width, 1), np.float32)

    axis = np.linspace(-1, 1, PATCH_SIZE)
    feather_x = np.cos(np.abs(axis) * math.pi / 2) ** 2
    feather_y = np.cos(np.abs(axis) * math.pi / 2) ** 2
    feather = (feather_y[:, None] * feather_x[None, :])[..., None].astype(np.float32)

    random.seed(RANDOM_SEED)
    for output_y in range(-24, board_height, PATCH_STEP):
        for output_x in range(-24, board_width, PATCH_STEP):
            patch = random.choice(patches).copy()
            if random.random() < 0.5:
                patch = patch[:, ::-1]
            if random.random() < 0.5:
                patch = patch[::-1, :]
            patch = np.clip(
                patch * (0.975 + random.random() * 0.05) + random.uniform(-2, 2),
                0,
                255,
            )

            x0 = max(0, output_x)
            y0 = max(0, output_y)
            x1 = min(board_width, output_x + PATCH_SIZE)
            y1 = min(board_height, output_y + PATCH_SIZE)
            patch_x = x0 - output_x
            patch_y = y0 - output_y
            local_weight = feather[
                patch_y : patch_y + y1 - y0,
                patch_x : patch_x + x1 - x0,
            ]
            canvas[y0:y1, x0:x1] += (
                patch[
                    patch_y : patch_y + y1 - y0,
                    patch_x : patch_x + x1 - x0,
                ]
                * local_weight
            )
            weights[y0:y1, x0:x1] += local_weight

    canvas /= np.maximum(weights, 1e-4)

    rng = np.random.default_rng(RANDOM_SEED)
    low_noise = cv2.GaussianBlur(
        rng.normal(size=(board_height, board_width)).astype(np.float32),
        (0, 0),
        45,
    )
    low_noise = (low_noise - low_noise.mean()) / (low_noise.std() + 1e-6)
    canvas *= 1 + low_noise[..., None] * 0.018

    fine_noise = cv2.GaussianBlur(
        rng.normal(size=(board_height, board_width)).astype(np.float32),
        (0, 0),
        0.7,
    )
    canvas += fine_noise[..., None] * 1.5
    canvas = np.clip(canvas, 0, 255).astype(np.uint8)
    canvas = cv2.bilateralFilter(canvas, 5, 10, 10)
    rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb, mode="RGB")


def tint(image: Image.Image, color: tuple[int, int, int], amount: float) -> Image.Image:
    return Image.blend(image, Image.new("RGB", image.size, color), amount)


def build_terrain_overlay(
    grass: Image.Image,
    kind: str,
    *,
    size: tuple[int, int] = (260, 180),
) -> Image.Image:
    """Create a transparent, feathered context patch.

    The patch never replaces the existing grass texture. It only applies a
    category tint, foundation/path detail and a soft ground shadow, so moving
    an asset changes the nearby terrain without leaving a rectangular texture
    stamp behind.
    """
    del grass  # The runtime field remains visible through the transparent PNG.
    width, height = size

    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(
        [
            (width * 0.50, height * 0.08),
            (width * 0.92, height * 0.47),
            (width * 0.50, height * 0.91),
            (width * 0.08, height * 0.47),
        ],
        fill=150,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(15))
    alpha = np.array(mask)
    alpha[alpha < 18] = 0
    mask = Image.fromarray(alpha, mode="L")

    tint_settings = {
        "building": (170, 160, 101, 36),
        "road": (76, 118, 57, 28),
        "rail": (118, 101, 72, 44),
        "park": (78, 161, 55, 27),
        "nature": (58, 130, 48, 24),
    }
    red, green, blue, maximum_alpha = tint_settings[kind]
    tint_alpha = np.array(mask, dtype=np.float32) * (maximum_alpha / 150.0)
    tint_alpha = np.clip(tint_alpha, 0, maximum_alpha).astype(np.uint8)
    tint_layer = Image.new("RGBA", size, (red, green, blue, 0))
    tint_layer.putalpha(Image.fromarray(tint_alpha, mode="L"))

    details = Image.new("RGBA", size, (0, 0, 0, 0))
    detail_draw = ImageDraw.Draw(details)
    if kind == "building":
        detail_draw.polygon(
            [
                (width * 0.50, height * 0.27),
                (width * 0.74, height * 0.48),
                (width * 0.50, height * 0.71),
                (width * 0.26, height * 0.48),
            ],
            fill=(173, 139, 85, 28),
        )
        detail_draw.polygon(
            [
                (width * 0.46, height * 0.63),
                (width * 0.54, height * 0.63),
                (width * 0.58, height * 0.96),
                (width * 0.42, height * 0.96),
            ],
            fill=(205, 188, 151, 42),
        )
    elif kind == "rail":
        detail_draw.polygon(
            [
                (width * 0.50, height * 0.23),
                (width * 0.82, height * 0.48),
                (width * 0.50, height * 0.77),
                (width * 0.18, height * 0.48),
            ],
            fill=(121, 105, 82, 30),
        )
    elif kind == "road":
        detail_draw.polygon(
            [
                (width * 0.50, height * 0.20),
                (width * 0.84, height * 0.48),
                (width * 0.50, height * 0.80),
                (width * 0.16, height * 0.48),
            ],
            fill=(92, 104, 67, 18),
        )
    elif kind == "park":
        detail_draw.ellipse(
            (width * 0.26, height * 0.28, width * 0.74, height * 0.76),
            fill=(116, 185, 67, 18),
        )
    else:
        detail_draw.ellipse(
            (width * 0.22, height * 0.23, width * 0.78, height * 0.79),
            fill=(58, 121, 45, 14),
        )
    details = details.filter(ImageFilter.GaussianBlur(6))

    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_strength = {
        "building": 27,
        "road": 18,
        "rail": 23,
        "park": 19,
        "nature": 15,
    }[kind]
    shadow_draw.ellipse(
        (width * 0.17, height * 0.61, width * 0.83, height * 0.91),
        fill=(39, 68, 26, shadow_strength),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))

    result = Image.alpha_composite(shadow, tint_layer)
    result = Image.alpha_composite(result, details)
    result_alpha = np.array(result.getchannel("A"))
    result_alpha[result_alpha < 5] = 0
    result.putalpha(Image.fromarray(result_alpha, mode="L"))
    return result


def write_outputs(source_path: Path, project_root: Path) -> None:
    source_bgr = cv2.imread(str(source_path), cv2.IMREAD_COLOR)
    if source_bgr is None:
        raise FileNotFoundError(source_path)

    grass = build_grass_field(source_bgr)
    shared = project_root / "shared-assets"
    windows = project_root / "windows-demo" / "assets"
    mobile = project_root / "mobile-expo" / "assets"

    for directory in (shared, windows, mobile):
        directory.mkdir(parents=True, exist_ok=True)
        grass.save(directory / "grass_field.jpg", quality=93, optimize=True)
        terrain_dir = directory / "terrain"
        terrain_dir.mkdir(parents=True, exist_ok=True)
        for kind in ("building", "road", "rail", "park", "nature"):
            build_terrain_overlay(grass, kind).save(
                terrain_dir / f"terrain_{kind}.png", optimize=True
            )

    # Keep the latest supplied reference image for the optional ghost overlay.
    reference = Image.open(source_path).convert("RGB")
    for directory in (shared, windows, mobile):
        reference.save(directory / "city_reference.jpg", quality=92, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "source",
        type=Path,
        help="Supplied completed-city image used as the visual source.",
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    args = parser.parse_args()
    write_outputs(args.source, args.project_root.resolve())


if __name__ == "__main__":
    main()
