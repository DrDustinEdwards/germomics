// The /data charts' island: Capsomer's chart-enhance (Enarratio's keyboard walk, hover details, legend toggles and
// downloads) on every .cap-chart, and the phone drawing swapped in once a frame is under 30rem (frameHtml's redraw
// spec, app/lib/charts.server.ts). Only a page with a chart loads it (data-island="charts"), so the charts never
// reach /site.js or the app's shared chunk (hard rule 4). Importing the module starts it and watches for frames
// added later.
import "../../node_modules/capsomer/dist/components/chart-frame/chart-enhance.js"; // TEMP

export default function charts(): void {}
