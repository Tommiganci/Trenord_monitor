# 🚆 Trenord Live Monitor

Un sistema in Python per monitorare in tempo reale lo stato di servizio, i ritardi e l'affidabilità delle direttrici ferroviarie Trenord. 

Il progetto scarica i dati dall'API pubblica di Viaggiatreno in modo parallelo (multithread), rileva le anomalie critiche (soppressioni, ritardi gravi al capolinea, corse limitate) e calcola il **Grado di Disagio** giornaliero e mensile. I dati storici vengono salvati in formato JSON e possono essere visualizzati sia da un **bollettino interattivo da terminale** che da una **dashboard web moderna**.

---

## 🌟 Funzionalità principali

- **Scansione Parallela Multithread**: Monitora decine di treni contemporaneamente in pochissimi secondi grazie a `ThreadPoolExecutor`.
- **Rilevamento Anomalie Avanzato**: Calcola lo stato del treno (`REGOLARE`, `RITARDO`, `SOPPRESSO`, `PARZ. SOPPRESSO`, `LIMITATO`, `INATTIVO`) incrociando i provvedimenti ufficiali e l'elenco delle stazioni effettivamente raggiunte.
- **Grado di Disagio**: Calcola in tempo reale la percentuale di treni anomali/critici (treno con ritardo al capolinea > 15 minuti o soppressione/limitazione).
- **Dashboard Web Interattiva**: Un'applicazione Flask con grafici mensili dell'andamento dei disagi e storici individuali per ogni singolo treno (tramite Chart.js).
- **Esportazione Statica**: Possibilità di esportare una dashboard HTML interattiva e autonoma (senza server Flask attivo), ideale per l'hosting gratuito su **GitHub Pages**.
- **Archiviazione Automatica**: Uno script dedicato organizza e archivia i vecchi database JSON dei mesi passati per mantenere pulita la cartella dei dati attivi.

---

## 📁 Struttura del Progetto

Il codice è organizzato nei seguenti file principali:

*   📄 [monitor.py](monitor.py): Il motore di scansione. Legge le direttrici, effettua le chiamate API parallele, calcola gli stati e unisce i nuovi dati con quelli pregressi nel database giornaliero JSON.
*   📄 [bollettino.py](bollettino.py): Tool a riga di comando per visualizzare i report giornalieri e mensili. Gestisce anche l'esportazione in HTML statico.
*   📄 [web_app.py](web_app.py): Server web locale Flask che espone API REST per i dati in tempo reale e per i grafici storici.
*   📄 [archive.py](archive.py): Script di manutenzione per archiviare i file JSON dei mesi precedenti in sottocartelle dedicate.
*   📁 [direttrici/](direttrici): Directory contenente i file di testo (`.txt`) che definiscono le direttrici e i numeri dei treni da monitorare.
*   📁 [templates/](templates): Contiene `index.html`, il template HTML/JavaScript della dashboard.
*   📁 [data/](data): Cartella in cui vengono memorizzati i database giornalieri JSON (es. `database_totale_2026-05-26.json`).
*   📁 [docs/](docs): Cartella di destinazione per l'esportazione statica (es. per GitHub Pages).

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
Per evitare che la cartella `data/` si riempia di troppi file rallentando le letture, esegui periodicamente lo script di archiviazione (ad esempio a inizio mese):

```bash
python archive.py
```
Questo sposterà i file JSON dei mesi passati dentro `data/archive/YYYY-MM/`.

---

## 📊 Calcolo del Grado di Disagio
Il **Grado di Disagio** è l'indicatore principale utilizzato dalla dashboard per riassumere lo stato della linea:
$$\text{Grado di Disagio (\%)} = \frac{\text{Numero di Treni Critici}}{\text{Numero Totale di Treni Monitorati}} \times 100$$

Un treno viene contrassegnato come **Critico** (`critico = True`) quando si verifica una delle seguenti condizioni:
1. Lo stato del treno è `SOPPRESSO` (cancellazione totale della corsa).
2. Lo stato del treno è `LIMITATO` (il treno non parte o non arriva nelle stazioni capolinea prestabilite).
3. Il ritardo registrato all'arrivo al capolinea è **superiore a 15 minuti** (`ritardo_capolinea > 15`).

Attualmente le direttrici monitorate in modo ottimale sono: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 21, 23, 24, 27, 28, 32, 33, 37, 39, 40.

Le ulteriori direttrici aggiunge consiglio di non prenderle troppo in considerazione in quanto potrebbero mancare dei giorni, verificate sempre il conteggio dei giorni sotto a Storico affidabilità mensile.

Le direttrici 26 (Novara - Mortara) e 29 (Voghera - Piacenza) non sono ancora comprese in quanto la decifrazione delle tabelle orarie è complicata. Se qualcuno volesse darmi una mano mi contatti pure.

Lo stato di progresso è consultabile nel foglio excel nella cartella `direttrici`

**Se riscontrate problemi soprattutto sulla popolazione dei treni non esistate a contattarmi** (vedete in basso al sito https://tommiganci.github.io/Trenord_monitor/)

