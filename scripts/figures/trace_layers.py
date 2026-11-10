#!/usr/bin/env python3
"""Turn a region of a reference drawing into a stack of SVG paths, one per tone.

trace.py reads a subject's outline. This reads the drawing itself: it reduces the crop to a few
tones, traces each tone as its own region, and prints the regions from the palest to the darkest,
so a kit part can stack them and restyle each one flat. That keeps the reference's anatomy (the
ear, the limbs, the hilum of a kidney, the folds of a brain) instead of approximating it from the
silhouette alone.

    python3 scripts/figures/trace_layers.py ref.png --crop 90,140,318,258 --width 130 --tones 4

Options:
    --crop L,T,R,B   the part of the image to read, in pixels
    --width N        the width of the emitted paths, in SVG units (height follows the aspect)
    --tones N        how many tones to split the drawing into, background aside (default 4)
    --background N   a pixel paler than this counts as background (default 244)
    --min-area N     drop a region smaller than this share of the crop (default 0.004)
    --opttolerance N potrace curve fitting tolerance; higher is simpler (default 0.8)
    --mask-out L,T,R,B  paint this box of the crop as background first, to drop an arrow or label
"""

import argparse
import sys

import numpy as np
import potrace
from PIL import Image, ImageDraw


def load(path: str, crop: str | None, mask_out: list[str], patch: list[str] = ()) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    flat = Image.new("RGBA", image.size, (255, 255, 255, 255))
    flat.alpha_composite(image)
    out = flat.convert("L")
    if crop:
        left, top, right, bottom = (int(v) for v in crop.split(","))
        out = out.crop((left, top, right, bottom))
    if mask_out:
        painter = ImageDraw.Draw(out)
        for box in mask_out:
            painter.rectangle([int(v) for v in box.split(",")], fill=255)
    # A patch hides something drawn over the subject (a callout arrow, a label) by filling its box
    # with the median tone of the box's own border, so no notch appears in the traced regions.
    if patch:
        pixels = np.asarray(out, dtype=np.uint8).copy()
        painter = ImageDraw.Draw(out)
        for box in patch:
            left, top, right, bottom = (int(v) for v in box.split(","))
            edge = np.concatenate(
                [
                    pixels[max(top - 2, 0) : top, left:right].ravel(),
                    pixels[bottom : bottom + 2, left:right].ravel(),
                    pixels[top:bottom, max(left - 2, 0) : left].ravel(),
                    pixels[top:bottom, right : right + 2].ravel(),
                ]
            )
            fill = int(np.median(edge)) if edge.size else 255
            painter.rectangle([left, top, right, bottom], fill=fill)
    return out


def tone_masks(gray: np.ndarray, tones: int, background: int) -> list[tuple[int, np.ndarray]]:
    """Split the subject into `tones` bands by lightness, palest first.

    Each band is cumulative: the band at a given darkness covers everything at least that dark, so
    the paths stack like layers of paint and no seam shows between them.
    """
    subject = gray[gray < background]
    if subject.size == 0:
        return []
    edges = np.quantile(subject, np.linspace(0, 1, tones + 1))
    out = []
    for i in range(tones):
        cut = int(round(edges[i + 1])) if i + 1 < tones else background
        mask = gray < min(cut, background)
        if mask.any():
            out.append((int(round(edges[i])), mask))
    return out


def trace(mask: np.ndarray, tolerance: float, min_area: float):
    path = potrace.Bitmap(~mask).trace(turdsize=8, alphamax=1.0, opticurve=1, opttolerance=tolerance)
    limit = min_area * mask.shape[0] * mask.shape[1]
    return [curve for curve in path if abs(area(curve)) >= limit]


def area(curve) -> float:
    points = [curve.start_point] + [segment.end_point for segment in curve]
    total = 0.0
    for i, p in enumerate(points):
        q = points[(i + 1) % len(points)]
        total += p.x * q.y - q.x * p.y
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
    parser.add_argument("--tones", type=int, default=4)
    parser.add_argument("--background", type=int, default=244)
    parser.add_argument("--min-area", type=float, default=0.004)
    parser.add_argument("--opttolerance", type=float, default=0.8)
    parser.add_argument("--name", default="shape")
    parser.add_argument("--mask-out", action="append", default=[], metavar="L,T,R,B")
    parser.add_argument(
        "--patch",
        action="append",
        default=[],
        metavar="L,T,R,B",
        help="fill this box with its border's own tone, to hide a callout drawn over the subject",
    )
    args = parser.parse_args()

    gray = np.asarray(load(args.image, args.crop, args.mask_out, args.patch), dtype=np.uint8)
    bands = tone_masks(gray, args.tones, args.background)
    if not bands:
        print("nothing darker than the background in that crop", file=sys.stderr)
        return 1

    # Every band is scaled against the palest band's box, so the layers line up when stacked.
    base = trace(bands[0][1], args.opttolerance, args.min_area)
    if not base:
        print("the palest band traced to nothing; try a larger --min-area crop", file=sys.stderr)
        return 1
    points = [c.start_point for c in base] + [s.end_point for c in base for s in c]
    x0 = min(p.x for p in points)
    y0 = min(p.y for p in points)
    x1 = max(p.x for p in points)
    y1 = max(p.y for p in points)
    scale = args.width / (x1 - x0)

    print(f"// {args.name}: {args.width:.0f} x {(y1 - y0) * scale:.0f}, {len(bands)} tones from {args.image}")
    # Emitted in draw order: the whole silhouette first, each darker region stacked on top of it.
    layers = []
    for i, (tone, mask) in enumerate(bands):
        curves = base if i == 0 else trace(mask, args.opttolerance, args.min_area)
        if curves:
            layers.append((tone, emit(curves, scale, (x0, y0))))
    print(f"const {args.name} = [")
    for tone, d in reversed(layers):
        print(f"  // tone {tone} of 255")
        print(f'  "{d}",')
    print("];")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
