// Diff the legacy feed against the newly served one. Integrity fields (guid + isPermaLink,
// enclosure byte length, duration, episode set) must be IDENTICAL; enclosure host moves to
// media.germomics.com; <description> text is intentionally upgraded to the richer page summary.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TMP = process.env.TEMP || process.env.TMP || "/tmp";
const oldXml = readFileSync(join(TMP, "live_podcast.xml"), "utf8");
const newXml = readFileSync(join(TMP, "new_podcast.xml"), "utf8");

function items(xml) {
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const guidM = b.match(/<guid([^>]*)>([\s\S]*?)<\/guid>/);
    const encM = b.match(/<enclosure\s+url="([^"]*)"\s+length="(\d+)"\s+type="([^"]*)"/);
    const durM = b.match(/<itunes:duration>([\s\S]*?)<\/itunes:duration>/);
    const titleM = b.match(/<title>([\s\S]*?)<\/title>/);
    out.push({
      guidAttr: guidM ? guidM[1].trim() : null,
      guid: guidM ? guidM[2].trim() : null,
      encUrl: encM ? encM[1] : null,
      encLen: encM ? Number(encM[2]) : null,
      encType: encM ? encM[3] : null,
      duration: durM ? durM[1].trim() : null,
      title: titleM ? titleM[1].trim() : null,
    });
  }
  return out;
}

const o = items(oldXml);
const n = items(newXml);
const oByGuid = new Map(o.map((x) => [x.guid, x]));
const nByGuid = new Map(n.map((x) => [x.guid, x]));

console.log(`OLD items: ${o.length}   NEW items: ${n.length}`);

const oGuids = [...oByGuid.keys()].sort();
const nGuids = [...nByGuid.keys()].sort();
const sameSet = oGuids.length === nGuids.length && oGuids.every((g, i) => g === nGuids[i]);
console.log(`GUID set identical: ${sameSet ? "YES" : "NO"}`);
const missing = oGuids.filter((g) => !nByGuid.has(g));
const extra = nGuids.filter((g) => !oByGuid.has(g));
if (missing.length) console.log("  MISSING in new:", missing);
if (extra.length) console.log("  EXTRA in new:", extra);

let integrityOk = true;
console.log("\nPer-episode integrity (guid / isPermaLink / byte length / duration / enclosure host):");
for (const g of oGuids) {
  const a = oByGuid.get(g);
  const c = nByGuid.get(g);
  if (!c) continue;
  const permaOld = /isPermaLink="false"/.test(a.guidAttr || "");
  const permaNew = /isPermaLink="false"/.test(c.guidAttr || "");
  const lenOk = a.encLen === c.encLen;
  const durOk = normDur(a.duration) === normDur(c.duration);
  const permaOk = permaOld === permaNew && permaNew === true;
  const hostNew = c.encUrl ? new URL(c.encUrl).host : "?";
  const hostOk = hostNew === "media.germomics.com";
  const ok = lenOk && durOk && permaOk && hostOk;
  if (!ok) integrityOk = false;
  console.log(
    `  ${ok ? "OK " : "FAIL"} ${g}  len ${a.encLen}${lenOk ? "=" : "≠"}${c.encLen}  dur ${a.duration}->${c.duration}${durOk ? " ok" : " DIFF"}  perma ${permaNew}  host ${hostNew}${hostOk ? "" : " (NOT media.germomics.com)"}`,
  );
}

// itunes:duration format differs (MM:SS vs HH:MM:SS) but must be the SAME instant.
function normDur(d) {
  if (!d) return null;
  const parts = d.split(":").map(Number);
  return parts.reduce((acc, x) => acc * 60 + x, 0);
}

console.log(`\nINTEGRITY: ${integrityOk ? "ALL PASS" : "FAILURES ABOVE"}`);

// Namespaces present in the new channel
const ns = ["xmlns:itunes", "xmlns:podcast", "xmlns:content", "xmlns:atom"];
console.log("\nNamespaces in new feed:");
for (const x of ns) console.log(`  ${newXml.includes(x) ? "OK " : "MISSING"} ${x}`);

// Enclosure host summary
const oldHosts = new Set(o.map((x) => (x.encUrl ? new URL(x.encUrl).host : "?")));
const newHosts = new Set(n.map((x) => (x.encUrl ? new URL(x.encUrl).host : "?")));
console.log(`\nEnclosure host: OLD ${[...oldHosts].join(",")}  ->  NEW ${[...newHosts].join(",")}`);
