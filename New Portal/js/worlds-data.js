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
    link: "#"
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
    link: "#"
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
    link: "#"
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
    link: "#"
  },
  {
    id: "data-entry",
    name: "Data Entry",
    category: "analytics",
    titleHtml: "Data <span>Entry</span>",
    cta: "Open Data Entry",
    accent: "#4FA0AC",
    accent2: "#7BCBD4",
    backgroundType: "database",
    logo: "assets/gli-data-entry.png",
    link: "#"
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
  }
];

/** Prodotto mostrato all'apertura (se non c'è ?w=). */
const NEXUS_WORLDS_START = "cortana";
