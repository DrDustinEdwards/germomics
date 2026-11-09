// The :::diagram blocks currently saved in the six essays. The page draws the figure itself
// (public/blog-diagrams). diagramMarkdown is the block to delete from each essay.

export type EpisodeDiagram = {
  slug: string;
  title: string;
  /** Names the boxes and the arrows. Prelum requires this; a caption is not a substitute. */
  alt: string;
  mermaid: string;
  /** Figcaption, in Markdown: what the drawing is not, then the sources. */
  caption: string;
  /** Where the block goes in the current essay. The essay text is not copied here. */
  placement: string;
};

const PCR = `flowchart TD
  denature[Denature] --> anneal[Anneal]
  anneal --> extend[Extend]
  extend --> repeat[Repeat]`;

const CHOLERA = `flowchart TD
  bind["B binds GM1"] --> lock["A1 locks Gs on"]
  lock --> water["Chloride out, less sodium in"]`;

const PRION = `flowchart TD
  cell["Cells make PrPC"] --> template["PrPSc templates more PrPSc"]
  template --> spread["The misfolded form can spread"]`;

const RABIES = `flowchart TD
  bite["Enters at a bite"] --> nerve["Moves back along the nerve"]
  nerve --> glands["Spreads out, including to saliva"]`;

const LEPTO = `flowchart TD
  host["Reservoir kidney"] --> urine["Shed in urine"]
  urine --> env["Fresh water and wet soil"]
  env --> host
  env --> person["Broken skin or a mucous membrane"]`;

const DIPHTHERIA = `flowchart TD
  phage["Phage brings tox"] --> bind["B binds the cell"]
  bind --> stop["A stops protein synthesis"]`;

export const EPISODE_DIAGRAMS: EpisodeDiagram[] = [
  {
    slug: "on-the-right-taq",
    title: "One cycle of PCR",
    alt: "Denature leads to Anneal, which leads to Extend, which leads to Repeat. Denature is heat separating the two DNA strands. Anneal is primers binding, at a temperature that depends on the primers. Extend is Taq polymerase, from Thermus aquaticus, copying each strand and staying active through the heat. Repeat is those copies becoming templates.",
    mermaid: PCR,
    caption: `A schematic of that order, not a temperature protocol and not a count of product. A real reaction does not double the target at every cycle.

Sources: [Saiki, Gelfand, Stoffel and colleagues, Science (1988)](https://doi.org/10.1126/science.2448875); [Chien, Edgar and Trela, Journal of Bacteriology (1976)](https://doi.org/10.1128/jb.127.3.1550-1557.1976); [Mullis and Faloona, Methods in Enzymology (1987)](https://doi.org/10.1016/0076-6879(87)55023-6).`,
    placement:
      'In "A Drive Up Highway 128", after the paragraph ending "climbs into the billions astonishingly fast." and before "There was one maddening flaw."',
  },
  {
    slug: "confessions-of-a-cholera-girl",
    title: "How cholera toxin acts on an intestinal cell",
    alt: "B binds GM1 leads to A1 locks Gs on, which leads to Chloride out, less sodium in. The B subunits bind GM1 ganglioside on a small-intestinal cell. The A1 piece ADP-ribosylates Gs and leaves adenylate cyclase on, so cAMP stays high. The cell secretes chloride and takes up less sodium, and water follows.",
    mermaid: CHOLERA,
    caption: `A schematic of that path, not a measurement from one patient or one water sample. Not every Vibrio cholerae strain makes this toxin. The toxin genes are carried by a filamentous phage. The Soho map is a separate count of deaths, on the [cholera data page](/data/cholera-soho-1854). Diphtheria toxin is carried by a phage too, in [Antitoxin Togo, Please](/antitoxin-togo-please).

Sources: [Holmgren, Lönnroth and Svennerholm, Infection and Immunity (1973)](https://doi.org/10.1128/iai.8.2.208-214.1973); [Gill and Meren, PNAS (1978)](https://doi.org/10.1073/pnas.75.7.3050); [Field, Journal of Clinical Investigation (2003)](https://doi.org/10.1172/JCI18326); [Waldor and Mekalanos, Science (1996)](https://doi.org/10.1126/science.272.5270.1910).`,
    placement:
      'In "What the Toxin Does", after the paragraph ending "sometimes within hours." and before "And here is the quietly beautiful part."',
  },
  {
    slug: "one-flew-over-the-kuru-nest",
    title: "Prion templating",
    alt: "Cells make PrPC leads to PrPSc templates more PrPSc, which leads to The misfolded form can spread. Cells make the prion protein as PrPC. PrPSc can bind PrPC and favor its refolding into more PrPSc. Kuru is a human disease of this kind among the Fore and their neighbors, and it was transmitted experimentally.",
    mermaid: PRION,
    caption: `A schematic of templating, not a measured structure of PrPSc. It does not show how the misfolded protein injures the brain.

Sources: [Prusiner, Science (1982)](https://doi.org/10.1126/science.6801762); [Gajdusek, Gibbs and Alpers, Nature (1966)](https://doi.org/10.1038/209794a0); [Alpers, Philosophical Transactions of the Royal Society B (2008)](https://doi.org/10.1098/rstb.2008.0071).`,
    placement:
      'In "A Protein That Folds You", after the paragraph that ends "transmissible spongiform encephalopathy." and before "If that sounds like an exotic problem".',
  },
  {
    slug: "rabies-day-out",
    title: "How rabies virus moves through the body",
    alt: "Enters at a bite leads to Moves back along the nerve, which leads to Spreads out, including to saliva. Virus in saliva enters through a bite, into muscle or a peripheral nerve, then moves back along the nerve to the spinal cord and the brain, and can spread outward again, including to the salivary glands.",
    mermaid: RABIES,
    caption: `A schematic of that path. How long it takes varies, and which molecules the virus uses to enter a nerve are still argued, so no receptor is named. Once the virus has reached the central nervous system and symptoms have begun, rabies is fatal. This figure does not say what anyone should do after a bite.

Sources: [Fooks, Cliquet, Finke and colleagues, Nature Reviews Disease Primers (2017)](https://doi.org/10.1038/nrdp.2017.91); [Davis, Rall and Schnell, Annual Review of Virology (2015)](https://doi.org/10.1146/annurev-virology-100114-055157); [World Health Organization, Rabies fact sheet](https://www.who.int/news-room/fact-sheets/detail/rabies).`,
    placement:
      'In "The Slow Crawl to the Brain", after the paragraph ending "reprogrammed into a delivery system." and before "That slow crawl up the nerves".',
  },
  {
    slug: "hell-on-weils",
    title: "Leptospirosis: reservoir, environment, exposure",
    alt: "Reservoir kidney leads to Shed in urine, which leads to Fresh water and wet soil. That water and soil lead back to Reservoir kidney, and also to Broken skin or a mucous membrane. Infected mammals, rats in particular, can carry Leptospira in the kidney and shed it in urine. A person is exposed the same way and is not what keeps the cycle going. Some infections cause no illness. Weil's disease is a severe form.",
    mermaid: LEPTO,
    caption: `A schematic of the maintenance cycle and of human exposure, not a risk score. How long the bacteria remain outside a host depends on the conditions, which this figure does not measure. Not every exposure infects, and not every infection is severe. This is not advice about a flood, a wound, or treatment.

Sources: [Levett, Clinical Microbiology Reviews (2001)](https://doi.org/10.1128/CMR.14.2.296-326.2001); [Haake and Levett, Current Topics in Microbiology and Immunology (2014)](https://doi.org/10.1007/978-3-662-45059-8_5); [Centers for Disease Control and Prevention, About leptospirosis](https://www.cdc.gov/leptospirosis/about/index.html).`,
    placement:
      'In "Hell on Weils", after the paragraph that begins "The trick to its success is where it lives" and ends with the eyes, nose, or mouth, and before the paragraph that begins "That is why the classic victims".',
  },
  {
    slug: "antitoxin-togo-please",
    title: "Phage-carried diphtheria toxin",
    alt: "Phage brings tox leads to B binds the cell, which leads to A stops protein synthesis. Corynebacterium diphtheriae makes diphtheria toxin when corynephage beta integrates and brings the tox gene. A strain without that phage does not make the toxin. The B part binds the precursor of heparin-binding EGF-like growth factor. The A part ADP-ribosylates elongation factor 2, and the cell stops making protein.",
    mermaid: DIPHTHERIA,
    caption: `A schematic of lysogeny and of the toxin's effect on a cell. This is not the 1925 serum run, and it is not a vaccination schedule. Cholera toxin is carried by a phage too, in [Confessions of a Cholera Girl](/confessions-of-a-cholera-girl).

Sources: [Freeman, Journal of Bacteriology (1951)](https://doi.org/10.1128/jb.61.6.675-688.1951); [Holmes, Journal of Infectious Diseases (2000)](https://doi.org/10.1086/315554); [Naglich, Metherall, Russell and Eidels, Cell (1992)](https://doi.org/10.1016/0092-8674(92)90623-k); [Collier, Toxicon (2001)](https://doi.org/10.1016/s0041-0101(01)00165-9).`,
    placement:
      'In "The Bacterium That Needs a Virus to Be Deadly", after the paragraph ending "only a pathogen once it has been infected itself." and before "The toxin kills by sabotage".',
  },
];

/** The exact block to insert. The Mermaid fence is what Prelum draws. */
export function diagramMarkdown(diagram: EpisodeDiagram): string {
  const mermaid = diagram.mermaid.replace(/^\n+/, "").replace(/\s+$/, "");
  return [
    `:::diagram{title="${diagram.title}" alt="${diagram.alt}"}`,
    "```mermaid",
    mermaid,
    "```",
    "",
    diagram.caption.trim(),
    ":::",
  ].join("\n");
}
