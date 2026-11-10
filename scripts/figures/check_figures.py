#!/usr/bin/env python3
"""Refuse a figure that breaks the rules the figures are drawn to.

These are the mistakes that were being caught by eye, one render at a time, and some of them are
invisible in one theme and obvious in the other. A check is cheaper and never forgets.

    python3 scripts/figures/check_figures.py            # every figure
    python3 scripts/figures/check_figures.py --quiet    # only the failures

What it refuses, for each file in public/blog-diagrams/:

    structure    the figure's wrapper, role, aria-label, title, desc and a sources line with a link
    text         a figure with no real <text>: a word traced as glyph shapes cannot be selected,
                 searched, scaled or read aloud
    paint        a fill or a stroke written on the element: the stylesheet owns the look, so a
                 figure that paints itself cannot follow the theme
    class        a path with no class, or a class the stylesheet does not define
    step         a region on a scale's steps 1 to 6: those steps are page and border in a
                 Radix-style scale, so the shape disappears into the page in one theme or the other
    weight       a stroke width written on the element rather than taken from the class
    size         a figure over its gzipped budget

The budget is deliberately generous; it is there to catch a figure that ran away, not to shave
bytes. A figure that needs more says so in figures.json with "budget".
"""

import argparse
import gzip
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
FIGURES = REPO / "public" / "blog-diagrams"

# The classes app.css defines for a figure. "ln" and its modifiers are the older drawn figures.
CLASSES = {
    "fig", "in", "v", "c", "ink", "fig-label", "fig-note",
    "ln", "brand", "accent", "muted", "dots",
    "tint-brand", "tint-accent", "tint2-brand", "tint2-accent", "tint-ink", "tint2-ink",
    "label-primary", "label-secondary", "m-fade", "m-draw", "m-slide",
}
BUDGET = 64 * 1024
PALE = re.compile(r"--fig-[vcn][1-6]\b")


def faults(path: Path, budget: int) -> list[str]:
    text = path.read_text()
    out = []

    if 'class="blog-diagram-block"' not in text or 'class="blog-diagram"' not in text:
        out.append("structure: no .blog-diagram-block wrapper or no .blog-diagram figure")
    if 'role="img"' not in text or "aria-label=" not in text:
        out.append("structure: the figure needs role=img and an aria-label")
    for tag in ("title", "desc"):
        if f"<{tag}>" not in text:
            out.append(f"structure: no <{tag}> in the svg")
    credit = re.search(r'<p class="blog-diagram-credit">(.*?)</p>', text, re.S)
    if not credit:
        out.append("structure: no sources line")
    elif "<a " not in credit.group(1):
        out.append("structure: the sources line cites nothing")

    if "<text" not in text:
        out.append("text: no real <text>, so the figure's words cannot be read aloud or scaled")

    for element in re.findall(r"<(?:path|g|use|circle|rect|ellipse|line|polygon)[^>]*>", text):
        if re.search(r'\b(?:fill|stroke)="(?!none")', element):
            out.append(f"paint: {element[:60]}… paints itself; the stylesheet owns the look")
            break
    for element in re.findall(r"<path[^>]*>", text):
        if re.search(r'\bstroke-width="', element):
            out.append("weight: a stroke-width on the element; the class carries the weight")
            break
    if PALE.search(text):
        out.append(f"step: {PALE.search(text).group(0)} is a page or border step and vanishes in one theme")

    for element in re.findall(r"<path[^>]*>", text):
        names = re.search(r'class="([^"]*)"', element)
        if not names:
            out.append("class: a path with no class, so it falls back to a solid black fill")
            break
        unknown = [n for n in names.group(1).split() if n not in CLASSES]
        if unknown:
            out.append(f"class: {' '.join(unknown)} is not defined in app.css")
            break

    packed = len(gzip.compress(text.encode()))
    if packed > budget:
        out.append(f"size: {packed // 1024} KB gzipped, over its {budget // 1024} KB budget")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    budgets = {
        name: spec.get("budget", BUDGET)
        for name, spec in json.loads((HERE / "figures.json").read_text()).items()
    }
    bad = 0
    for figure in sorted(FIGURES.glob("*.html")):
        found = faults(figure, budgets.get(figure.stem, BUDGET))
        if found:
            bad += 1
            print(f"{figure.relative_to(REPO)}")
            for fault in found:
                print(f"  {fault}")
        elif not args.quiet:
            print(f"{figure.relative_to(REPO)}: ok")
    if bad:
        print(f"\n{bad} figure(s) to fix.", file=sys.stderr)
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
