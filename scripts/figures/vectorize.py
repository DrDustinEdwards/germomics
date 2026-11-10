#!/usr/bin/env python3
"""Turn a reference drawing into real SVG paths.

The references are raster. This traces them by color, with every color region becoming its own
spline path, which is what a vector editor's image trace does and what the earlier greyscale
posterize in trace_layers.py could never do. What comes out is the same drawing as vectors: it
scales, it carries no pixels, and its fills can be mapped onto the site's own tokens.

    python3 scripts/figures/vectorize.py ref.png --out art.svg
    python3 scripts/figures/vectorize.py ref.png --out art.svg --blank 120,300,420,340 --palette

Labels are traced as glyph shapes unless their boxes are blanked first, so a figure's text is
blanked here and set as real <text> by the figure that uses it: selectable, in the site's font and
read aloud by a screen reader.

Options:
    --out PATH       where to write the SVG (default: the image's name with .svg)
    --scale N        trace at N times the image's size, for smoother curves (default 2)
    --colors N       color precision, 1 to 8; higher keeps more tones and more paths (default 6)
    --speckle N      drop a traced region smaller than N pixels (default 6)
    --layer N        how far two colors must differ to become separate layers (default 12)
    --precision N    decimal places kept in the path data (default 1)
    --drop-pale N    drop a path whose fill is paler than this luminance, 0 to 255 (default 240)
    --blank L,T,R,B  paint this box of the image white before tracing; repeatable
    --palette        print the fills that survived, most used first, for mapping to site tokens
"""

import argparse
import re
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

HEX = re.compile(r'fill="(#[0-9A-Fa-f]{6})"')
PATH = re.compile(r"<path [^>]*/>")
NUMBER = re.compile(r"-?\d+\.\d+")


def luminance(color: str) -> float:
    r, g, b = (int(color[i : i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def prepare(image: Path, scale: float, blanks: list[str]) -> Path:
    from PIL import Image, ImageDraw

    picture = Image.open(image).convert("RGB")
    if blanks:
        painter = ImageDraw.Draw(picture)
        for box in blanks:
            painter.rectangle([int(v) for v in box.split(",")], fill=(255, 255, 255))
    if scale != 1:
        picture = picture.resize(
            (round(picture.width * scale), round(picture.height * scale)), Image.LANCZOS
        )
    out = Path(tempfile.mkdtemp()) / "prepared.png"
    picture.save(out)
    return out


def trace(prepared: Path, args) -> str:
    import vtracer

    out = prepared.with_suffix(".svg")
    vtracer.convert_image_to_svg_py(
        str(prepared),
        str(out),
        colormode="color",
        hierarchical="stacked",
        mode="spline",
        filter_speckle=args.speckle,
        color_precision=args.colors,
        layer_difference=args.layer,
        corner_threshold=60,
        length_threshold=4.0,
        splice_threshold=45,
        path_precision=2,
    )
    return out.read_text()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image")
    parser.add_argument("--out")
    parser.add_argument("--scale", type=float, default=2)
    parser.add_argument("--colors", type=int, default=6)
    parser.add_argument("--speckle", type=int, default=6)
    parser.add_argument("--layer", type=int, default=12)
    parser.add_argument("--precision", type=int, default=1)
    parser.add_argument("--drop-pale", type=float, default=240)
    parser.add_argument("--blank", action="append", default=[], metavar="L,T,R,B")
    parser.add_argument("--palette", action="store_true")
    args = parser.parse_args()

    image = Path(args.image)
    out = Path(args.out) if args.out else image.with_suffix(".svg")

    traced = trace(prepare(image, args.scale, args.blank), args)
    size = re.search(r'width="(\d+)" height="(\d+)"', traced)
    if not size:
        print("vtracer wrote no size", file=sys.stderr)
        return 1
    width, height = (int(v) for v in size.groups())

    kept, fills = [], Counter()
    for path in PATH.findall(traced):
        color = HEX.search(path)
        # A path paler than the page is the tracer's own antialiasing halo, not part of the drawing.
        if not color or luminance(color.group(1)) > args.drop_pale:
            continue
        fills[color.group(1)] += 1
        kept.append(NUMBER.sub(lambda m: f"{float(m.group(0)):.{args.precision}f}", path))

    if not kept:
        print("every traced path was paler than --drop-pale", file=sys.stderr)
        return 1

    out.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">\n'
        + "\n".join(kept)
        + "\n</svg>\n"
    )
    print(f"{out}: {len(kept)} paths, {out.stat().st_size // 1024} KB, {width} x {height}")
    if args.palette:
        for color, count in fills.most_common():
            print(f"  {color}  {count:4d} paths  luminance {luminance(color):.0f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
