# Sources for germomics.com /data (prepared 2026-10-31)

All data is in `datasets.json`. Every number there was read from one of the sources below and checked as described. Nothing was estimated or interpolated.

## Cholera, Soho 1854

### Timelines: fatal attacks and deaths per day (19 Aug to 30 Sep 1854)

- **Citation:** John Snow, *On the Mode of Communication of Cholera*, 2nd ed. (London: John Churchill, 1855), Table I, p. 49.
- **Fetched:** https://raw.githubusercontent.com/vincentarelbundock/Rdatasets/master/csv/HistData/Snow.dates.csv (HistData `Snow.dates`), and the Wellcome Library scan of the 1855 edition, https://archive.org/download/b28985266/b28985266.pdf (PDF page 63 = printed p. 49).
- **Check:** I read both columns of Table I off the scan at 220 dpi and transcribed them. The transcription matches HistData row for row (the build script asserts this). Totals as printed: 616 fatal attacks (571 dated plus 45 "Date unknown") and 616 deaths (all dated). Peaks: 143 attacks on 1 September, 127 deaths on 2 September.
- **Note:** the old placeholder's six values (56, 143, 116, 54, 46, 36) were the attacks column, labeled correctly as "fatal attacks". The deaths column is a separate series and peaks a day later.

### Map: deaths by address, and pumps

- **Citation:** the 578 death bars on Snow's 1855 map, as digitized by W. R. Tobler and S. Dodson (1992; HistData `Snow.deaths`), amended (3 duplicates removed, 3 missing cases restored) and georeferenced by lindbrook in the R package *cholera* (QGIS Georeferencer, thin plate spline, WGS 84, ground control points at road intersections on OpenStreetMap).
- **Fetched:** https://raw.githubusercontent.com/lindbrook/cholera/master/data/ files `fatalities.rda`, `fatalities.anchor.rda`, `latlong.ortho.anchor.rda`, `roads.rda` and `pumps.rda`, the matching `man/*.Rd` pages, and `docs/notes/georeferencing.md` (method). Also https://raw.githubusercontent.com/vincentarelbundock/Rdatasets/master/csv/HistData/Snow.deaths.csv and `Snow.deaths2.csv`.
- **Aggregation:** one point per address. In lindbrook's terms an address is an "anchor", the base of a stack of bars. There are 321 addresses, each valued at its number of deaths (`case.count`), and they sum to 578. Each address is labeled with the street of the road segment it projects onto (`latlong.ortho.anchor.road.segment` joined to `roads.name`). The street table lists the 15 streets with the most deaths and then "Other streets (47)", which together sum to 578. The top streets are Broad Street 95, Berwick Street 44, Marshall Street 39, Poland Street 26 and St Anns Court 25.
- **Checks:**
  - lindbrook's x/y for all 578 cases are identical to HistData `Snow.deaths2`, with a maximum difference of 0.
  - Independent georeference: Robin Wilson's SnowGIS data (https://www.rtwilson.com/downloads/SnowGIS_KML.zip, digitized from the same map onto Ordnance Survey data, 2011). For each of Wilson's 250 death points, the nearest lindbrook address is a median of 4.9 m away (90th percentile 7.7 m, maximum 21.8 m). Wilson's 8 pumps fall 3.6 to 11.7 m from lindbrook's matching pumps, and his Broad Street pump is 5.4 m from lindbrook's pump 7.
- **Pumps:** all 13 pumps on Snow's map, with lindbrook's coordinates and street names. Pump 7 is Broad Street.

### Map: the streets

- **Citation:** the streets of Snow's 1855 map as digitized by W. R. Tobler and S. Dodson (1992; HistData `Snow.streets`), with Snow's road names added and georeferenced (WGS 84) by lindbrook in the R package *cholera*, data set `roads`.
- **Fetched:** https://raw.githubusercontent.com/lindbrook/cholera/master/data/roads.rda (2026-11-01) and its page `man/roads.Rd`.
- **Converted:** `scripts/soho-streets.py` writes `soho-streets.json`: one GeoJSON feature per road name, a MultiLineString of its segments (206 names, 479 segments), positions rounded to 6 decimals. Snow's map frame ("Map Frame") is left out. The map prints a name without its roman numeral ("Princes Street (I)" reads "Princes Street").
- **Check:** the streets come from the same georeference as the 321 addresses and 13 pumps, so the dots sit on their streets as on Snow's map. I did not check the street lines against a second source.

### Not verified, and why the totals differ

- Wilson's file totals 489 deaths at 250 locations, not 578. I used lindbrook/Tobler's 578, the standard count of bars, and used Wilson only to check positions. I did not find out why Wilson's total is lower.
- The map total (578) and Table I's total (616) are different counts in Snow's book, and I did not reconcile them. Show them as separate figures.
- I did not compare the bar counts against the map scan bar by bar. They rest on Dodson and Tobler's digitization and lindbrook's documented amendments.
- I could not reach the UCLA (ph.ucla.edu/epi/snow) transcription: its pages returned 404. I used the Wellcome scan instead.

## Influenza, London 1918 to 1919

- **Citation:** Registrar-General, *Report on the Mortality from Influenza in England and Wales during the Epidemic of 1918-19*, Supplement to the 81st Annual Report of the Registrar-General (London: HMSO, 1920, Cmd. 700), Table XX, pp. 48-50, row "London (Admin. County)".
- **Fetched:** https://archive.org/download/sid14156800/sid14156800.pdf (Wellcome Library scan; PDF pages 52 to 54 = printed pp. 48 to 50) and its OCR text, `sid14156800_djvu.txt`.
- **Measure:** deaths of civilians certified to influenza in each week, for the 46 weeks ending Saturday 29 June 1918 to Saturday 10 May 1919. The italic second row of the table gives the same deaths as an annual death rate per 1,000 civilians. Both series are in `datasets.json`.
- **Check:** I read the London row off the page images at 200 dpi. The weekly deaths sum exactly to the table's printed wave totals: first wave 997 (12 weeks, 23 Jun to 14 Sep), second wave 12,330 (19 weeks, 15 Sep to 25 Jan) and third wave 3,786 (15 weeks, 26 Jan to 10 May). The whole-period total is 17,113 (rate 4.9 per 1,000). The build script asserts all four sums. The week-ending dates were checked as consecutive Saturdays.
- **Peaks:** 279 deaths in the week ending 13 Jul 1918 (3.7 per 1,000), 2,651 in the week ending 2 Nov 1918 (35.0 per 1,000) and 825 in the week ending 1 Mar 1919 (10.9 per 1,000).
- **Not verified:**
  - The weekly rates cannot be checked by summing. I read them from the scan once, with no second source.
  - The week ending 6 July is slightly smudged on the scan. I read it as 258, and the first-wave total of 997 confirms it.
- **Cases:** none. The report tabulates deaths only and gives no weekly count of influenza cases for London. I found no case series for the same place and measure.
- **Not used:** Collins (1930, Public Health Reports) and the US Census tables. The London series was a single primary table with internal totals, so I did not fetch them.
