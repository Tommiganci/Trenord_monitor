# 🚆 Trenord Live Monitor

Un sistema in Python per monitorare in tempo reale lo stato di servizio, i ritardi e l'affidabilità delle direttrici ferroviarie Trenord. 

Il progetto scarica i dati dall'API pubblica di Viaggiatreno in modo parallelo (multithread), rileva le anomalie critiche (soppressioni, ritardi gravi al capolinea, corse limitate) e calcola il **Grado di Disagio** giornaliero e mensile. I dati storici vengono salvati in formato JSON e possono essere visualizzati sia da un **bollettino interattivo da terminale** che da una **dashboard web moderna**.

---

## 🌟 Funzionalità principali

- **Scansione Parallela Multithread**: Monitora decine di treni contemporaneamente in pochissimi secondi grazie a `ThreadPoolExecutor`.
- **Rilevamento Anomalie Avanzato**: Calcola lo stato del treno (`REGOLARE`, `RITARDO`, `SOPPRESSO`, `PARZ. SOPPRESSO`, `LIMITATO`, `INATTIVO`) incrociando i provvedimenti ufficiali e l'elenco delle stazioni effettivamente raggiunte.
- **Grado di Disagio**: Calcola in tempo reale la percentuale di treni anomali/critici (treno con ritardo al capolinea > 15 minuti o soppressione/limitazione).
- **Dashboard Web Interattiva (PWA)**: Un'applicazione web responsive compatibile con l'installazione PWA, dotata di grafici neon dinamici, filtri rapidi di linea, skeleton loading, navigazione fluida tramite History API e pulsante rapido per tornare in alto.
- **Ricerca Tratte e Affidabilità**: Motore di ricerca per trovare i treni diretti tra stazioni di partenza e arrivo, completo di orari ufficiali e metriche storiche di affidabilità degli ultimi 30 giorni calcolate al volo (Puntualità %, Ritardo Medio, Soppressioni %).
- **Database Storico Compresso (`registro_storico.json`)**: Migrazione da molteplici file JSON giornalieri a un singolo archivio storico compattato con mappatura dei treni, riducendo lo spazio occupato su disco del 90% e velocizzando il caricamento dello storico.
- **Esportazione Statica (anche Client-Side)**: Possibilità di esportare una dashboard HTML interattiva e autonoma (senza server Flask attivo) ospitabile su **GitHub Pages**, che esegue le ricerche e il calcolo delle statistiche interamente client-side tramite il caricamento lazily-loaded di un indice orario compresso (`orari_tratte_compresso.json` di solo 1.2 MB).
- **Archiviazione e Consolidamento Automati**: Lo script `archive.py` organizza e consolida i vecchi database JSON nel registro storico principale eliminando i singoli archivi quotidiani per mantenere pulita la cartella dei dati attivi.


---

## 📁 Struttura del Progetto

Il codice è organizzato nei seguenti file principali:

*   📄 [monitor.py](monitor.py): Il motore di scansione. Legge le direttrici, effettua le chiamate API parallele, calcola gli stati e scrive i nuovi dati nel database giornaliero corrente.
*   📄 [bollettino.py](bollettino.py): Tool a riga di comando per visualizzare i report giornalieri e mensili. Gestisce anche l'esportazione in HTML statico (copiando gli indici orari per la ricerca tratte offline in `docs/data/`).
*   📄 [web_app.py](web_app.py): Server web locale Flask che espone API REST per i dati in tempo reale, per i grafici storici e per il motore di ricerca tratte.
*   📄 [archive.py](archive.py): Script di manutenzione per consolidare i database giornalieri JSON nel registro storico compatto `registro_storico.json` ed eliminare i file temporanei giornalieri.
*   📁 [direttrici/](direttrici): Directory contenente i file di testo (`.txt`) che definiscono le direttrici e i numeri dei treni da monitorare.
*   📁 [templates/](templates): Contiene `index.html`, il template HTML/JavaScript della dashboard.
*   📁 [data/](data): Cartella in cui vengono memorizzati i dati del monitoraggio e gli indici di ricerca:
    *   📄 `registro_storico.json`: Archivio centralizzato e compattato dello storico delle corse (risparmia il 90% di spazio su disco).
    *   📄 `stazioni.json`: Elenco delle stazioni ferroviarie indicizzate per l'autocompletamento.
    *   📄 `orari_tratte_compresso.json`: Tabella oraria compressa (formattata ad array) usata per la ricerca tratte client-side.
    *   📄 `database_totale_YYYY-MM-DD.json`: Dati temporanei della giornata corrente, consolidati alla scansione successiva o a fine giornata.
*   📁 [docs/](docs): Cartella di destinazione per l'esportazione statica autoportante (es. per GitHub Pages).


---

## 🛠️ Requisiti e Installazione

### 1. Prerequisiti
Assicurati di aver installato **Python 3.8** o superiore sul tuo sistema.

### 2. Installazione delle dipendenze
È consigliabile utilizzare un ambiente virtuale per evitare conflitti con altre librerie:

```bash
# Entra nella cartella del progetto
cd monitor_treni

# Crea un ambiente virtuale (chiamato 'venv')
python -m venv venv

# Attiva l'ambiente virtuale:
# Su Windows (Command Prompt):
venv\Scripts\activate
# Su Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Su macOS/Linux:
source venv/bin/activate

# Installa le librerie richieste
pip install -r requirements.txt
```

---

## 🚀 Guida all'Uso

### 1. Eseguire la scansione dei dati (`monitor.py`)
Lo script esegue la scansione istantanea dei treni definiti nelle direttrici. Di norma, viene impostato per girare periodicamente (es. ogni 5 o 10 minuti tramite Cron o Windows Task Scheduler).

```bash
python monitor.py
```
> [!NOTE]
> Puoi controllare il numero di thread paralleli impostando la variabile d'ambiente `MONITOR_THREADS` (il valore predefinito è 6). Ad esempio su Windows PowerShell: `$env:MONITOR_THREADS="10"`. Fate attenzione ai possibili ban di Viaggiatreno

### 2. Visualizzare o Esportare i Report (`bollettino.py`)
Questo script permette di visualizzare i dati registrati direttamente da terminale o esportarli in HTML.

*   **Mostrare il bollettino odierno a terminale**:
    ```bash
    python bollettino.py
    ```
*   **Mostrare il report mensile aggregato**:
    ```bash
    python bollettino.py --monthly
    ```
*   **Esportare la dashboard statica autoportante**:
    Esporta i dati attuali e lo storico in un unico file interattivo salvato in [docs/index.html](docs/index.html).
    ```bash
    python bollettino.py --export-html
    ```

### 3. Avviare la Dashboard Web Dinamica (`web_app.py`)
Se preferisci un server web in esecuzione continua che interroga dinamicamente i file JSON e supporta l'aggiornamento automatico della pagina:

```bash
python web_app.py
```
Una volta avviato, apri il browser all'indirizzo: **`http://localhost:5000`**

### 4. Manutenzione del Database (`archive.py`)
Per evitare che la cartella `data/` si riempia di file duplicati e rallenti le letture dello storico, esegui periodicamente lo script di consolidamento (es. ad ogni nuova scansione o a fine giornata):

```bash
python archive.py
```
Questo consoliderà i dati dei giorni passati nel database compresso `data/registro_storico.json` ed eliminerà i file giornalieri temporanei ormai processati. Lo script mantiene uno storico mobile massimo degli ultimi 12 mesi per preservare le prestazioni.

---

## 🔍 Ricerca Tratte con Indice di Affidabilità

Il sistema include una funzionalità di **Ricerca Orari Intelligente** (da stazione A a stazione B) con il calcolo in tempo reale dell'**Indice di Affidabilità** basato sulle corse effettivamente registrate negli ultimi 30 giorni.

### Funzionamento:
- **Autocompletamento Glassmorphic**: L'interfaccia offre una barra di ricerca stazioni con autocompletamento intelligente, navigazione da tastiera e supporto per la cancellazione rapida. I codici delle stazioni critiche (come Pavia, Cremona, Brescia, Voghera) sono stati mappati e corretti per garantire il tracciamento dei treni.
- **Filtro Orario Flessibile**: Consente di filtrare le soluzioni in due modalità:
  - *Partenza dopo le*: Mostra solo le soluzioni che partono dalla stazione di origine dopo l'orario indicato (ordinate per orario di partenza crescente).
  - *Arrivo entro le*: Mostra solo le soluzioni che arrivano alla stazione di destinazione prima dell'orario indicato (ordinate per orario di arrivo crescente).
- **Ricerca con 1 Cambio (Connessioni/Coincidenze)**: È possibile estendere la ricerca oltre le corse dirette abilitando l'opzione dei cambi. Il sistema calcola l'intersezione delle stazioni raggiungibili per trovare coincidenze ottimali con tempi di attesa sicuri (da 5 a 90 minuti). Ciascun segmento del viaggio (treno 1 e treno 2) mostra le proprie informazioni orarie e statistiche di affidabilità individuali, ed è cliccabile per visualizzare i grafici storici.
- **Calcolo Storico Affidabilità**: Per ogni corsa/segmento trovato, il motore calcola al volo:
  - **Puntualità (%)**: Percentuale di corse arrivate al capolinea con ritardo $\le 5$ minuti.
  - **Ritardo Medio**: Calcolo dei minuti di ritardo accumulati escludendo le soppressioni.
  - **Soppressioni (%)**: Percentuale di corse soppresse, limitate o parzialmente soppresse.
- **Funzionamento Server-Side e Client-Side**:
  - **In locale (Flask)**: Il server calcola le statistiche al volo sul database storico `registro_storico.json`.
  - **Ospitato staticamente (GitHub Pages)**: Per supportare la ricerca senza un backend attivo, lo script di esportazione genera un indice orario compresso (`orari_tratte_compresso.json` di solo 1.2 MB, strutturato in array di dati anziché dizionari per risparmiare fino al 70% di banda mobile). La dashboard scarica l'indice tramite lazy-loading al primo accesso alla scheda ed esegue il matching e i calcoli di coincidenza/statistiche interamente nel browser.

---

## 🚉 Monitora Stazione con Stato Live e Fallback

Il sistema permette di monitorare in tempo reale una specifica stazione ferroviaria (ad esempio, Milano Bovisa Politecnico, Monza, Saronno, ecc.) visualizzando l'elenco completo di tutti i treni in transito programmati per la giornata corrente.

### Caratteristiche principali:
- **Tab Dedicata**: È presente una nuova sezione nell'header chiamata `🚉 Cerca Stazione` accessibile tramite la rotta `?tab=station`.
- **Autocompletamento Istantaneo**: La barra di inserimento stazioni offre l'autocompletamento glassmorphic. Cliccando su una stazione suggerita o premendo Invio, la ricerca parte immediatamente.
- **Formato Tabellare e Stato Live**: I treni in transito sono visualizzati in un elenco tabellare analogo a quello dei dettagli delle direttrici, mostrando colonne chiare: Treno (con icona stella), Stato (badge colorato), Ritardo Attuale, Ritardo Capolinea, Ritardo Picco, Orario di Transito programmato, Percorso (Origine ➔ Destinazione) e Note di servizio.
- **Filtri di Ricerca Avanzati**: Per semplificare la consultazione in stazioni trafficate (con centinaia di treni al giorno), sopra la tabella viene renderizzata una barra dei filtri in tempo reale: un campo di ricerca libera (filtra istantaneamente per numero, linea, origine o destinazione al digitare), due selettori orari ("Dalle" e "Alle", dove "Dalle" si imposta automaticamente sull'ora attuale meno 30 minuti all'avvio della ricerca per mostrare i treni imminenti e in corso), un filtro per lo stato dei treni (tutti, solo attivi, solo con anomalie/ritardo, o solo inattivi) e un tasto Reset per visualizzare l'intera giornata.
- **Fallback Orario Programmato**: Se un treno programmato non è attivo oggi (ad esempio, corse festive o non in servizio), la riga viene visualizzata in semitrasparenza (`opacity: 0.6`) con stato `INATTIVO`. Il percorso (Capolinea di Origine ➔ Capolinea di Destinazione) viene ricostruito dinamicamente in memoria scansionando l'indice orario delle sequenze delle fermate.
- **Interattività Integrata**:
  - **Preferiti Sincronizzati**: È possibile aggiungere o rimuovere il treno dai preferiti direttamente tramite la stella posizionata a sinistra del nome del treno. Il cambio di stato si riflette istantaneamente in tutta l'applicazione (home preferiti, tabella direttrici e modale storica).
  - **Storico e Grafici**: Cliccando su qualsiasi riga della tabella (attiva o inattiva), si apre la modale di analisi storica degli ultimi 30 giorni con i grafici di puntualità e soppressione.

---

## 📱 Miglioramenti UI/UX e PWA

La PWA è stata ottimizzata con moderne tecniche di progettazione dell'interfaccia utente (UI) ed esperienza utente (UX):
- **Stile Dark-Mode e Glassmorphism**: Pulsanti filtro per le linee ridisegnati con badge moderni, menu a discesa trasparenti con sfocatura dello sfondo, e colori semaforici coerenti per gli indici di affidabilità (Verde $\ge 85\%$, Giallo $\ge 70\%$, Rosso $< 70\%$).
- **Grafici Avanzati**: Sostituzione dei grafici standard di Chart.js con grafici personalizzati a gradiente neon sfumato per visualizzare i trend storici dei disagi.
- **Skeleton Screens (Shimmer effect)**: Sostituzione dei semplici caricamenti vuoti con placeholder shimmer per una sensazione di reattività immediata del sistema durante il caricamento dei dati asincroni.
- **Navigazione con History API**: Integrazione dell'History API per mappare i cambi di visualizzazione (es. apertura dettagli direttrice o tab "Ricerca Tratte" con `?tab=search`). In questo modo, l'utente può usare il tasto *Indietro* del browser o dello smartphone per ritornare all'elenco generale delle direttrici anziché uscire dal sito.
- **Pulsante Back-to-Top**: Pulsante flottante che appare automaticamente quando si scorre la pagina per facilitare la risalita rapida dell'utente.
- **Icona SVG per il Ritorno**: Sostituita la freccia unicode per tornare indietro (spesso non visualizzata correttamente su alcuni browser mobili) con un'icona SVG incorporata, garantendo la compatibilità visiva universale.

---

## 📊 Calcolo del Grado di Disagio
Il **Grado di Disagio** è l'indicatore principale utilizzato dalla dashboard per riassumere lo stato della linea:
$$\text{Grado di Disagio (\%)} = \frac{\text{Numero di Treni Critici}}{\text{Numero Totale di Treni Monitorati}} \times 100$$

Un treno viene contrassegnato come **Critico** (`critico = True`) quando si verifica:
1. Lo stato del treno è `SOPPRESSO` (cancellazione totale della corsa).
2. Lo stato del treno è `PARZ. SOPPRESSO` (cancellazione di alcune fermate intermedie).
3. Lo stato del treno è `LIMITATO` (il treno non parte o non arriva nelle stazioni capolinea prestabilite).
4. Il ritardo registrato all'arrivo al capolinea è **superiore a 15 minuti** (`ritardo_capolinea > 15`).

## 📊 Stato del Monitoraggio

Tutte le **38 direttrici ferroviarie** di Trenord (ad esclusione della 13 che è gestita esclusivamente tramite bus sostitutivi e della 38 che non è definita nell'orario ufficiale) sono completamente coperte e monitorate. 

I dati di popolamento delle corse sono estratti e generati automaticamente a partire dal feed orario ufficiale **GTFS statico** di Trenord. Questo ha permesso di completare tutte le relazioni precedentemente escluse o parziali (come le direttrici 26 e 29, e le linee R39, R40, RE13, R32 e la tratta di Brescia-Iseo).

**Note di Mappatura Specifica:**
- **R32 (Mortara - Alessandria)**: incorporata nella direttrice 25 associando le corse R25 (Novara-Mortara-Alessandria).
- **S34 (Brescia - Iseo)**: mappata sulle corse identificate come S31 nel GTFS.
- **R33 (Pavia - Voghera)**: in questa versione dell'orario non è presente come servizio autonomo nel GTFS, ma la tratta Pavia-Voghera è pienamente monitorata tramite i treni della linea **RE13**.

## 🤝 Collaborazione e Segnalazioni

Lo stato di progresso generale è consultabile nel foglio Excel nella cartella `direttrici/`.

**Se riscontrate problemi o discrepanze sui treni monitorati**, non esitate a contattarmi (vedete i contatti in fondo al sito https://tommiganci.github.io/Trenord_monitor/).


---

## ⚖️ Note Legali e Diritti d'Autore

Questo progetto è stato sviluppato a scopo didattico e per uso personale. 

* **Proprietà del Codice e Licenza:** Tutto il codice sorgente, l'architettura e la logica applicativa definiti in questo repository sono di proprietà intellettuale esclusiva dell'autore (**Tommaso Ganci** / **Tommiganci**). È severamente vietato riutilizzare, ridistribuire, modificare o incorporare questo codice per scopi commerciali, di lucro o per qualsiasi altra finalità non concordata senza il preventivo consenso scritto dell'autore.
* **Uso Consentito:** È liberamente consentita la consultazione pubblica dello stato delle linee e del servizio ferroviario tramite il sito web pubblico del progetto.
* **Proprietà dei Dati:** Tutti i dati relativi a treni, orari, stazioni, ritardi e stato del servizio sono di proprietà intellettuale ed esclusiva dei rispettivi gestori ed erogatori del servizio ferroviario (in particolare **Trenord S.r.l.**, **RFI - Rete Ferroviaria Italiana S.p.A.** e il servizio **Viaggiatreno**).
* **Nessuna Affiliazione Ufficiale:** Questo sistema non è in alcun modo affiliato, associato, autorizzato, sponsorizzato o supportato ufficialmente da Trenord S.r.l., RFI, Ferrovie dello Stato Italiane o da una qualsiasi delle loro sussidiarie e affiliate. 
* **Responsabilità:** L'utilizzo delle API pubbliche e dei dati di monitoraggio avviene in conformità con le modalità di consultazione personale destinate agli utenti passeggeri. L'autore non si assume alcuna responsabilità per un eventuale uso improprio dello strumento o per decisioni di viaggio basate sulle informazioni qui mostrate.

