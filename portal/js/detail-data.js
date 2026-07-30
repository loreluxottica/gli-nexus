/* ============================================================
   GLI NEXUS — Detail View · product card content
   Used by index.html. `js/worlds-data.js` remains the source of
   truth for roster, accents, logos and backgrounds.

   FRAMING — the card speaks to people who do NOT know the tool yet.
   In reading order:
     problem   the pain the user recognizes themselves in
     answer    what it does, in one sentence
     shift     before → after, with a number (the proof)
     io        what goes in / what comes out
     connects  ids of other GLI products it links to
     fitFor    "you need this if…" — self-selection in 2 seconds

   MARKUP — problem, answer and fitFor are the three long blocks and
   accept <b> on the phrases that carry the sentence (detail.js writes
   them with innerHTML). They support skim reading: two or three
   anchors per field, not a whole sentence in bold. All other fields
   are plain text.
     steps[]   the 4-step scenario (title + caption)
     team      who built it = who to contact
               [{ name, role, photo? }] — photo is optional;
               without it the UI shows a silhouette placeholder

   The right-side demo is a screenshot slider: one panel per step.
   If the step has `shot: "assets/…"` it shows the image, otherwise
   detail.js generates a styled placeholder.

   CONTENT: Galileo, Kelly, Cortana, Intake and Laplace use texts and
   screenshots from the intakes in `Project Details/` (wording aligned with
   the forms; shell is English so copy is translated from Italian intakes
   where needed). Approval checklists may still be open. Prism remains a
   demo placeholder until official content lands.
   Demo step count is per product (e.g. Intake 3, Laplace 5) — no fixed 4.

   PREVIEW — two modes, chosen per product:
     (default)   screenshot slider: each step may have
                 shot: "assets/x.png" (no shot → placeholder)
     kind:"video" muted loop video: video: "assets/x.mp4"
                  (loaded ONLY when the card opens)
   ============================================================ */

const NEXUS_DETAILS = {

  /* ========================================================== */
  cortana: {
    kicker: "Text to SQL Agents",
    tagline: "Query huge volumes of data, naturally.",

    problem: "To query complex company data you need <b>technical tools or specialist colleagues</b>, which <b>slows analysis and decisions</b>.",
    answer: "Cortana answers directly: it <b>searches the systems</b>, <b>cites the source of the number</b>, and can produce charts or cross-analysis.",

    shift: {
      before: { label: "Before", metric: "2 days", text: "ticket to the data team, waiting, manual extraction" },
      after:  { label: "With Cortana", metric: "30 seconds", text: "question in chat, answer with source and link to detail" }
    },

    io: {
      in:  ["Natural-language question (e.g. “How many pieces did we ship…”)"],
      out: ["Number and sources (SQL query)", "Chart or table"]
    },
    connects: ["laplace"],
    fitFor: "people ask you for numbers <b>faster than you can extract them</b>, or you want to take <b>data-driven decisions more naturally</b>.",

    meta: [
      { label: "Status", value: "Live" },
      { label: "Since", value: "2024" },
      { label: "Calls", value: "400+" }
    ],
    team: [
      { name: "Leonardo Nasso", role: "Product Owner" }
    ],

    preview: {
      note: "Walkthrough assets from the Cortana product-story intake.",
      steps: [
        {
          title: "Data ingestion",
          caption: "SQL Server connections let us attach large logistics datasets in a few moves, ready for the agent.",
          shot: "assets/details/cortana/step-01-data-ingestion.png"
        },
        {
          title: "Ontology layer",
          caption: "Context is what matters: column meaning, domain rules and benchmark queries teach the model what the data is.",
          shot: "assets/details/cortana/step-02-ontology-layer.png"
        },
        {
          title: "Answer with the source",
          caption: "Ask in plain language: the number comes with the system and table it came from — verifiable, with the path the model took.",
          shot: "assets/details/cortana/step-03-answer-with-source.png"
        },
        {
          title: "Agentic mode",
          caption: "Agent mode runs multi-step analysis across datasets and returns charts, tables and reports in a few clicks.",
          shot: "assets/details/cortana/step-04-agentic-mode.png"
        }
      ]
    }
  },

  /* ========================================================== */
  galileo: {
    kicker: "Global Shipment Visibility",
    tagline: "See whether logistics flows follow the economic decisions.",

    problem: "Economic decisions move physical flows, but the volumes live in <b>separate regional extracts</b>: seeing where they moved takes <b>days of manual consolidation</b>.",
    answer: "Galileo brings shipment volumes into <b>one view</b>: by product, origin site and destination area, always <b>against the same period last year</b>.",

    shift: {
      before: { label: "Before", metric: "4 hours per question", text: "every new question meant a new ad hoc extraction, and it went through whoever kept the file" },
      after:  { label: "With Galileo", metric: "minutes", text: "one click on the variance, in self-service: the same answer for everyone who asks" }
    },

    io: {
      in:  ["Shipment extracts from GlobalView, regional views and BOXI", "Site master data and site, product, area mapping rules"],
      out: ["Volumes by product, origin and destination, against last year", "Data filterable by area, market and month, exportable to CSV"]
    },
    connects: ["cortana"],
    fitFor: "you need to know whether <b>an economic decision turned into a real shift in flows</b>, or <b>where a variance in logistics costs comes from</b>.",

    meta: [
      { label: "Status", value: "Live" },
      { label: "Since", value: "2025" },
      { label: "Origin sites", value: "285" }
    ],
    team: [
      { name: "Matteo Mamino", role: "Product Owner" }
    ],

    preview: {
      note: "Walkthrough assets supplied with the Galileo product-story intake.",
      steps: [
        {
          title: "Volumes against last year",
          caption: "The Content table opens on volumes by product family: solid bar this year, ghost bar the same period last year.",
          shot: "assets/details/galileo/step-01-volumes-against-last-year.png"
        },
        {
          title: "Ask why",
          caption: "One click on a variance opens the explanation: monthly trend, the areas driving the move, the sites behind the number.",
          shot: "assets/details/galileo/step-02-ask-why.png"
        },
        {
          title: "Look at coverage",
          caption: "The map shows how much of each area's estimated volume the network already observes, product by product.",
          shot: "assets/details/galileo/step-03-look-at-coverage.png"
        },
        {
          title: "Trace it to the record",
          caption: "Every figure traces back to the source data: records filterable by area, market and product, exportable to CSV.",
          shot: "assets/details/galileo/step-04-trace-it-to-the-record.png"
        }
      ]
    }
  },

  /* ========================================================== */
  kelly: {
    kicker: "Absenteeism Forecasting",
    tagline: "The forecast, and how much to trust the forecast.",

    problem: "Absenteeism is <b>central to capacity management</b>: in increasingly complex contexts, relying on <b>rough estimates or gut feel</b> is not enough.",
    answer: "Kelly delivers the forecast with its <b>uncertainty band</b> and flags on its own <b>what is moving in an unusual way</b>.",

    shift: {
      before: { label: "Before", metric: "Imprecise calculations", text: "Heavy calculation process, with mediocre results" },
      after:  { label: "With Kelly", metric: "A year of forecast in one click", text: "Instant generation of a forecast accurate to 1.x% error" }
    },

    io: {
      in:  ["Absence history", "Calendar (bank holidays, bridge days and more)"],
      out: ["365-week forecast (recommended to use up to 3 months)", "Forecast accuracy"]
    },
    connects: [],
    fitFor: "You need this if you prepare a <b>capacity plan</b>, or more generally you need a forecast for a variable that depends on many others and <b>the calendar is one of the most relevant variables</b>.",

    meta: [
      { label: "Status", value: "Live" },
      { label: "Since", value: "2024" },
      { label: "Warehouse", value: "5" }
    ],
    team: [
      { name: "Muscillo Lorenzo", role: "Developer" },
      { name: "Leonardo Nasso", role: "Project Owner" }
    ],

    preview: {
      note: "Walkthrough built from the assets delivered with the Kelly product card.",
      steps: [
        {
          title: "Start from history",
          caption: "From warehouse absenteeism, a single database is built that goes back years.",
          shot: "assets/details/kelly/step-01-source.png"
        },
        {
          title: "Model training",
          caption: "The machine learning model is trained every day on the latest observations, interpolating the weights of every variable in play.",
          shot: "assets/details/kelly/step-02-open-kelly.png"
        },
        {
          title: "Pick the warehouse",
          caption: "From the globe you select the site to analyze and open the forecast for its operating areas.",
          shot: "assets/details/kelly/step-03-select-warehouse.png"
        },
        {
          title: "Project into the future",
          caption: "The trained model weights are projected forward: the 365-day forecast is ready for every warehouse area.",
          shot: "assets/details/kelly/step-04-view-forecast.png"
        }
      ]
    }
  },

  /* ========================================================== */
  laplace: {
    kicker: "Automated customs audit",
    tagline: "From the document package to customs control, without opening a PDF.",

    problem: "Every shipment generates a package of invoices, AWBs and customs declarations. Checking them all by hand is impossible: you sample, and <b>errors surface in audit</b>.",
    answer: "Laplace reads every package, <b>classifies the documents</b>, checks completeness and consistency with the customs declaration, and sends to review <b>only what does not match</b>.",

    shift: {
      before: { label: "Before", metric: "Sample checks", text: "manual verification on selected packages, errors found in audit" },
      after:  { label: "With Laplace", metric: "100% of packages", text: "every package checked; only anomalies go to review" }
    },

    io: {
      in:  ["Document packages from SFTP: PDFs, scans, email attachments and ZIPs (Italy and United States)"],
      out: ["Recordkeeping and post-entry audit result per package", "Operator review queue and structured data into BI"]
    },
    connects: ["cortana", "data-entry"],
    fitFor: "you receive customs documentation from brokers and suppliers and <b>someone has to check it piece by piece before the audit</b>.",

    meta: [
      { label: "Status", value: "Live" },
      { label: "Since", value: "2025" },
      { label: "Packages / month", value: "5,500" }
    ],
    team: [
      { name: "Leonardo Nasso", role: "Product Owner" },
      { name: "Valentina Rubello", role: "Customs Functional Lead" },
      { name: "Lorenzo Muscillo", role: "Data & Reporting" }
    ],

    preview: {
      note: "Walkthrough assets from the Laplace product-story intake (5 steps).",
      steps: [
        {
          title: "The package arrives",
          caption: "Email, ZIP and PDF are collected from SFTP, extracted and cleaned with no manual prep.",
          shot: "assets/details/laplace/step-01-package-arrives.png"
        },
        {
          title: "Classify and extract",
          caption: "Recognizes invoice, AWB, customs declaration and certificates, then extracts values, HS code and origin.",
          shot: "assets/details/laplace/step-02-classify-extract.png"
        },
        {
          title: "Check and compare",
          caption: "Verifies mandatory documents and compares extracted data with the official customs declaration.",
          shot: "assets/details/laplace/step-03-check-compare.png"
        },
        {
          title: "Operator certifies",
          caption: "Only packages with anomalies go to review: the operator corrects, comments and certifies.",
          shot: "assets/details/laplace/step-04-operator-certifies.png"
        },
        {
          title: "Data becomes reporting",
          caption: "Every outcome feeds the ops dashboard: package status, certification backlog and AI accuracy, by country.",
          shot: "assets/details/laplace/step-05-becomes-reporting.png"
        }
      ]
    }
  },

  /* ========================================================== */
  "data-entry": {
    kicker: "Master Data Operations",
    tagline: "Master data that checks itself while you write it.",

    problem: "Input errors <b>surface weeks later</b>, when the overnight batch rejects the order and <b>nobody remembers who entered what</b>.",
    answer: "Intake runs validation rules <b>in real time as you type</b>, and keeps a <b>trail of every change</b>.",

    shift: {
      before: { label: "Before", metric: "2 weeks", text: "error found by the batch, downstream, with no owner" },
      after:  { label: "With Intake", metric: "immediate", text: "the rule blocks the field while you fill it in" }
    },

    io: {
      in:  ["Work queues", "Validation rules"],
      out: ["Validated master data", "Full change history"]
    },
    connects: ["galileo", "laplace"],
    fitFor: "you create or fix master data records and <b>pay for the mistakes long after you made them</b>.",

    meta: [
      { label: "Status", value: "Live" },
      { label: "Since", value: "2026" },
      { label: "Source", value: "Manual input" }
    ],
    team: [
      { name: "Lorenzo Muscillo", role: "Full Stack Developer" },
      { name: "Matteo Mamino", role: "Product Owner" }
    ],

    preview: {
      note: "Walkthrough assets from the Intake product-story form (3 steps).",
      steps: [
        {
          title: "Take the queue",
          caption: "Open the site and week queue: open, draft and submitted rows stay shared so two people never work the same record.",
          shot: "assets/details/intake/step-01-take-the-queue.png"
        },
        {
          title: "Rules run live",
          caption: "Enter forecasts by product line with live checks: every field is validated as you type, not at end of day on the batch.",
          shot: "assets/details/intake/step-02-rules-run-live.png"
        },
        {
          title: "It stops itself",
          caption: "Incomplete or read-only rows cannot proceed: the record stays assigned and visible, not lost in the night batch.",
          shot: "assets/details/intake/step-03-stops-itself.png"
        }
      ]
    }
  },

  /* ========================================================== */
  prism: {
    kicker: "Segmentation & Analytics",
    tagline: "One number, broken into everything it holds.",

    problem: "The total is down 2% and the meeting turns into <b>an hour of guesses</b>, because nobody can <b>open the number fast enough</b>.",
    answer: "Prism breaks the aggregate along the dimensions you choose, until the variance has <b>a name</b> and <b>a measurable residual</b>.",

    shift: {
      before: { label: "Before", metric: "1 hour of guesses", text: "successive trial extractions, in the meeting" },
      after:  { label: "With Prism", metric: "3 clicks", text: "saved, reusable breakdown, explicit residual" }
    },

    io: {
      in:  ["An aggregate and a period"],
      out: ["Contribution by segment", "Saved exportable view"]
    },
    connects: ["galileo", "kelly"],
    fitFor: "people ask you \"why\" in front of <b>a number that has already moved</b>.",

    meta: [
      { label: "Status", value: "Beta" },
      { label: "Since", value: "2026" },
      { label: "Dimensions", value: "9" }
    ],
    team: [
      { name: "Tommaso Z.", role: "Product Owner" },
      { name: "Beatrice O.", role: "Analytics Engineer" },
      { name: "Matteo H.", role: "Frontend" }
    ],

    preview: {
      note: "Demo placeholder: real product screenshots will scroll here.",
      steps: [
        { title: "Start from the aggregate", caption: "The number they put in front of you, as it arrived." },
        { title: "Pick the dimension", caption: "Channel, market, family: stack the breakdown however you want." },
        { title: "It opens into segments", caption: "Each segment carries its contribution to the variance, ordered by weight." },
        { title: "Look at the residual",    caption: "How much of the variance is still unexplained. The most honest number on the screen." }
      ]
    }
  }
};
