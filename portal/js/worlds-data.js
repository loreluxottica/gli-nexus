/* ============================================================
   GLI NEXUS — Worlds View · configurazione progetti
   Ogni voce è un "mondo": titolo, accento, tipo di sfondo, CTA.
   Aggiungere un progetto = aggiungere un oggetto qui.

   Roster e identità allineati a GLI-Branding/ (fonte di verità):
   ogni prodotto usa il proprio "monolite" (logo beveled, PNG a
   fondo trasparente) e il proprio accento ufficiale dal deck
   GLI Branding Presentation.
   ============================================================ */

const NEXUS_WORLDS = [
  {
    id: "cortana",
    name: "Cortana",
    category: "ai",
    titleHtml: "Cort<span>ana</span>",
    cta: "Open Cortana",
    accent: "#4C8FD1",          // ufficiale (deck branding)
    accent2: "#8FC6FF",
    backgroundType: "ai",       // neural field: rete sinaptica + core luminoso
    logo: "GLI-Branding/assets/web/gli-cortana.png",
    icon: "ai",
    link: "/cortana/",
    project: "CORTANA"          // codice grant (api/my-access, uppercase)
  },
  {
    id: "galileo",
    name: "Galileo",
    category: "reporting",
    titleHtml: "Gali<span>leo</span>",
    cta: "Open Galileo",
    accent: "#747EC2",          // ufficiale (deck branding)
    accent2: "#9AA6E8",
    backgroundType: "cosmic",   // star field + orbits + navigation arcs
    logo: "GLI-Branding/assets/web/gli-galileo.png",
    icon: "orbit",
    link: "/galileo/",
    project: "GALILEO"
  },
  {
    id: "kelly",
    name: "Kelly",
    category: "ai",
    titleHtml: "Kel<span>ly</span>",
    cta: "Open Kelly",
    accent: "#F5A000",          // ufficiale (deck branding)
    accent2: "#FFC24D",
    backgroundType: "forecast", // "previsione mirata": curva di forecast + reticolo target
    logo: "GLI-Branding/assets/web/gli-kelly.png",
    icon: "target",
    link: "/kelly/",
    project: "KELLY"
  },
  {
    id: "laplace",
    name: "Laplace",
    category: "ai",
    titleHtml: "La<span>place</span>",
    cta: "Open Laplace",
    accent: "#5F82E6",          // ufficiale (deck branding)
    accent2: "#8FA8F0",
    backgroundType: "docs",     // document intelligence: documenti + estrazione
    logo: "GLI-Branding/assets/web/gli-laplace.png",
    icon: "docs",
    link: "/laplace/",
    project: "LAPLACEPIPELINE",
    // Laplace ha più destinazioni: la CTA apre un menu a tendina invece di
    // aprire un unico link. Ogni voce ha il proprio grant (accesso indipendente).
    links: [
      { label: "Pipeline Monitor", href: "/laplace/", project: "LAPLACEPIPELINE" },
      { label: "Multidocument CT",
        href: "https://laplace-multidocument-cockpit-8661566820370235.15.azure.databricksapps.com/",
        project: "LAPLACEMULTIDOC" },
      { label: "Flags Download", href: "/laplace/flags-download", project: "FLAGS" }
    ]
  },
  {
    id: "data-entry",
    name: "Data Entry",
    category: "analytics",
    titleHtml: "Data <span>Entry</span>",
    cta: "Open Data Entry",
    accent: "#4FA0AC",          // ufficiale (deck branding)
    accent2: "#7BCBD4",
    backgroundType: "database", // tabelle, righe, celle, connessioni schema
    logo: "GLI-Branding/assets/web/gli-data-entry.png",
    icon: "database",
    link: "https://dataretrival-8661566820370235.15.azure.databricksapps.com/",
    project: "VOLUMESDATAENTRY"
  },
  {
    id: "prism",
    name: "Prism",
    category: "analytics",
    titleHtml: "Pri<span>sm</span>",
    cta: "Open Prism",
    accent: "#8B5CF6",          // viola (monolite Prism)
    accent2: "#B79CFF",
    backgroundType: "spectrum", // fascio di luce che si apre in tutto lo spettro
    logo: "GLI-Branding/assets/web/gli-prism.png",
    icon: "prism",
    link: "#"
  }
];

/* Progetto mostrato all'apertura. */
const NEXUS_WORLDS_START = "cortana";

/* Icone coerenti (viewBox 64×64, stroke 2, round caps).
   Fallback usato solo se un progetto non ha `logo`. */
const NEXUS_WORLD_ICONS = {
  ai: `
    <circle cx="32" cy="32" r="5.5"/>
    <circle cx="32" cy="32" r="13.5" opacity=".55"/>
    <circle cx="32" cy="32" r="21" opacity=".28"/>
    <circle cx="32" cy="11" r="2.4" fill="currentColor" stroke="none"/>
    <circle cx="50.2" cy="42.5" r="2.4" fill="currentColor" stroke="none"/>
    <circle cx="13.8" cy="42.5" r="2.4" fill="currentColor" stroke="none"/>
    <line x1="32" y1="16.6" x2="32" y2="13.4" opacity=".6"/>
    <line x1="43.7" y1="38.7" x2="47.9" y2="41.2" opacity=".6"/>
    <line x1="20.3" y1="38.7" x2="16.1" y2="41.2" opacity=".6"/>`,

  orbit: `
    <circle cx="32" cy="32" r="7.5"/>
    <ellipse cx="32" cy="32" rx="22" ry="9" transform="rotate(-26 32 32)" opacity=".55"/>
    <ellipse cx="32" cy="32" rx="15" ry="21.5" transform="rotate(-26 32 32)" opacity=".28"/>
    <circle cx="50.5" cy="21" r="2.6" fill="currentColor" stroke="none"/>`,

  database: `
    <ellipse cx="32" cy="16" rx="16" ry="6"/>
    <path d="M16 16 V48 A16 6 0 0 0 48 48 V16"/>
    <path d="M16 29 A16 6 0 0 0 48 29" opacity=".6"/>
    <path d="M16 39 A16 6 0 0 0 48 39" opacity=".4"/>`,

  // Kelly — reticolo di target ("previsione mirata")
  target: `
    <circle cx="32" cy="32" r="20" opacity=".4"/>
    <circle cx="32" cy="32" r="12" opacity=".7"/>
    <line x1="32" y1="6" x2="32" y2="16"/>
    <line x1="32" y1="48" x2="32" y2="58"/>
    <line x1="6" y1="32" x2="16" y2="32"/>
    <line x1="48" y1="32" x2="58" y2="32"/>
    <circle cx="32" cy="32" r="3.4" fill="currentColor" stroke="none"/>`,

  // Laplace — documento con riga estratta (eco del glyph brand)
  docs: `
    <path d="M20 10 H38 L48 20 V54 H20 Z"/>
    <path d="M38 10 V20 H48"/>
    <path d="M20 34 H48" opacity=".6"/>
    <circle cx="42" cy="34" r="3" fill="currentColor" stroke="none"/>`,

  // Prism — triangolo con archi di spettro (eco del logo Prism)
  prism: `
    <path d="M32 14 L52 50 H12 Z"/>
    <path d="M27 47 A18 18 0 0 1 39 30" opacity=".85"/>
    <path d="M27 47 A24 24 0 0 1 45 25" opacity=".6"/>
    <path d="M27 47 A30 30 0 0 1 51 21" opacity=".4"/>`
};
