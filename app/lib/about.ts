// Canonical About + author content, in one client-safe place so the /about routes, the
// Person/Organization JSON-LD, and /llms-full.txt all read from the same source (no drift).
// Bio and credentials are FINAL and approved (Vault site-config.md, verified against the 2025 CV)
// and used verbatim. germomics is independent: credentials live in the bio only, with no
// institutional branding or endorsement on the site.

export const AUTHOR = {
  name: "Dustin Edwards",
  honorific: "Dr.",
  slug: "dustin-edwards",
  jobTitle: "Professor and Department Head of Biological Sciences",
  // One-line author credit, shown wherever a byline appears (e.g. article pages).
  byline: "Written by Dr. Dustin Edwards.",
  // Approved bio, a single paragraph. Do not reword, reorder, or re-split.
  bio: "Dr. Dustin Edwards is Professor and Department Head of Biological Sciences in the College of Science and Mathematics at Tarleton State University. He chairs the Institutional Biosafety Committee at the university, and he serves as an officer and the Archivist of the Texas Branch of the American Society for Microbiology. He earned his Ph.D. in Biomedical Sciences from the Department of Molecular Virology and Microbiology at Baylor College of Medicine within the Texas Medical Center in Houston, where he studied how the human T-cell leukemia virus type 1 (HTLV-1) protein Tax disrupts the control of cell growth. He then spent five years as a postdoctoral fellow at the National Cancer Institute, part of the National Institutes of Health in Bethesda, Maryland, working on the regulatory and accessory proteins that HTLV-1 uses to establish and maintain infection. His lab at Tarleton continues work on retroviruses, including molecular studies and field surveillance for reticuloendotheliosis virus (REV) and lymphoproliferative disease virus (LPDV) in wild turkeys and other Texas game birds. He also oversees course-based undergraduate research on bacteriophages, viruses that infect bacteria, with the Howard Hughes Medical Institute SEA program. Germomics began as a project for a Science and Society course and is now an independent podcast and writing project about microbiology and history.",
  // schema.org Person fields (Vault site-config.md). affiliation/memberOf appear in the schema
  // only, as author-credential context, not as on-page institutional branding.
  affiliation: "Tarleton State University",
  memberOf: "American Society for Microbiology",
  alumniOf: ["Baylor College of Medicine", "National Institutes of Health"],
  knowsAbout: [
    "molecular retrovirology",
    "HTLV-1",
    "reticuloendotheliosis virus",
    "bacteriophage genomics",
    "microbiology",
    "science education",
  ],
  sameAs: [
    "https://faculty.tarleton.edu/dcedwards/",
    "https://dustinedwards.info",
    "https://orcid.org/0000-0001-6409-8041",
    "https://scholar.google.com/citations?user=lfzCCXwAAAAJ&hl=en",
  ],
} as const;

export const ABOUT = {
  title: "About germomics",
  lede: "germomics is a podcast and writing project about microbiology and history.",
  paragraphs: [
    "germomics explores the microbial world and the people, places, and discoveries behind it: the organisms, the science, and the stories that shaped how we understand life too small to see.",
    "Alongside the podcast there is writing, interactive data pages on viruses and bacteria, and short browser games, all made independently by a single author.",
  ],
} as const;
