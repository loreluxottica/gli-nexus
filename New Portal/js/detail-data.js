/* ============================================================
   GLI NEXUS — Detail View · contenuti delle schede prodotto
   Usato da index.html. `js/worlds-data.js` resta la fonte di
   verità per roster, accenti, loghi e sfondi.

   IMPOSTAZIONE — la card parla a chi il tool NON lo conosce.
   Nell'ordine in cui si legge:
     problem   il dolore in cui l'utente si riconosce
     answer    cosa fa, una frase
     shift     prima → dopo, con un numero (la prova)
     io        cosa entra / cosa esce
     connects  id di altri prodotti GLI a cui si collega
     fitFor    "ti serve se…" — auto-selezione in 2 secondi
     steps[]   lo scenario in 4 passi (titolo + didascalia)
     team      chi lo ha costruito = chi contattare

   La demo a destra è uno slider di screenshot: un pannello per
   ogni step. Se lo step ha `shot: "assets/…"` mostra l'immagine,
   altrimenti detail.js genera un segnaposto stilizzato.

   ⚠️ SEGNAPOSTO da sostituire con i dati reali: nomi in `team`,
   numeri in `shift`/`meta`, testi `problem` e `answer`. Servono
   a mostrare il formato, non sono ufficiali.

   PREVIEW — due modalità, si sceglie per prodotto:
     (default)   slider di screenshot: ogni step può avere
                 shot: "assets/x.png" (senza shot → segnaposto)
     kind:"video" video muto in loop: video: "assets/x.mp4"
                  (caricato SOLO all'apertura della card)
   ============================================================ */

const NEXUS_DETAILS = {

  /* ========================================================== */
  cortana: {
    kicker: "Conversational AI",
    tagline: "Chiedi alla supply chain, in italiano.",

    problem: "Per sapere quali lane sono fuori SLA questa settimana apri un ticket, e la risposta arriva quando la call è già finita.",
    answer: "Cortana risponde alla domanda direttamente, cercando lei nei sistemi e citando da dove ha preso il numero.",

    shift: {
      before: { label: "Prima", metric: "2 giorni", text: "ticket al team dati, attesa, estrazione manuale" },
      after:  { label: "Con Cortana", metric: "30 secondi", text: "domanda in chat, risposta con fonte e link al dettaglio" }
    },

    io: {
      in:  ["Domanda in linguaggio naturale"],
      out: ["Numero + fonte citata", "Bozza di comunicazione"]
    },
    connects: ["galileo", "laplace"],
    fitFor: "ti fanno domande sui numeri più in fretta di quanto tu riesca a estrarli.",

    meta: [
      { label: "Stato", value: "Live" },
      { label: "Dal", value: "2024" },
      { label: "Utenti", value: "340+" }
    ],
    team: [
      { name: "Marco R.", role: "Product Owner" },
      { name: "Giulia F.", role: "AI Engineer" },
      { name: "Davide T.", role: "Backend" },
      { name: "Sara L.", role: "UX Design" }
    ],

    preview: {
      note: "Segnaposto dimostrativo: qui scorreranno gli screenshot reali del prodotto.",
      steps: [
        { title: "Fai la domanda",      caption: "In italiano, come la diresti a un collega. Nessuna sintassi da imparare." },
        { title: "Cerca lei nei sistemi", caption: "Interroga SAP, TMS, WMS e Galileo insieme: tu non scegli dove guardare." },
        { title: "Risponde con la fonte", caption: "Il numero arriva con il sistema e la tabella da cui viene. Verificabile." },
        { title: "E poi agisce",          caption: "Dalla risposta alla bozza di escalation, senza cambiare finestra." }
      ]
    }
  },

  /* ========================================================== */
  galileo: {
    kicker: "Reporting Platform",
    tagline: "Il report che si fa da solo, sempre uguale a sé stesso.",

    problem: "Ogni lunedì qualcuno rifà a mano lo stesso pacchetto di export, e due persone che chiedono lo stesso KPI ottengono due numeri diversi.",
    answer: "Galileo definisce una volta metrica, perimetro e cadenza: il report si costruisce e si distribuisce da solo.",

    shift: {
      before: { label: "Prima", metric: "4 ore / sett.", text: "export manuali, impaginazione, invio a mano" },
      after:  { label: "Con Galileo", metric: "0", text: "parte da solo, stessa definizione di KPI per tutti" }
    },

    io: {
      in:  ["Sorgenti dati certificate", "Definizione di KPI e perimetro"],
      out: ["Pacchetto impaginato", "Distribuzione schedulata"]
    },
    connects: ["kelly", "prism", "cortana"],
    fitFor: "produci ricorrentemente lo stesso report, o se litighi su quale numero sia quello giusto.",

    meta: [
      { label: "Stato", value: "Live" },
      { label: "Dal", value: "2023" },
      { label: "Report", value: "60+" }
    ],
    team: [
      { name: "Elena P.", role: "Product Owner" },
      { name: "Andrea C.", role: "Data Engineer" },
      { name: "Luca M.", role: "Analytics" }
    ],

    preview: {
      note: "Segnaposto dimostrativo: qui scorreranno gli screenshot reali del prodotto.",
      steps: [
        { title: "Scegli il pacchetto",   caption: "I pacchetti sono versionati: sai sempre quale definizione stai guardando." },
        { title: "I KPI sono già decisi", caption: "Metrica e perimetro vivono nel pacchetto, non nella testa di chi lo fa." },
        { title: "Si costruisce",         caption: "Stesse fonti, stesso calcolo, ogni volta. Nessun copia-incolla." },
        { title: "Parte da solo",         caption: "Cadenza e destinatari sono parte del report, non un promemoria in agenda." }
      ]
    }
  },

  /* ========================================================== */
  kelly: {
    kicker: "Demand Forecasting",
    tagline: "La previsione, e quanto fidarsi della previsione.",

    problem: "La previsione arriva come un numero secco. Nessuno sa se sia solida o un tiro a caso, così finisce che ci si affida all'istinto.",
    answer: "Kelly consegna la previsione con la sua banda di incertezza e segnala da sola cosa si sta muovendo in modo anomalo.",

    shift: {
      before: { label: "Prima", metric: "1 numero", text: "previsione senza margine, decisa a occhio" },
      after:  { label: "Con Kelly", metric: "±5.4%", text: "intervallo esplicito e anomalie marcate prima della rottura" }
    },

    io: {
      in:  ["Storico ordini", "Segnali di mercato e calendario"],
      out: ["Previsione 12 settimane", "Banda P80 + alert anomalie"]
    },
    connects: ["galileo", "prism"],
    fitFor: "devi impegnare stock o capacità su una domanda che non è ancora arrivata.",

    meta: [
      { label: "Stato", value: "Live" },
      { label: "Dal", value: "2024" },
      { label: "Orizzonte", value: "12 sett." }
    ],
    team: [
      { name: "Chiara B.", role: "Product Owner" },
      { name: "Stefano V.", role: "Data Science" },
      { name: "Ilaria N.", role: "Data Science" },
      { name: "Paolo G.", role: "Platform" }
    ],

    preview: {
      note: "Segnaposto dimostrativo: qui scorreranno gli screenshot reali del prodotto.",
      steps: [
        { title: "Parte dallo storico",   caption: "Domanda reale per SKU e mercato, ripulita dagli effetti di calendario." },
        { title: "Proietta 12 settimane", caption: "Il modello gira ogni notte: ogni run resta confrontabile con i precedenti." },
        { title: "Dichiara l'incertezza", caption: "La banda P80 dice dove può finire davvero il numero. È la parte che manca sempre." },
        { title: "Segnala cosa non torna", caption: "Le anomalie vengono marcate prima che diventino rotture di stock." }
      ]
    }
  },

  /* ========================================================== */
  laplace: {
    kicker: "Document Intelligence",
    tagline: "Dal documento al campo, senza riscrivere niente.",

    problem: "Fatture e bolle arrivano come PDF e qualcuno le ribatte a mano nel gestionale. Ogni battuta è un errore possibile che nessuno ricontrolla.",
    answer: "Laplace legge il documento, estrae i campi e tiene il riferimento al punto esatto da cui ciascuno viene.",

    shift: {
      before: { label: "Prima", metric: "6 min / doc", text: "lettura e ribattitura manuale, errori scoperti a valle" },
      after:  { label: "Con Laplace", metric: "12 sec", text: "campi estratti e verificabili, i dubbi vanno in revisione" }
    },

    io: {
      in:  ["PDF e scansioni in arrivo"],
      out: ["Campi strutturati verso i sistemi", "Coda di revisione per i casi incerti"]
    },
    connects: ["data-entry", "cortana"],
    fitFor: "ricevi documenti da fuori e finiscono comunque digitati a mano da qualcuno.",

    meta: [
      { label: "Stato", value: "Live" },
      { label: "Dal", value: "2025" },
      { label: "Doc / mese", value: "12k" }
    ],
    team: [
      { name: "Federico A.", role: "Product Owner" },
      { name: "Martina S.", role: "ML Engineer" },
      { name: "Alessio D.", role: "Backend" }
    ],

    preview: {
      note: "Segnaposto dimostrativo: qui scorreranno gli screenshot reali del prodotto.",
      steps: [
        { title: "Arriva il documento", caption: "Nessun template da configurare: anche fornitori mai visti prima." },
        { title: "Trova i campi",       caption: "Riconosce cosa cerca sul contenuto, non sulla posizione nella pagina." },
        { title: "Mostra da dove viene", caption: "Ogni valore è cliccabile e ti porta alla riga del documento. Niente scatole nere." },
        { title: "Il dubbio non entra",  caption: "Sotto soglia di confidenza il campo va in revisione umana, non nel database." }
      ]
    }
  },

  /* ========================================================== */
  "data-entry": {
    kicker: "Master Data Operations",
    tagline: "L'anagrafica che si controlla mentre la scrivi.",

    problem: "Gli errori di anagrafica saltano fuori settimane dopo, quando il batch notturno scarta l'ordine e nessuno ricorda più chi aveva inserito cosa.",
    answer: "Data Entry fa girare le regole di validazione sul campo, nel momento in cui scrivi, e tiene traccia di ogni modifica.",

    shift: {
      before: { label: "Prima", metric: "3 settimane", text: "errore scoperto dal batch, a valle, senza responsabile" },
      after:  { label: "Con Data Entry", metric: "immediato", text: "la regola blocca il campo mentre lo compili" }
    },

    io: {
      in:  ["Code di lavorazione", "Regole di validazione"],
      out: ["Anagrafica validata", "Storico completo delle modifiche"]
    },
    connects: ["laplace", "galileo"],
    fitFor: "crei o correggi record anagrafici e paghi gli errori molto dopo averli fatti.",

    meta: [
      { label: "Stato", value: "Live" },
      { label: "Dal", value: "2023" },
      { label: "Record / g.", value: "4.5k" }
    ],
    team: [
      { name: "Roberta I.", role: "Product Owner" },
      { name: "Nicola E.", role: "Full Stack" },
      { name: "Silvia Q.", role: "Data Quality" }
    ],

    preview: {
      note: "Segnaposto dimostrativo: qui scorreranno gli screenshot reali del prodotto.",
      steps: [
        { title: "Prendi la coda",     caption: "Le code sono condivise: due persone non lavorano lo stesso record." },
        { title: "Le regole girano",   caption: "Ogni campo è validato mentre lo scrivi, non a fine giornata sul batch." },
        { title: "Si ferma da solo",   caption: "Il record incompleto non prosegue e resta assegnato a qualcuno, non perso." },
        { title: "Tracciato e chiuso", caption: "Chi ha cambiato cosa, quando e perché. Ricostruibile a mesi di distanza." }
      ]
    }
  },

  /* ========================================================== */
  prism: {
    kicker: "Segmentation & Analytics",
    tagline: "Un numero solo, scomposto in tutto quello che contiene.",

    problem: "Il totale è sceso del 2% e la riunione si trasforma in un'ora di ipotesi, perché nessuno riesce ad aprire il numero abbastanza in fretta.",
    answer: "Prism scompone l'aggregato lungo le dimensioni che scegli, finché la variazione ha un nome e un residuo misurabile.",

    shift: {
      before: { label: "Prima", metric: "1 ora di ipotesi", text: "estrazioni successive per tentativi, in riunione" },
      after:  { label: "Con Prism", metric: "3 click", text: "scomposizione salvata e riutilizzabile, residuo esplicito" }
    },

    io: {
      in:  ["Un aggregato e un periodo"],
      out: ["Contributo per segmento", "Vista salvata esportabile"]
    },
    connects: ["galileo", "kelly"],
    fitFor: "ti chiedono \"perché\" davanti a un numero che è già cambiato.",

    meta: [
      { label: "Stato", value: "Beta" },
      { label: "Dal", value: "2026" },
      { label: "Dimensioni", value: "9" }
    ],
    team: [
      { name: "Tommaso Z.", role: "Product Owner" },
      { name: "Beatrice O.", role: "Analytics Engineer" },
      { name: "Matteo H.", role: "Frontend" }
    ],

    preview: {
      note: "Segnaposto dimostrativo: qui scorreranno gli screenshot reali del prodotto.",
      steps: [
        { title: "Parti dall'aggregato", caption: "Il numero che ti hanno messo davanti, come ti è arrivato." },
        { title: "Scegli la dimensione", caption: "Canale, mercato, famiglia: la scomposizione si impila come vuoi tu." },
        { title: "Si apre nei segmenti", caption: "Ogni segmento porta il suo contributo alla variazione, ordinato per peso." },
        { title: "Guarda il residuo",    caption: "Quanto della variazione non è spiegato. È il numero più onesto della schermata." }
      ]
    }
  }
};
