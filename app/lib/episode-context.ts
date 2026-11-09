// Context shown on an episode page beside the essay. The essay itself stays in Carrel: this module does not
// write posts, Markdown, or stored HTML. A data preview draws one series the /data page already publishes
// (app/lib/episode-context.server.ts, Enarratio). A schematic is a short labeled sequence, not a measured chart:
// Enarratio's figures are for data, and a mechanism drawn as a chart would look like a measurement.
//
// Slugs and titles are the published episodes (scripts/import-episodes.ts).

export type Citation = { label: string; href: string };

export type Schematic = {
  id: string;
  title: string;
  /** The drawing and its text alternative: each step is visible, in order. */
  steps: { label: string; detail: string }[];
  caption: string;
  limits: string;
  sources: Citation[];
  /** Another page on this site. Not a claim that the essay there discusses the same point. */
  links: { href: string; text: string }[];
};

export type DataPreviewSpec = {
  id: string;
  /** A key of app/lib/data/datasets.json. */
  dataset: "cholera-soho-1854" | "influenza-1918";
  /** Which timeline in that dataset. The server requires its yLabel to be Deaths. */
  series: number;
  /** What this drawing is not. The dataset's own note, when it has one, is placed before this. */
  limits: string;
};

export type EpisodeContextSpec = {
  preview?: DataPreviewSpec;
  schematic?: Schematic;
};

const choleraToxin: Schematic = {
  id: "cholera-toxin",
  title: "How cholera toxin acts on an intestinal cell",
  steps: [
    {
      label: "Bind",
      detail:
        "Five B subunits bind GM1 ganglioside on the surface of a cell in the small intestine.",
    },
    {
      label: "Lock the switch",
      detail:
        "The A1 piece ADP-ribosylates Gs, a protein that turns adenylate cyclase on, and leaves that switch stuck on.",
    },
    {
      label: "Salt and water leave",
      detail:
        "Cyclic AMP stays high. The cell secretes chloride and takes up less sodium, and water follows. That is the watery diarrhea.",
    },
  ],
  caption: "A schematic of that path, not a measurement from one patient or one water sample.",
  limits:
    "Not every Vibrio cholerae strain makes this toxin. The Soho data page is a separate count of deaths John Snow drew. It does not measure this mechanism. The toxin genes are carried by a filamentous phage.",
  sources: [
    {
      label:
        "Holmgren, Lönnroth and Svennerholm, Tissue receptor for cholera exotoxin, Infection and Immunity (1973)",
      href: "https://doi.org/10.1128/iai.8.2.208-214.1973",
    },
    {
      label:
        "Gill and Meren, ADP-ribosylation of membrane proteins catalyzed by cholera toxin, PNAS (1978)",
      href: "https://doi.org/10.1073/pnas.75.7.3050",
    },
    {
      label:
        "Field, Intestinal ion transport and the pathophysiology of diarrhea, Journal of Clinical Investigation (2003)",
      href: "https://doi.org/10.1172/JCI18326",
    },
    {
      label:
        "Waldor and Mekalanos, Lysogenic conversion by a filamentous phage encoding cholera toxin, Science (1996)",
      href: "https://doi.org/10.1126/science.272.5270.1910",
    },
  ],
  links: [
    {
      href: "/antitoxin-togo-please#diphtheria-phage",
      text: "Diphtheria toxin is carried by a phage too. That schematic is on Antitoxin Togo, Please.",
    },
  ],
};

const diphtheria: Schematic = {
  id: "diphtheria-phage",
  title: "Phage-carried diphtheria toxin",
  steps: [
    {
      label: "The phage",
      detail:
        "Corynebacterium diphtheriae makes diphtheria toxin when a bacteriophage, corynephage beta, is integrated and brings the tox gene. A strain without that phage does not make the toxin.",
    },
    {
      label: "Binding",
      detail:
        "The toxin is in two parts. The B part binds a receptor on the cell, the precursor of heparin-binding EGF-like growth factor.",
    },
    {
      label: "Protein synthesis stops",
      detail: "The A part ADP-ribosylates elongation factor 2, and the cell stops making protein.",
    },
  ],
  caption: "A schematic of lysogeny and of the toxin's effect on a cell.",
  limits:
    "This is not the 1925 serum run, and it is not a vaccination schedule. It does not say how a person should be treated.",
  sources: [
    {
      label:
        "Freeman, Studies on the virulence of bacteriophage-infected strains of Corynebacterium diphtheriae, Journal of Bacteriology (1951)",
      href: "https://doi.org/10.1128/jb.61.6.675-688.1951",
    },
    {
      label:
        "Holmes, Biology and molecular epidemiology of diphtheria toxin and the tox gene, Journal of Infectious Diseases (2000)",
      href: "https://doi.org/10.1086/315554",
    },
    {
      label:
        "Naglich, Metherall, Russell and Eidels, Expression cloning of a diphtheria toxin receptor, Cell (1992)",
      href: "https://doi.org/10.1016/0092-8674(92)90623-k",
    },
    {
      label: "Collier, Understanding the mode of action of diphtheria toxin, Toxicon (2001)",
      href: "https://doi.org/10.1016/s0041-0101(01)00165-9",
    },
  ],
  links: [
    {
      href: "/confessions-of-a-cholera-girl#cholera-toxin",
      text: "Cholera toxin is carried by a phage too. That schematic is on Confessions of a Cholera Girl.",
    },
  ],
};

/** Published episode slug to the context the page may show. Absent slugs get nothing. */
export const EPISODE_CONTEXT: Record<string, EpisodeContextSpec> = {
  // On the Right Taq
  "on-the-right-taq": {
    schematic: {
      id: "pcr-cycle",
      title: "One cycle of PCR",
      steps: [
        {
          label: "Denature",
          detail: "Heat separates the two strands of the target DNA.",
        },
        {
          label: "Anneal",
          detail:
            "Short primers bind those strands. The temperature that works depends on the primers.",
        },
        {
          label: "Extend",
          detail:
            "Taq polymerase copies each strand. The enzyme, from Thermus aquaticus, stays active through the hot step, so it does not have to be added again each cycle.",
        },
        {
          label: "Repeat",
          detail:
            "The copies can become templates too. In principle the target can double each cycle. A real reaction does not do that all the way through.",
        },
      ],
      caption: "A schematic of the order of the steps.",
      limits:
        "This is not a temperature protocol and not a count of product. How many cycles a reaction needs, and the annealing temperature, depend on the primers and the sample, which are not shown.",
      sources: [
        {
          label:
            "Saiki, Gelfand, Stoffel and colleagues, Primer-directed enzymatic amplification of DNA with a thermostable DNA polymerase, Science (1988)",
          href: "https://doi.org/10.1126/science.2448875",
        },
        {
          label:
            "Chien, Edgar and Trela, Deoxyribonucleic acid polymerase from the extreme thermophile Thermus aquaticus, Journal of Bacteriology (1976)",
          href: "https://doi.org/10.1128/jb.127.3.1550-1557.1976",
        },
        {
          label:
            "Mullis and Faloona, Specific synthesis of DNA in vitro via a polymerase-catalyzed chain reaction, Methods in Enzymology (1987)",
          href: "https://doi.org/10.1016/0076-6879(87)55023-6",
        },
      ],
      links: [],
    },
  },
  // Confessions of a Cholera Girl
  "confessions-of-a-cholera-girl": {
    preview: {
      id: "cholera-deaths-preview",
      dataset: "cholera-soho-1854",
      series: 1,
      limits:
        "The line above is only the daily deaths in that table. It is not the map, and it is not evidence that the Broad Street pump caused the deaths. The map and the street table stay on the data page.",
    },
    schematic: choleraToxin,
  },
  // One Flew Over The Kuru Nest
  "one-flew-over-the-kuru-nest": {
    schematic: {
      id: "prion-templating",
      title: "Prion templating",
      steps: [
        {
          label: "The cell's protein",
          detail: "Cells make the prion protein in a form called PrPC.",
        },
        {
          label: "A template",
          detail:
            "The disease-associated form, PrPSc, can bind PrPC and favor its refolding into more PrPSc.",
        },
        {
          label: "The shape carries on",
          detail:
            "That templating can spread the misfolded form. Kuru is a human disease of this kind, among the Fore people and their neighbors in the highlands of Papua New Guinea, and it was transmitted experimentally.",
        },
      ],
      caption: "A schematic of templating. Kuru is named as the human disease.",
      limits:
        "This is not a measured structure of PrPSc, and it does not show how the misfolded protein injures the brain. That question is not settled here.",
      sources: [
        {
          label: "Prusiner, Novel proteinaceous infectious particles cause scrapie, Science (1982)",
          href: "https://doi.org/10.1126/science.6801762",
        },
        {
          label:
            "Gajdusek, Gibbs and Alpers, Experimental transmission of a kuru-like syndrome to chimpanzees, Nature (1966)",
          href: "https://doi.org/10.1038/209794a0",
        },
        {
          label:
            "Alpers, The epidemiology of kuru: monitoring the epidemic from its peak to its end, Philosophical Transactions of the Royal Society B (2008)",
          href: "https://doi.org/10.1098/rstb.2008.0071",
        },
      ],
      links: [],
    },
  },
  // A Boy Named Flu
  "a-boy-named-flu": {
    preview: {
      id: "influenza-deaths-preview",
      dataset: "influenza-1918",
      series: 0,
      limits:
        "The line is deaths certified to influenza, not cases. It does not show how easily each wave spread, or how hard the illness was for each person who had it. The dated chart and the wave table stay on the data page.",
    },
  },
  // Rabies Day Out
  "rabies-day-out": {
    schematic: {
      id: "rabies-spread",
      title: "How rabies virus moves through the body",
      steps: [
        {
          label: "Entry",
          detail: "Virus in saliva enters through a bite, into muscle or a peripheral nerve.",
        },
        {
          label: "Toward the center",
          detail: "It moves back along the nerve to the spinal cord and the brain.",
        },
        {
          label: "Outward again",
          detail:
            "From the central nervous system it can spread to other tissues, including the salivary glands.",
        },
      ],
      caption: "A schematic of that path.",
      limits:
        "How long this takes varies, and which molecules the virus uses to enter a nerve are still argued, so no receptor is named here. Once the virus has reached the central nervous system and symptoms have begun, rabies is fatal. This figure does not say what anyone should do after a bite.",
      sources: [
        {
          label:
            "Fooks, Cliquet, Finke and colleagues, Rabies, Nature Reviews Disease Primers (2017)",
          href: "https://doi.org/10.1038/nrdp.2017.91",
        },
        {
          label:
            "Davis, Rall and Schnell, Everything you always wanted to know about rabies virus, Annual Review of Virology (2015)",
          href: "https://doi.org/10.1146/annurev-virology-100114-055157",
        },
        {
          label: "World Health Organization, Rabies fact sheet",
          href: "https://www.who.int/news-room/fact-sheets/detail/rabies",
        },
      ],
      links: [],
    },
  },
  // Hell on Weils
  "hell-on-weils": {
    schematic: {
      id: "leptospira-cycle",
      title: "Leptospirosis: reservoir, environment, exposure",
      steps: [
        {
          label: "Reservoir",
          detail:
            "Infected mammals, rats in particular, can carry Leptospira in the tubules of the kidney.",
        },
        {
          label: "Out in the environment",
          detail:
            "They shed the bacteria in urine. The bacteria can remain in fresh water and wet soil. How long depends on the conditions, which this figure does not measure.",
        },
        {
          label: "Exposure",
          detail:
            "A person meets them when that water or soil contacts broken skin or a mucous membrane.",
        },
        {
          label: "Illness",
          detail:
            "Some people do not become ill. Weil's disease is a severe form, with jaundice and injury to the kidneys and liver.",
        },
      ],
      caption: "A schematic of the cycle.",
      limits:
        "Not every exposure infects, and not every infection is severe. This figure is not a risk score, and it is not advice about a flood, a wound, or treatment.",
      sources: [
        {
          label: "Levett, Leptospirosis, Clinical Microbiology Reviews (2001)",
          href: "https://doi.org/10.1128/CMR.14.2.296-326.2001",
        },
        {
          label:
            "Haake and Levett, Leptospirosis in humans, Current Topics in Microbiology and Immunology (2014)",
          href: "https://doi.org/10.1007/978-3-662-45059-8_5",
        },
        {
          label: "Centers for Disease Control and Prevention, About leptospirosis",
          href: "https://www.cdc.gov/leptospirosis/about/index.html",
        },
      ],
      links: [],
    },
  },
  // Antitoxin Togo, Please
  "antitoxin-togo-please": { schematic: diphtheria },
};

export type DataPreviewView = {
  id: string;
  title: string;
  /** The checked description of the series this line draws. */
  alt: string;
  limits: string;
  source: Citation;
  href: string;
  /** Inline Enarratio sparkline. The visible sentences are the text alternative, so the SVG is hidden from assistive tech. */
  svg: string;
};

export type EpisodeContextView = {
  preview: DataPreviewView | null;
  schematic: Schematic | null;
};
