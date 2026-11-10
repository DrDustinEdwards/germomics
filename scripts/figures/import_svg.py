#!/usr/bin/env python3
"""Turn real vector artwork into a flat part for the figure kit.

Give it an SVG (or a vector PDF, which it converts with pdftocairo first) and it reads the shapes
as geometry: every element becomes a path with its transforms applied, scaled into a box, with the
artwork's own fills, gradients, strokes and effects dropped. What comes out is the drawing's
anatomy as plain paths, grouped from the palest original fill to the darkest, for a kit part to
stroke as a hairline over the palette's tints.

    python3 scripts/figures/import_svg.py rat.svg --width 130 --name rat
    python3 scripts/figures/import_svg.py figure.pdf --width 130 --name rat --groups 3

It refuses a file whose drawing is really a raster: an <image> is not vector art and tracing it is
the wrong job (scripts/figures/trace.py and trace_layers.py do that, badly, by design).

Options:
    --width N     the width of the emitted paths, in SVG units (height follows the aspect)
    --groups N    how many tone groups to sort the paths into, palest first (default 3)
    --min-area N  drop a path smaller than this share of the whole drawing (default 0.0008)
    --precision N decimal places to keep (default 1)
    --keep-tiny   keep every path, however small
"""

import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path as FilePath

from svgelements import SVG, Color, Group, Image, Path, Shape, Use

# A path with this many points is detail nobody sees at figure size; it is simplified by dropping
# every other point, which potrace-style curves survive without a visible change.
BUSY = 400


def to_svg(source: FilePath) -> FilePath:
    """A PDF becomes an SVG first; pdftocairo keeps the vectors as vectors."""
    if source.suffix.lower() != ".pdf":
        return source
    out = FilePath(tempfile.mkdtemp()) / (source.stem + ".svg")
    subprocess.run(
        ["pdftocairo", "-svg", "-f", "1", "-l", "1", str(source), str(out)],
        check=True,
        capture_output=True,
    )
    return out


def shapes(node):
    """Every drawable shape in the tree, with its transforms already applied."""
    if isinstance(node, (Group, SVG, Use)):
        for child in node:
            yield from shapes(child)
    elif isinstance(node, Image):
        yield node
    elif isinstance(node, Shape):
        yield node


def luminance(shape) -> float:
    """How dark the artwork drew this shape, so the paths can be grouped by tone."""
    paint = getattr(shape, "fill", None)
    if paint is None or not isinstance(paint, Color) or paint.value is None:
        paint = getattr(shape, "stroke", None)
    if paint is None or not isinstance(paint, Color) or paint.value is None:
        return 1.0
    try:
        return (0.2126 * paint.red + 0.7152 * paint.green + 0.0722 * paint.blue) / 255
    except (TypeError, AttributeError):
        return 1.0


def round_path(d: str, places: int) -> str:
    """Figure coordinates are read at 680 units wide; more than a decimal is noise in the file."""
    return re.sub(r"-?\d+\.\d+", lambda m: f"{float(m.group(0)):.{places}f}", d)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("--width", type=float, default=130)
    parser.add_argument("--groups", type=int, default=3)
    parser.add_argument("--min-area", type=float, default=0.0008)
    parser.add_argument("--precision", type=int, default=1)
    parser.add_argument("--keep-tiny", action="store_true")
    parser.add_argument("--name", default="shape")
    args = parser.parse_args()

    source = to_svg(FilePath(args.source))
    svg = SVG.parse(str(source), reify=True, ppi=96.0)

    found = list(shapes(svg))
    rasters = [s for s in found if isinstance(s, Image)]
    drawings = [s for s in found if not isinstance(s, Image)]
    if rasters and not drawings:
        print(
            f"{args.source} draws with {len(rasters)} raster image(s) and no vector shapes: "
            "there is no vector art in it to restyle.",
            file=sys.stderr,
        )
        return 1
    if rasters:
        print(f"// note: {len(rasters)} raster image(s) in the source were dropped", file=sys.stderr)

    paths = []
    for shape in drawings:
        try:
            path = Path(shape) if not isinstance(shape, Path) else shape
            d = path.d()
        except Exception:  # a shape svgelements cannot reduce is not worth guessing at
            continue
        if not d or len(d) < 8:
            continue
        box = path.bbox()
        if box is None:
            continue
        paths.append((luminance(shape), box, d))

    if not paths:
        print("no usable shapes in that file", file=sys.stderr)
        return 1

    x0 = min(b[0] for _, b, _ in paths)
    y0 = min(b[1] for _, b, _ in paths)
    x1 = max(b[2] for _, b, _ in paths)
    y1 = max(b[3] for _, b, _ in paths)
    whole = (x1 - x0) * (y1 - y0)
    if not args.keep_tiny:
        paths = [p for p in paths if (p[1][2] - p[1][0]) * (p[1][3] - p[1][1]) >= args.min_area * whole]
        if not paths:
            print("every shape fell under --min-area", file=sys.stderr)
            return 1

    scale = args.width / (x1 - x0)
    height = (y1 - y0) * scale

    # Palest first, so the groups stack the way the drawing was painted.
    paths.sort(key=lambda p: -p[0])
    per = max(1, round(len(paths) / args.groups))

    print(f"// {args.name}: {args.width:.0f} x {height:.0f}, {len(paths)} paths from {args.source}")
    print(f"const {args.name} = [")
    for start in range(0, len(paths), per):
        chunk = paths[start : start + per]
        moved = []
        for _, _, d in chunk:
            path = Path(d) * f"translate({-x0} {-y0}) scale({scale})"
            moved.append(round_path(path.d(transformed=True), args.precision))
        print(f"  // group {start // per + 1}: {len(chunk)} paths")
        print('  "' + "".join(moved).replace('"', "") + '",')
    print("];")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
