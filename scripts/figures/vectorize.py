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
    --tint L,T,R,B   paint this region in brand, whatever its color: the figure's subject
    --grey L,T,R,B   paint this region in the neutral, whatever its color
    --ink L,T,R,B    in this region every thin shape is ink, whatever its tone
    --cut L,T,R,B    drop every path that fits whole inside this region
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
COORD = re.compile(r"(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)")
TRANSLATE = re.compile(r"translate\((-?[\d.]+),(-?[\d.]+)\)")


def extent(path: str) -> tuple[float, float, float, float]:
    """The path's bounding box, read straight from its coordinates and its translate."""
    data = re.search(r' d="([^"]*)"', path)
    if not data:
        return (0.0, 0.0, 0.0, 0.0)
    points = [(float(a), float(b)) for a, b in COORD.findall(data.group(1))]
    if not points:
        return (0.0, 0.0, 0.0, 0.0)
    move = TRANSLATE.search(path)
    dx, dy = (float(move.group(1)), float(move.group(2))) if move else (0.0, 0.0)
    xs = [x + dx for x, _ in points]
    ys = [y + dy for _, y in points]
    return (min(xs), min(ys), max(xs), max(ys))


# Three flat steps per token, mixed with the page rather than laid over it. A stack of
# translucent fills turns every overlap to mud; a solid color from this ladder cannot.
# The figure shade ladders in app/app.css: Capsomer's own 12-step scales, 1 palest to 12 deepest.
# Purple is anything with a color of its own: tissue, bodies, fur and skin. Cerulean is water and
# fluids. The neutral is line work, stone, soil and anything grey in the drawing. Purple, cyan and
# grey are all a figure uses. Steps 1 and 2 are page backgrounds in a Radix-style scale and 12 is text, so a drawing
# uses 3 to 11 for its regions and keeps 12 for its line work: that way nothing in it can vanish
# into the page in either theme.
FAMILIES = {"brand": "v", "accent": "c", "neutral": "n"}
FIRST_STEP = 7
LAST_STEP = 11


def token(color: str) -> str:
    """The figure shade for one of the drawing's colors.

    The reference draws with hue: blue is water, every other color is something living, a grey is
    grey, and near-black is its line work. Each picks a family, and the color's own lightness picks
    the step on that family's scale, so the drawing keeps the depth it was drawn with.
    """
    import colorsys

    r, g, b = (int(color[i : i + 2], 16) / 255 for i in (1, 3, 5))
    hue, light, saturation = colorsys.rgb_to_hls(r, g, b)
    degrees = hue * 360
    # The line work is the deepest step, which is near-black on a light page and near-white on a
    # dark one, so a drawn edge stays an edge in both themes.
    if light < 0.2:
        return "var(--fig-n12)"
    if saturation < 0.12:
        family = "neutral"
    elif 170 <= degrees <= 265:
        family = "accent"
    elif degrees <= 60 or degrees >= 340:
        # Every warm color in these references is a material: brown fur, a pink tail, tan skin,
        # soil, bone. A material is grey, and --tint says which of those regions is the subject.
        family = "neutral"
    else:
        family = "brand"
    span = LAST_STEP - FIRST_STEP
    step = FIRST_STEP + round((1 - min(max(light, 0.1), 0.95)) / 0.85 * span)
    return f"var(--fig-{FAMILIES[family]}{min(LAST_STEP, max(FIRST_STEP, step))})"


def area(path: str) -> float:
    """How much of its own bounding box a path actually fills.

    The tracer gives line work as a region: a stroke comes back as a long thin outline, and stroking
    that outline again draws the line twice, as a tube. A thin region is ink and is filled; a fat one
    is a surface and is stroked.
    """
    data = re.search(r' d="([^"]*)"', path)
    if not data:
        return 0.0
    points = [(float(a), float(b)) for a, b in COORD.findall(data.group(1))]
    if len(points) < 3:
        return 0.0
    total = 0.0
    for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]):
        total += x0 * y1 - x1 * y0
    return abs(total) / 2


def subpaths(path: str) -> list[str]:
    """One path element per closed shape.

    The tracer writes a whole color layer as a single path: the person and the inset box beside them
    come out as one element, so a region can be neither cut nor recolored on its own. Splitting on
    the move commands gives back the shapes the drawing actually has.
    """
    data = re.search(r' d="([^"]*)"', path)
    if not data:
        return [path]
    pieces = [piece for piece in data.group(1).split("M") if piece.strip()]
    if len(pieces) < 2:
        return [path]
    return [path.replace(data.group(0), f' d="M{piece}"') for piece in pieces]


def middle(box: tuple[float, float, float, float]) -> tuple[float, float]:
    left, top, right, bottom = box
    return ((left + right) / 2, (top + bottom) / 2)


def inside(point: tuple[float, float], boxes: list[str], scale: float) -> bool:
    """Whether a path's middle falls in one of the boxes, which are given in the image's own pixels."""
    x, y = point
    for box in boxes:
        left, top, right, bottom = (float(v) * scale for v in box.split(","))
        if left <= x <= right and top <= y <= bottom:
            return True
    return False


def within(box: tuple[float, float, float, float], boxes: list[str], scale: float) -> bool:
    """Whether a path fits whole inside one of the regions.

    A cut asks for the thing in a region, not for whatever reaches into it: an inset's frame and its
    leader lines sit entirely in the corner, while the body they point at runs out of it and stays.
    """
    left, top, right, bottom = box
    for region in boxes:
        x0, y0, x1, y1 = (float(v) * scale for v in region.split(","))
        if x0 <= left and top >= y0 and right <= x1 and bottom <= y1:
            return True
    return False


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
    parser.add_argument(
        "--tint",
        action="append",
        default=[],
        metavar="L,T,R,B",
        help="paint this region of the drawing in brand: what the figure is about, such as the "
        "organ it names or the organism in the water; repeatable",
    )
    parser.add_argument(
        "--grey",
        action="append",
        default=[],
        metavar="L,T,R,B",
        help="paint this region in the neutral whatever its color; repeatable",
    )
    parser.add_argument(
        "--ink",
        action="append",
        default=[],
        metavar="L,T,R,B",
        help="in this region every thin shape is ink, whatever its tone: an arrow the reference drew "
        "with a gradient comes back in halves, and half an arrow is not an arrow; repeatable",
    )
    parser.add_argument(
        "--cut",
        action="append",
        default=[],
        metavar="L,T,R,B",
        help="drop every path that fits whole inside this region, such as an inset and its "
        "leader lines; repeatable",
    )
    parser.add_argument("--palette", action="store_true")
    parser.add_argument(
        "--outline",
        type=float,
        nargs="?",
        const=0.0015,
        default=0,
        metavar="SHARE",
        help="give every region bigger than this share of the canvas a hairline ink outline",
    )
    parser.add_argument(
        "--hairline",
        action="store_true",
        help="draw the trace as line art: every region filled with the page and told apart by its "
        "stroke, after Hairline's rules 04, 06 and 09 (github.com/lucasmarkes/hairline)",
    )
    parser.add_argument(
        "--map",
        action="store_true",
        help="rewrite every fill onto the site's tokens: the line work as ink, water as accent, "
        "tissue as brand, fur and soil as muted, each at a flat opacity from its lightness",
    )
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
    canvas = float(width) * float(height)
    for whole in PATH.findall(traced):
        for path in subpaths(whole):
            color = HEX.search(path)
            if not color:
                continue
            if luminance(color.group(1)) > args.drop_pale:
                # A pale path is either the page itself or one of the tracer's antialiasing halos:
                # the page covers most of the canvas, a halo covers almost none, and a pale part of the
                # drawing, such as skin, sits between the two and is kept.
                left, top, right, bottom = extent(path)
                share = ((right - left) * (bottom - top)) / canvas if canvas else 0
                if share > 0.5 or share < 0.004:
                    continue
            box = extent(path)
            here = middle(box)
            if args.cut and within(box, args.cut, args.scale):
                continue
            fills[color.group(1)] += 1
            shape = NUMBER.sub(lambda m: f"{float(m.group(0)):.{args.precision}f}", path)
            if args.map:
                fill = token(color.group(1))
                # The line work keeps its ink in every region; only a region's fill changes family.
                if fill != "var(--fig-n12)":
                    # A region counts as in the box only when it fits inside it: the kidney is the
                    # subject, the rat it sits in is not, and the rat's own outline runs out of the box.
                    if within(box, args.tint, args.scale):
                        fill = re.sub(r"--fig-[cn]", "--fig-v", fill)
                    elif within(box, args.grey, args.scale):
                        fill = re.sub(r"--fig-[vc]", "--fig-n", fill)
                shape = HEX.sub(f'fill="{fill}"', shape)
            if args.hairline:
                # Hairline's rule 06: a solid is opaque, filled with the ground colour, so a near
                # shape hides the far one instead of mixing with it. Rule 04: the stroke is the
                # only highlight, so nothing here carries a coloured fill. Rule 09: bright outside,
                # dim inside, which is most of the polish.
                left, top, right, bottom = extent(shape)
                hull = (right - left) * (bottom - top)
                thin = bool(hull) and area(shape) / hull < 0.5
                marked = within(box, args.ink, args.scale)
                if "fig-n12" in shape or marked or (thin and luminance(color.group(1)) < 80):
                    # Ink: an arrow or a drawn edge, which the reference drew in near-black and the
                    # tracer gave back as a long thin region. It is filled and never stroked, or the
                    # stroke would draw the same line twice, as a tube. Everything paler than ink is
                    # a surface, however thin it is: a crescent of shadow, a worm, a shoreline.
                    # Inside an --ink region every shape is ink, so a gradient arrow the tracer split
                    # into a dark half and a pale one comes back whole.
                    shape = re.sub(r'fill="[^"]*"', 'fill="var(--fig-n12)"', shape)
                else:
                    line = re.search(r'fill="var\(--fig-([vcn])', shape)
                    family = line.group(1) if line else "n"
                    edge = (
                        f"--fig-{family}9"
                        if family != "n"
                        else ("--fig-n11" if hull > 0.004 * canvas else "--fig-n9")
                    )
                    shape = re.sub(r'fill="[^"]*"', 'fill="var(--bg)"', shape)
                    shape = shape.replace(
                        "/>",
                        f'stroke="var({edge})" stroke-width="0.9" vector-effect="non-scaling-stroke" '
                        'stroke-linejoin="round" stroke-linecap="round"/>',
                    )
                kept.append(shape)
                continue
            if args.outline:
                # A flat drawing reads by its edges, so every region that is not the line work itself
                # gets the same hairline in ink.
                left, top, right, bottom = extent(shape)
                if (right - left) * (bottom - top) > args.outline * canvas and "fig-n12" not in shape:
                    shape = shape.replace(
                        "/>",
                        'stroke="var(--fig-n12)" stroke-width="1" '
                        'vector-effect="non-scaling-stroke" stroke-opacity="0.7"/>',
                    )
            kept.append(shape)

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
