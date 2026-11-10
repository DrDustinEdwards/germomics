#!/usr/bin/env python3
"""Trace the outline of a reference drawing into one SVG path for the figure kit.

The references are raster drawings used only to get a shape right; nothing from them is
published. This reads the subject's silhouette (everything that is not the near-white
background), traces it, simplifies it, and prints a path scaled into a box, so a kit part can
stroke it as a hairline with a tint fill.

    python3 scripts/figures/trace.py ref.png --crop 100,60,520,300 --width 160 --name rat

Options:
    --crop L,T,R,B   the part of the image to read, in pixels
    --width N        the width of the emitted path, in SVG units (height follows the aspect)
    --threshold N    how dark a pixel must be to count as subject (default 244)
    --keep N         keep the N largest shapes (default 1)
    --alpha N        potrace corner smoothing, 0 is polygonal and 1.34 is round (default 1)
    --opttolerance N potrace curve fitting tolerance; higher is simpler (default 0.6)
"""

import argparse
import sys

import numpy as np
import potrace
from PIL import Image, ImageDraw


def load_mask(path: str, crop: str | None, threshold: int, mask_out: list[str]) -> np.ndarray:
    image = Image.open(path).convert("RGBA")
    flat = Image.new("RGBA", image.size, (255, 255, 255, 255))
    flat.alpha_composite(image)
    gray = flat.convert("L")
    if crop:
        left, top, right, bottom = (int(v) for v in crop.split(","))
        gray = gray.crop((left, top, right, bottom))
    if mask_out:
        painter = ImageDraw.Draw(gray)
        for box in mask_out:
            painter.rectangle([int(v) for v in box.split(",")], fill=255)
    # potrace reads True as the subject; the references sit on a near-white background.
    return np.asarray(gray, dtype=np.uint8) < threshold


def curves_by_size(bitmap: potrace.Bitmap, alpha: float, tolerance: float):
    path = bitmap.trace(
        turdsize=12,
        alphamax=alpha,
        opticurve=1,
        opttolerance=tolerance,
    )
    curves = list(path)
    curves.sort(key=lambda curve: abs(area(curve)), reverse=True)
    return curves


def area(curve) -> float:
    points = [curve.start_point] + [segment.end_point for segment in curve]
    xs = [p.x for p in points]
    ys = [p.y for p in points]
    total = 0.0
    for i in range(len(points)):
        j = (i + 1) % len(points)
        total += xs[i] * ys[j] - xs[j] * ys[i]
    return total / 2


def emit(curves, scale: float, offset: tuple[float, float]) -> str:
    ox, oy = offset

    def pt(point) -> str:
        return f"{(point.x - ox) * scale:.1f} {(point.y - oy) * scale:.1f}"

    out = []
    for curve in curves:
        out.append(f"M{pt(curve.start_point)}")
        for segment in curve:
            if segment.is_corner:
                out.append(f"L{pt(segment.c)}L{pt(segment.end_point)}")
            else:
                out.append(f"C{pt(segment.c1)} {pt(segment.c2)} {pt(segment.end_point)}")
        out.append("Z")
    return "".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image")
    parser.add_argument("--crop")
    parser.add_argument("--width", type=float, default=160)
    parser.add_argument("--threshold", type=int, default=244)
    parser.add_argument("--keep", type=int, default=1)
    parser.add_argument("--alpha", type=float, default=1.0)
    parser.add_argument("--opttolerance", type=float, default=0.6)
    parser.add_argument("--name", default="shape")
    parser.add_argument(
        "--mask-out",
        action="append",
        default=[],
        metavar="L,T,R,B",
        help="paint this box of the crop white first, to drop an arrow or a label",
    )
    parser.add_argument("--box", help="L,T,R,B in crop pixels to scale against, for a matched set")
    args = parser.parse_args()

    mask = load_mask(args.image, args.crop, args.threshold, args.mask_out)
    if not mask.any():
        print("nothing above the threshold in that crop", file=sys.stderr)
        return 1

    curves = curves_by_size(potrace.Bitmap(~mask), args.alpha, args.opttolerance)[: args.keep]
    points = [curve.start_point for curve in curves] + [
        segment.end_point for curve in curves for segment in curve
    ]
    if args.box:
        x0, y0, x1, y1 = (float(v) for v in args.box.split(","))
    else:
        x0 = min(point.x for point in points)
        y0 = min(point.y for point in points)
        x1 = max(point.x for point in points)
        y1 = max(point.y for point in points)
    scale = args.width / (x1 - x0)

    print(f"// {args.name}: traced from {args.image}, {args.width:.0f} x {(y1 - y0) * scale:.0f}")
    print(f'const {args.name} = "{emit(curves, scale, (x0, y0))}";')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
