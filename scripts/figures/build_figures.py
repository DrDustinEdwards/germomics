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


def labels(rows: list) -> str:
    out = []
    for x, y, text, kind, anchor in rows:
        where = f' text-anchor="{anchor}"' if anchor else ""
        out.append(f'<text class="fig-{kind}" x="{x}" y="{y}"{where}>{text}</text>')
    return "\n      ".join(out)


def build(name: str, spec: dict, refs: Path) -> None:
    source = refs / f"{spec['source']}.png"
    if not source.exists():
        raise SystemExit(f"{source} is missing: pass --refs with the folder holding the references")

    found = subprocess.run(
        [sys.executable, str(HERE / "find_labels.py"), str(source)],
        check=True, capture_output=True, text=True,
    ).stdout.split()

    art = Path(tempfile.mkdtemp()) / f"{name}.svg"
    subprocess.run(
        [sys.executable, str(HERE / "vectorize.py"), str(source), "--out", str(art)]
        + TRACE + found + spec.get("trace", []),
        check=True, capture_output=True, text=True,
    )
    paths = "\n      ".join(re.findall(r"<path [^>]*/>", art.read_text()))

    desc = spec["desc"]
    out = REPO / "public" / "blog-diagrams" / f"{name}.html"
    out.write_text(
        f'<div class="blog-diagram-block">\n'
        f'  <figure class="blog-diagram" role="img" aria-label="{desc}">\n'
        f'    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 572" width="1024" height="572">\n'
        f'      <title>{spec["title"]}</title>\n'
        f'      <desc>{desc}</desc>\n'
        f'      {paths}\n'
        f'      {labels(spec["labels"])}\n'
        f'    </svg>\n'
        f'  </figure>\n'
        f'  <p class="blog-diagram-credit">{spec["sources"]}</p>\n'
        f'</div>\n'
    )
    print(f"{out.relative_to(REPO)}: {out.stat().st_size // 1024} KB")


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
