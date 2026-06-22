// Canonical About + author content, in one client-safe place so the /about routes, the
// Person/Organization JSON-LD, and /llms-full.txt all read from the same source (no drift).
//
// The bio is grounded in publicly-stated facts from Dustin's own site (research areas, teaching
// areas, lab/advising roles). Anything NOT independently confirmed lives in `toConfirm` and is
// shown as a clearly-marked editor note — never asserted as fact in the prose (E-E-A-T: accurate
// author authority matters more than a padded bio).

export const AUTHOR = {
  name: "Dustin Edwards",
  honorific: "Dr.",
  slug: "dustin-edwards",
  role: "Microbiologist & educator",
  tagline: "Microbiologist, educator, and host of germomics.",
  bio: [
    "Dustin Edwards is a microbiologist and educator, and the host of germomics — a podcast and writing project about the microbial world and the history behind it.",
    "His research spans retroviruses (including REV and LPDV surveys and genetics), host-associated microbiomes, and bacteriophage discovery, isolation, and bioinformatics. He directs a research group and mentors students in the lab.",
    "He teaches cell biology, genetics, virology, vaccines, and phage discovery and bioinformatics, and advises students in the biomedical sciences.",
  ],
  research: [
    "Retroviruses — REV / LPDV surveys and genetics",
    "Host-associated microbiomes",
    "Bacteriophage discovery, isolation & bioinformatics",
  ],
  teaching: [
    "Cell biology",
    "Genetics",
    "Virology",
    "Vaccines",
    "Phage discovery & bioinformatics",
  ],
  // Only Dustin can confirm these — rendered as a visible editor note, NOT stated as fact.
  toConfirm: [
    "Doctoral degree and field",
    "Current institution / department and title",
    "Public CV or faculty-profile link (for the Person schema `sameAs`)",
    "An author headshot",
  ],
  // Verified external profiles for Person.sameAs. Add the faculty/CV/social URLs once confirmed.
  sameAs: ["https://dustinedwards.info/"],
} as const;

export const ABOUT = {
  title: "About germomics",
  lede: "germomics is a podcast and writing project about microbiology and history — the purple stain, retold.",
  paragraphs: [
    "germomics explores the microbial world and the people, places, and discoveries behind it: the organisms, the science, and the stories that shaped how we understand life too small to see.",
    "Alongside the podcast there is writing, interactive data pages on viruses and bacteria, and short browser games — all made independently by a single author.",
  ],
} as const;
