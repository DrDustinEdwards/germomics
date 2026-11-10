#!/usr/bin/env python3
"""Build the essay figures in public/blog-diagrams/ from the references.

Each figure is one entry in figures.json: the reference to trace, the options that say what the
figure is about, and its labels, title, description and sources. The drawing is traced by
vectorize.py in --hairline mode; the labels are real <text>, so they are selectable, scale, and are
read aloud. Everything here is regenerable: change the entry, run this, commit the result.

    python3 scripts/figures/build_figures.py            # every figure
    python3 scripts/figures/build_figures.py hell-on-weils

The reference drawings are not in this repository (they are licensed stock), so this needs them at
--refs, which defaults to the shared folder they live in.
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
TRACE = [
    "--colors", "6", "--map", "--hairline", "--scale", "1", "--precision", "0", "--speckle", "12",
]


def place(items: list) -> tuple[str, list[tuple[float, float, float, float]]]:
    """Put the library's parts where the figure says, and report the boxes they fill.

    A part is traced once, by hand, with its own crop and its own options, and then any figure that
    needs it places it. Which part is the figure's subject is said here, so the pixel rectangles
    that used to say "the kidney is at 258,150,316,238" are gone.
    """
    drawn, boxes = [], []
    for item in items:
        part = json.loads((HERE / "parts" / f"{item['part']}.json").read_text())
        # A part remembers where it sat in its reference, so a figure that keeps that layout says
        # nothing; one that moves the part says "at".
        x, y = item.get("at", part.get("origin", [0, 0]))
        size = item.get("scale", 1)
        shapes = []
        for shape in part["shapes"]:
            role = shape["role"]
            if item.get("subject") and role in ("fig", "fig in"):
                role = f"{role} v" if role == "fig" else "fig v"
            at = shape["at"]
            shapes.append(
                f'<path class="{role}" d="{shape["d"]}" transform="translate({at[0]},{at[1]})"/>'
            )
        move = f"translate({x},{y})" + (f" scale({size})" if size != 1 else "")
        drawn.append(f'<g transform="{move}">\n        ' + "\n        ".join(shapes) + "\n      </g>")
        boxes.append((x, y, x + part["width"] * size, y + part["height"] * size))
    return "\n      ".join(drawn), boxes


def frame(paths: str, rows: list, width: int, height: int) -> tuple[int, int, int, int]:
    """The box the drawing and its labels actually occupy, so the figure is not mostly margin.

    A reference is drawn on a 1024 by 572 card with whatever space its own layout left. On the page
    the figure is as wide as the column, so that space becomes a band of nothing above and below it.
    """
    sys.path.insert(0, str(HERE))
    from vectorize import PATH, extent

    boxes = [extent(path) for path in PATH.findall(paths)] if paths else []
    for x, y, text, kind, anchor in rows:
        size = 20 if kind == "label" else 19
        # Text has no geometry here, so it is measured as an em box: a little wide, which is the
        # safe way to be wrong.
        run = len(re.sub(r"<[^>]*>", "", text)) * size * 0.58
        left = x - run / 2 if anchor == "middle" else x
        boxes.append((left, y - size, left + run, y + size * 0.25))
    pad = 14
    return (
        max(0, round(min(b[0] for b in boxes) - pad)),
        max(0, round(min(b[1] for b in boxes) - pad)),
        min(width, round(max(b[2] for b in boxes) + pad)),
        min(height, round(max(b[3] for b in boxes) + pad)),
    )


def labels(rows: list) -> str:
    out = []
    for x, y, text, kind, anchor in rows:
        where = f' text-anchor="{anchor}"' if anchor else ""
        out.append(f'<text class="fig-{kind}" x="{x}" y="{y}"{where}>{text}</text>')
    return "\n      ".join(out)


def build(name: str, spec: dict, refs: Path) -> None:
    if "parts" in spec:
        return compose(name, spec)
    source = refs / f"{spec['source']}.png"
    if not source.exists():
        raise SystemExit(f"{source} is missing: pass --refs with the folder holding the references")

    # find_labels prints one "--blank l,t,r,b" per line of lettering it found. It is looking for
    # runs of small dark blobs, and a drawing sometimes has one: a row of lipid heads reads as a
    # word. "skip" drops those boxes by their 1-based place in its output.
    boxes = subprocess.run(
        [sys.executable, str(HERE / "find_labels.py"), str(source)],
        check=True, capture_output=True, text=True,
    ).stdout.split("\n")
    boxes = [line.split()[1] for line in boxes if line.strip()]
    skip = set(spec.get("skip", []))
    found = []
    for index, box in enumerate(boxes, 1):
        if index not in skip:
            found += ["--blank", box]

    art = Path(tempfile.mkdtemp()) / f"{name}.svg"
    subprocess.run(
        [sys.executable, str(HERE / "vectorize.py"), str(source), "--out", str(art)]
        + TRACE + found + spec.get("trace", []),
        check=True, capture_output=True, text=True,
    )
    paths = "\n      ".join(re.findall(r"<path [^>]*/>", art.read_text()))

    write(name, spec, paths, frame(paths, spec["labels"], 1024, 572))


def write(name: str, spec: dict, paths: str, box: tuple[int, int, int, int]) -> None:
    """The figure's file: the drawing, its labels, and what it says it is."""
    left, top, right, bottom = box
    view = f"{left} {top} {right - left} {bottom - top}"
    desc = spec["desc"]
    out = REPO / "public" / "blog-diagrams" / f"{name}.html"
    out.write_text(
        f'<div class="blog-diagram-block">\n'
        f'  <figure class="blog-diagram" role="img" aria-label="{desc}">\n'
        f'    <svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" width="{right - left}" height="{bottom - top}">\n'
        f'      <title>{spec["title"]}</title>\n'
        f'      <desc>{desc}</desc>\n'
        f'      {paths}\n'
        f'      {labels(spec["labels"])}\n'
        f'    </svg>\n'
        f'  </figure>\n'
        f'  <p class="blog-diagram-credit">{spec["sources"]}</p>\n'
        f'</div>\n'
    )
    # The repository formats its own files, and CI checks that, so the generated figure is handed
    # to oxfmt rather than left for a later run to rewrite.
    formatter = subprocess.run(
        ["npx", "--no-install", "oxfmt", str(out)], capture_output=True, text=True, cwd=REPO
    )
    if formatter.returncode:
        print(f"  oxfmt did not run ({formatter.returncode}): run npm run format before committing")
    print(f"{out.relative_to(REPO)}: {out.stat().st_size // 1024} KB")


def compose(name: str, spec: dict) -> None:
    """A figure made of library parts rather than one traced canvas."""
    paths, boxes = place(spec["parts"])
    left, top, right, bottom = frame("", spec["labels"], 1024, 572)
    for box in boxes:
        left, top = min(left, round(box[0]) - 14), min(top, round(box[1]) - 14)
        right, bottom = max(right, round(box[2]) + 14), max(bottom, round(box[3]) + 14)
    left, top = max(0, left), max(0, top)
    write(name, spec, paths, (left, top, right, bottom))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("names", nargs="*")
    parser.add_argument("--refs", default="/mnt/project-files/germomics-figures/biorender")
    args = parser.parse_args()
    figures = json.loads((HERE / "figures.json").read_text())
    for name in args.names or figures:
        if name not in figures:
            raise SystemExit(f"{name} is not in figures.json")
        build(name, figures[name], Path(args.refs))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
