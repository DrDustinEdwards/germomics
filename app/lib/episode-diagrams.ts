// The :::diagram blocks saved in the six essays. The Mermaid fence is the key. The renderer
// swaps that figure for the inline SVG in public/blog-diagrams and keeps the caption.

export type EpisodeDiagram = {
  slug: string;
  /** The file in public/blog-diagrams, without .html. An essay can carry more than one figure. */
  file: string;
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
    file: "on-the-right-taq",
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
    file: "confessions-of-a-cholera-girl",
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
    file: "one-flew-over-the-kuru-nest",
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
    file: "rabies-day-out",
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
    file: "hell-on-weils",
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
    file: "antitoxin-togo-please",
    title: "Phage-carried diphtheria toxin",
    alt: "Phage brings tox leads to B binds the cell, which leads to A stops protein synthesis. Corynebacterium diphtheriae makes diphtheria toxin when corynephage beta integrates and brings the tox gene. A strain without that phage does not make the toxin. The B part binds the precursor of heparin-binding EGF-like growth factor. The A part ADP-ribosylates elongation factor 2, and the cell stops making protein.",
    mermaid: DIPHTHERIA,
    caption: `A schematic of lysogeny and of the toxin's effect on a cell. This is not the 1925 serum run, and it is not a vaccination schedule. Cholera toxin is carried by a phage too, in [Confessions of a Cholera Girl](/confessions-of-a-cholera-girl).

Sources: [Freeman, Journal of Bacteriology (1951)](https://doi.org/10.1128/jb.61.6.675-688.1951); [Holmes, Journal of Infectious Diseases (2000)](https://doi.org/10.1086/315554); [Naglich, Metherall, Russell and Eidels, Cell (1992)](https://doi.org/10.1016/0092-8674(92)90623-k); [Collier, Toxicon (2001)](https://doi.org/10.1016/s0041-0101(01)00165-9).`,
    placement:
      'In "The Bacterium That Needs a Virus to Be Deadly", after the paragraph ending "only a pathogen once it has been infected itself." and before "The toxin kills by sabotage".',
  },
  {
    slug: "a-boy-named-flu",
    file: "a-boy-named-flu--surface",
    title: "Influenza A: surface proteins, drift and shift",
    alt: "Influenza A has two main surface proteins. Hemagglutinin, H, binds receptors on a cell. Neuraminidase, N, cuts new virus free of the cell. In drift, small changes to H add up over seasons. In shift, a cell infected by two viruses, can package gene segments from both into a new virus, sometimes with a new H.",
    mermaid: `flowchart TD
  flu0["H and N on the surface"] --> flu1["Drift changes H slowly"]
  flu1["Drift changes H slowly"] --> flu2["Shift swaps whole segments"]`,
    caption: `A schematic of the two surface proteins and of drift and shift, not a map of one strain's mutations.

Sources: [Webster and colleagues, Microbiological Reviews (1992)](https://doi.org/10.1128/mr.56.1.152-179.1992).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
  },
  {
    slug: "a-sky-full-of-sars",
    file: "a-sky-full-of-sars--spike",
    title: "SARS coronavirus: spike, receptor and host range",
    alt: "The SARS coronavirus has a crown of spike proteins. A spike binds ACE2, a receptor on a human cell, like a key in a lock. The 2002 to 2003 outbreak in people was followed by the discovery of related coronaviruses in bats, and of a closely related virus in palm civets sold in markets in southern China.",
    mermaid: `flowchart TD
  sars0["Spike binds ACE2"] --> sars1["Related viruses in bats"]
  sars1["Related viruses in bats"] --> sars2["Civets, then people"]`,
    caption: `A schematic of binding and of the host chain, not a measurement of affinity. The route to people is simplified.

Sources: [Li and colleagues, Nature (2003)](https://doi.org/10.1038/nature02145); [Li and colleagues, Science (2005)](https://doi.org/10.1126/science.1118391); [Guan and colleagues, Science (2003)](https://doi.org/10.1126/science.1087139).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
  },
  {
    slug: "theres-something-about-typhoid-mary",
    file: "theres-something-about-typhoid-mary--carrier",
    title: "How Salmonella Typhi becomes a carrier state",
    alt: "Salmonella Typhi is swallowed in food or water, crosses the gut wall carried inside macrophages, and can reach the gallbladder, where it can persist on gallstones in a biofilm. A carrier can shed it in stool for months or years, sometimes without symptoms.",
    mermaid: `flowchart TD
  typhoid0["Swallowed"] --> typhoid1["Carried in macrophages"]
  typhoid1["Carried in macrophages"] --> typhoid2["Persists in the gallbladder"]`,
    caption: `A schematic of the carrier state, not a timeline for one person. Not every infected person becomes a carrier.

Sources: [Gonzalez-Escobedo, Marshall and Gunn, Nature Reviews Microbiology (2011)](https://doi.org/10.1038/nrmicro2490); [Crawford and colleagues, PNAS (2010)](https://doi.org/10.1073/pnas.1000862107).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
  },
  {
    slug: "on-the-right-taq",
    file: "on-the-right-taq--heat",
    title: "Why PCR needed a heat-stable polymerase",
    alt: "A PCR cycle swings between about 95 degrees Celsius to separate the DNA strands, about 55 to let primers bind, and about 72 to copy. The E. coli polymerase used first did not survive 95 degrees, so fresh enzyme had to be added each cycle. Taq polymerase, from Thermus aquaticus, survives the heat, so a single addition runs every cycle.",
    mermaid: `flowchart TD
  pcr0["Heat separates the strands"] --> pcr1["E. coli polymerase fails"]
  pcr1["E. coli polymerase fails"] --> pcr2["Taq survives"]`,
    caption: `Typical temperatures, and the times are not to scale. Real protocols vary with the primers and the enzyme.

Sources: [Saiki and colleagues, Science (1988)](https://doi.org/10.1126/science.2448875); [Brock and Freeze, Journal of Bacteriology (1969)](https://doi.org/10.1128/jb.98.1.289-297.1969).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
  },
  {
    slug: "rabies-day-out",
    file: "rabies-day-out--window",
    title: "Rabies: the window before symptoms",
    alt: "After a bite, rabies virus travels back along a nerve toward the central nervous system, a time that varies from weeks to months and sometimes longer. Before symptoms begin, post-exposure treatment can stop the disease. Once symptoms begin, rabies is almost always fatal.",
    mermaid: `flowchart TD
  rabies0["Bite"] --> rabies1["Nerve travel"]
  rabies1["Nerve travel"] --> rabies2["Treat before symptoms"]`,
    caption: `A schematic. The time from bite to symptoms varies a great deal, and this is not a treatment protocol.

Sources: [World Health Organization, Rabies fact sheet](https://www.who.int/news-room/fact-sheets/detail/rabies); [Fooks and colleagues, Nature Reviews Disease Primers (2017)](https://doi.org/10.1038/nrdp.2017.91).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
  },
  {
    slug: "its-on-the-syphilis",
    file: "its-on-the-syphilis--stages",
    title: "The four stages of untreated syphilis",
    alt: "Untreated syphilis moves through four stages. The primary stage is a painless sore where it entered, about three weeks after exposure. The secondary stage brings a rash, often on the palms and soles, over weeks to months. The latent stage has no signs for years but the person is still infected. In some people a tertiary stage, years to decades later, damages the heart or nervous system.",
    mermaid: `flowchart TD
  syphilis0["Primary"] --> syphilis1["Secondary"]
  syphilis1["Secondary"] --> syphilis2["Latent"]
  syphilis2["Latent"] --> syphilis3["Tertiary"]`,
    caption: `A schematic of the usual order and timing, not a prediction for one person. Many people do not reach the later stages.

Sources: [Workowski and colleagues, MMWR Recommendations and Reports 70(4), Sexually Transmitted Infections Treatment Guidelines (2021)](https://doi.org/10.15585/mmwr.rr7004a1).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
  },
  {
    slug: "confessions-of-a-cholera-girl",
    file: "confessions-of-a-cholera-girl--rehydration",
    title: "Why oral rehydration works in cholera",
    alt: "Cholera toxin keeps a chloride channel in the gut cell membrane open, so chloride and water leave the cell. The transporter that pulls sodium in together with glucose still works. An oral rehydration solution with glucose and salt uses that transporter, and water follows the sodium into the cell.",
    mermaid: `flowchart TD
  ors0["Toxin holds the channel open"] --> ors1["Glucose carries sodium"]
  ors1["Glucose carries sodium"] --> ors2["Water follows"]`,
    caption: `A schematic of the transport idea, not a dosing guide.

Sources: [Field, Journal of Clinical Investigation (2003)](https://doi.org/10.1172/JCI18326).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
  },
  {
    slug: "antitoxin-togo-please",
    file: "antitoxin-togo-please--antitoxin-vaccine",
    title: "Antitoxin and vaccine are different protection",
    alt: "Antitoxin is borrowed antibodies: an animal is immunized, and its serum is given to a patient who is already infected, which neutralizes the toxin now. A vaccine uses a harmless form of the toxin, a toxoid, so the person's own cells make antibodies and keep a memory that lasts years, with boosters.",
    mermaid: `flowchart TD
  antitoxin0["Borrowed antibodies"] --> antitoxin1["Own antibodies"]`,
    caption: `A schematic of two kinds of protection, not a treatment or vaccination schedule.

Sources: [Centers for Disease Control and Prevention, Pink Book, Diphtheria](https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-8-diphtheria.html).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
  },
  {
    slug: "hell-on-weils",
    file: "hell-on-weils--course",
    title: "The two phases of leptospirosis",
    alt: "Leptospirosis often runs in two phases. In the first, bacteria are in the blood, with fever, headache and muscle pain. A brief lull can follow. In the second, immune phase, most illness stays mild, and some people develop Weil's disease, the severe form, with jaundice, kidney failure and bleeding.",
    mermaid: `flowchart TD
  lepto0["Blood phase"] --> lepto1["Lull"]
  lepto1["Lull"] --> lepto2["Immune phase"]`,
    caption: `A schematic of the usual course, not a measured fever curve. Many infections stay mild and never reach the second phase.

Sources: [Haake and Levett, Current Topics in Microbiology and Immunology (2015)](https://doi.org/10.1007/978-3-662-45059-8_5); [Levett, Clinical Microbiology Reviews (2001)](https://doi.org/10.1128/CMR.14.2.296-326.2001).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
  },
  {
    slug: "one-flew-over-the-kuru-nest",
    file: "one-flew-over-the-kuru-nest--incubation",
    title: "Kuru: the incubation period",
    alt: "Kuru has a very long incubation period. From an exposure, often in childhood, the average was about a dozen years, and some cases appeared after 50 years or more. Symptoms of lost coordination and tremor then lead to death, usually within a year or so.",
    mermaid: `flowchart TD
  kuru0["Exposure"] --> kuru1["Years of incubation"]
  kuru1["Years of incubation"] --> kuru2["Symptoms"]`,
    caption: `A schematic of reported incubation periods, not a measurement from one case.

Sources: [Alpers, Philosophical Transactions of the Royal Society B (2008)](https://doi.org/10.1098/rstb.2008.0071); [Collinge and colleagues, The Lancet (2006)](https://doi.org/10.1016/S0140-6736(06)68930-7); [Alpers, Communicable Diseases Intelligence (2005)](https://doi.org/10.33321/cdi.2005.29.46).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
  },
  {
    slug: "its-on-the-syphilis",
    file: "its-on-the-syphilis--cases",
    title: "Primary and secondary syphilis in the United States, 1941 to 2019",
    alt: "A line chart of reported primary and secondary syphilis cases per 100,000 people in the United States. The rate was 51.7 in 1941, peaked at 70.9 in 1946, fell to 2.1 in 2000, and rose to 11.9 in 2019.",
    mermaid: `flowchart TD
  cases0["Primary and secondary syphilis in the United States, 1941 to 2019"] --> cases1["Data"]`,
    caption: `Reported cases from state health departments, with changes in case definitions over time. Not every infection is reported.

Sources: [CDC, Sexually Transmitted Disease Surveillance 2019, Table 1](https://www.cdc.gov/sti-statistics/media/pdfs/2024/07/std-surveillance-2019.pdf).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
  },
  {
    slug: "antitoxin-togo-please",
    file: "antitoxin-togo-please--us-cases",
    title: "Diphtheria in the United States, 1933 to 1955",
    alt: "A line chart of reported diphtheria cases and deaths in the United States. Reported cases fell from 50,462 in 1933 to 2,039 in 1955. Deaths fell from 4,937 in 1933 to 156 in 1953; the source prints no deaths for 1954 or 1955.",
    mermaid: `flowchart TD
  uscases0["Diphtheria in the United States, 1933 to 1955"] --> uscases1["Data"]`,
    caption: `Reported cases and registered deaths, not every infection. This is the period after the 1925 serum run and not a before-and-after test of any one measure.

Sources: [Moore and Larsen, Public Health Reports (1957), Table 1](https://stacks.cdc.gov/view/cdc/72811/cdc_72811_DS1.pdf).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
  },
  {
    slug: "one-flew-over-the-kuru-nest",
    file: "one-flew-over-the-kuru-nest--deaths",
    title: "Deaths from kuru, 1987 to 1995",
    alt: "A bar chart of deaths from kuru each year from 1987 to 1995: 12, 8, 11, 9, 3, 7, 4, 5 and 7, a total of 66 deaths, 17 of men and 49 of women.",
    mermaid: `flowchart TD
  deaths0["Deaths from kuru, 1987 to 1995"] --> deaths1["Data"]`,
    caption: `Every death the surveillance team recorded in these nine years. It does not show the peak of the epidemic in the late 1950s, which has no annual table.

Sources: [Alpers for the Kuru Surveillance Team, Communicable Diseases Intelligence (2005), Table 1](https://doi.org/10.33321/cdi.2005.29.46).`,
    placement: "Draft in Carrel only: pick the spot in the essay with Dustin.",
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
