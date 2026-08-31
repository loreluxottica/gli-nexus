/* ============================================================
   GLI NEXUS — roster prodotti
   Unica fonte di verità per id, nome, categoria, accenti,
   tipo di sfondo, logo e link CTA.

   Aggiungere un prodotto = un oggetto qui + (opzionale)
   scheda in js/detail-data.js. I renderer canvas vivono in
   js/worlds-bg.js (campo backgroundType).
   ============================================================ */

const NEXUS_WORLDS = [
  {
    id: "cortana",
    name: "Cortana",
    category: "ai",
    titleHtml: "Cort<span>ana</span>",
    cta: "Open Cortana",
    accent: "#4C8FD1",
    accent2: "#8FC6FF",
    backgroundType: "ai",
    logo: "assets/gli-cortana.png",
    link: "/cortana/",
    project: "CORTANA"
  },
  {
    id: "galileo",
    name: "Galileo",
    category: "reporting",
    titleHtml: "Gali<span>leo</span>",
    cta: "Open Galileo",
    accent: "#747EC2",
    accent2: "#9AA6E8",
    backgroundType: "cosmic",
    logo: "assets/gli-galileo.png",
    link: "/galileo/",
    project: "GALILEO"
  },
  {
    id: "kelly",
    name: "Kelly",
    category: "ai",
    titleHtml: "Kel<span>ly</span>",
    cta: "Open Kelly",
    accent: "#F5A000",
    accent2: "#FFC24D",
    backgroundType: "forecast",
    logo: "assets/gli-kelly.png",
    link: "/kelly/",
    project: "KELLY"
  },
  {
    id: "laplace",
    name: "Laplace",
    category: "ai",
    titleHtml: "La<span>place</span>",
    cta: "Open Laplace",
    accent: "#5F82E6",
    accent2: "#8FA8F0",
    backgroundType: "docs",
    logo: "assets/gli-laplace.png",
    link: "/laplace/",
    project: "LAPLACEPIPELINE",
    links: [
      { label: "Pipeline Monitor", href: "/laplace/", project: "LAPLACEPIPELINE" },
      {
        label: "Multidocument CT",
        href: "https://laplace-multidocument-cockpit-8661566820370235.15.azure.databricksapps.com/",
        project: "LAPLACEMULTIDOC"
      },
      { label: "Flags Download", href: "/laplace/flags-download", project: "FLAGS" }
    ]
  },
  {
    id: "data-entry",
    name: "Intake",
    category: "analytics",
    titleHtml: "In<span>take</span>",
    cta: "Open Intake",
    accent: "#4FA0AC",
    accent2: "#7BCBD4",
    backgroundType: "database",
    logo: "assets/gli-data-entry.png",
    link: "https://dataretrival-8661566820370235.15.azure.databricksapps.com/",
    project: "VOLUMESDATAENTRY"
  },
  {
    id: "prism",
    name: "Prism",
    category: "analytics",
    titleHtml: "Pri<span>sm</span>",
    cta: "Open Prism",
    accent: "#8B5CF6",
    accent2: "#B79CFF",
    backgroundType: "spectrum",
    logo: "assets/gli-prism.png",
    link: "#"
  },
  {
    id: "lms",
    name: "LMS",
    category: "operationtools",
    titleHtml: "L<span>MS</span>",
    cta: "Open LMS",
    accent: "#E0555F",
    accent2: "#FF9AA2",
    backgroundType: "shift",
    link: "http://10.200.112.48:5058/",
    project: "LMS"
  },
  {
    id: "doppler",
    name: "Doppler",
    category: "operationtools",
    titleHtml: "Dop<span>pler</span>",
    cta: "Open Doppler",
    accent: "#3FA66B",
    accent2: "#7FD9A0",
    backgroundType: "radar",
    link: "http://10.200.112.48:5001/",
    project: "DOPPLER"
  },
  {
    id: "synchro",
    name: "Synchro",
    category: "reporting",
    titleHtml: "Syn<span>chro</span>",
    cta: "Open Synchro",
    accent: "#D65DB1",
    accent2: "#F49AC2",
    backgroundType: "sync",
    link: "http://10.200.112.48:5056/",
    project: "SYNCHRO"
  }
];

/** Prodotto mostrato all'apertura (se non c'è ?w=). */
const NEXUS_WORLDS_START = "cortana";
