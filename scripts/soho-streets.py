# Writes app/lib/data/soho-streets.json, the streets under the Soho cholera map (/data/cholera-soho-1854), from
# lindbrook's R package cholera: data/roads.rda, Dodson and Tobler's digitized streets of Snow's 1855 map with
# Snow's road names, georeferenced to WGS 84 (lon, lat). Cited in app/lib/data/SOURCES.md.
#
#   curl -sSfLO https://raw.githubusercontent.com/lindbrook/cholera/master/data/roads.rda
#   pip install rdata
#   python3 scripts/soho-streets.py roads.rda
#
# One feature per street name, a MultiLineString of its segments in segment order. The map's frame ("Map Frame")
# is left out. Positions are rounded to 6 decimals (about 0.1 m).
import json
import sys
from collections import OrderedDict

import rdata

roads = rdata.read_rda(sys.argv[1])["roads"].sort_values(["street", "id"])
streets = OrderedDict()
for (segment, name), rows in roads.groupby(["street", "name"], sort=True):
    if name == "Map Frame":
        continue
    line = [[round(float(lon), 6), round(float(lat), 6)] for lon, lat in zip(rows["lon"], rows["lat"])]
    if len(line) >= 2:
        streets.setdefault(str(name), []).append(line)

collection = {
    "type": "FeatureCollection",
    "features": [
        {"type": "Feature", "properties": {"name": name}, "geometry": {"type": "MultiLineString", "coordinates": lines}}
        for name, lines in streets.items()
    ],
}
with open("app/lib/data/soho-streets.json", "w") as out:
    json.dump(collection, out, separators=(",", ":"))
    out.write("\n")
print(f"{len(streets)} streets, {sum(len(v) for v in streets.values())} segments")
