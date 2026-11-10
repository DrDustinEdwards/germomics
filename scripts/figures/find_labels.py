#!/usr/bin/env python3
"""Find the lettering in a reference drawing and print it as --blank boxes.

The tracer has no idea what a letter is: it traces a word as a row of broken glyph shapes, which
cannot be selected, searched or read aloud, and which fall apart at any other size. So a figure's
text is painted out before tracing and set again as real <text>. This finds the boxes to paint.

A letter is a small dark blob, and a line of text is several of them of about one height sitting on
one baseline. Anything that is alone, or far taller or wider than its neighbours, is drawing.

    python3 scripts/figures/find_labels.py ref.png
    python3 scripts/figures/find_labels.py ref.png --crops   # also writes a picture of each box

Options:
    --dark N      a pixel counts as ink below this grey, 0 to 255 (default 120)
    --min N       the shortest glyph to keep, in pixels (default 7)
    --max N       the tallest (default 30)
    --run N       how many glyphs a line needs before it counts as text (default 3)
    --pad N       pixels added around each box (default 3)
    --crops       write <name>-label-<n>.png for each box, to check by eye
"""

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def glyphs(image: Image.Image, args) -> list[tuple[int, int, int, int]]:
    ink = np.array(image.convert("L")) < args.dark
    labels, count = ndimage.label(ink)
    found = []
    for top, left in ndimage.find_objects(labels):
        height, width = top.stop - top.start, left.stop - left.start
        if not args.min <= height <= args.max or width > args.max * 2:
            continue
        # A letter is mostly ink inside its own box; a hairline that happens to be short is not.
        patch = ink[top, left]
        if patch.mean() < 0.12:
            continue
        found.append((left.start, top.start, left.stop, top.stop))
    return found


def lines(boxes: list[tuple[int, int, int, int]], args) -> list[tuple[int, int, int, int]]:
    """Group the glyphs that share a baseline and sit next to each other."""
    rows: list[list[tuple[int, int, int, int]]] = []
    for box in sorted(boxes, key=lambda b: (b[3], b[0])):
        for row in rows:
            last = row[-1]
            overlap = min(box[3], last[3]) - max(box[1], last[1])
            tall = max(box[3] - box[1], last[3] - last[1])
            if overlap > 0.5 * tall and 0 <= box[0] - last[2] <= 2.5 * tall:
                row.append(box)
                break
        else:
            rows.append([box])
    out = []
    for row in rows:
        if len(row) < args.run:
            continue
        out.append(
            (
                min(b[0] for b in row) - args.pad,
                min(b[1] for b in row) - args.pad,
                max(b[2] for b in row) + args.pad,
                max(b[3] for b in row) + args.pad,
            )
        )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image")
    parser.add_argument("--dark", type=int, default=120)
    parser.add_argument("--min", type=int, default=7)
    parser.add_argument("--max", type=int, default=30)
    parser.add_argument("--run", type=int, default=3)
    parser.add_argument("--pad", type=int, default=3)
    parser.add_argument("--crops", action="store_true")
    args = parser.parse_args()

    path = Path(args.image)
    picture = Image.open(path).convert("RGB")
    boxes = lines(glyphs(picture, args), args)
    if not boxes:
        print("no lettering found", file=sys.stderr)
        return 1
    for index, (left, top, right, bottom) in enumerate(boxes, 1):
        print(f"  --blank {left},{top},{right},{bottom}")
        if args.crops:
            crop = path.with_name(f"{path.stem}-label-{index}.png")
            picture.crop((left, top, right, bottom)).save(crop)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
