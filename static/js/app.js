/*
 * Trenord Live Monitor
 * Developed by Tommaso Ganci (@Tommiganci)
 * GitHub: https://github.com/Tommiganci/Trenord_monitor
 */
console.log(
    "%c Trenord Live Monitor %c Sviluppato da Tommaso Ganci (@Tommiganci) %c",
    "background:#3b82f6 ; padding: 2px 4px; border-radius: 3px 0 0 3px;  color: #fff; font-weight: bold;",
    "background:#1e293b ; padding: 2px 4px; border-radius: 0 3px 3px 0;  color: #94a3b8;",
    "background:transparent"
);

let myChart = null;
let trendChart = null;
let overallTrendChart = null;

let allTrainsData = []; // Store per i filtri
let currentFilter = 'all';
let currentSearch = '';
let selectedDirettrice = null;

let lastDirettriceMap = {};
let currentDirettriciSearch = '';

let liveDirettriciNews = {};

const DIRETTRICI_CODES = {
  "Direttrice 1 (Novara - Milano Passante - Treviglio)": "D001",
  "Direttrice 10 (Como - Molteno - Lecco)": "D009",
  "Direttrice 11 (Bergamo - Brescia / Lecco - Bergamo)": "D010",
  "Direttrice 12 (Bergamo - Carnate - Milano)": "D011",
  "Direttrice 14 (Bergamo - Treviglio)": "D040",
  "Direttrice 15 (Bergamo - Pioltello \u2013 Milano)": "D012",
  "Direttrice 16 (Cremona - Treviglio)": "D013",
  "Direttrice 17 (Verona - Brescia - Milano / Brescia - Treviglio - Milano)": "D014",
  "Direttrice 18 (Brescia - Parma)": "D015",
  "Direttrice 19 (Brescia - Cremona)": "D016",
  "Direttrice 2 (Saronno - Seregno - Milano - Albairate / Albairate-Milano Rogoredo)": "D038",
  "Direttrice 20 (Mantova - Cremona - Codogno - Milano / Codogno \u2013 Cremona / Cremona - Mantova)": "D017",
  "Direttrice 21 (Piacenza - Lodi - Milano)": "D018",
  "Direttrice 22 (Alessandria - Pavia - Milano / Pavia - Voghera / Pavia - Passante - Bovisa)": "D019",
  "Direttrice 23 (Milano - Pavia - Stradella)": "D020",
  "Direttrice 24 (Pavia - Codogno)": "D021",
  "Direttrice 25 (Mortara - Alessandria / Mortara - Milano)": "D022",
  "Direttrice 26 (Novara - Mortara - Alessandria)": "D022",
  "Direttrice 27 (Pavia - Torreberetti - Alessandria)": "D024",
  "Direttrice 28 (Pavia - Mortara, Vercelli)": "D025",
  "Direttrice 29 (Voghera - Piacenza)": "D026",
  "Direttrice 3 (Domodossola - Milano / Domodossola - Arona - Gallarate - Milano / Laveno \u2013 Sesto Calende)": "D002",
  "Direttrice 30 (Laveno - Varese - Saronno - Milano / Varese - Saronno - Milano)": "D034",
  "Direttrice 31 (Como - Saronno \u2013 Milano)": "D032",
  "Direttrice 32 (Novara - Saronno \u2013 Milano)": "D033",
  "Direttrice 33 (Asso - Milano)": "D035",
  "Direttrice 34 (Brescia - Iseo \u2013 Edolo / Brescia - Iseo - Breno / Rovato - Bornato - Iseo / Brescia - Iseo)": "D028",
  "Direttrice 35 (Gallarate - Malpensa - Milano Centrale / Malpensa - Milano Cadorna)": "D029",
  "Direttrice 36 (Saronno - Passante - Lodi / Saronno - Bovisa - Cadorna / Melegnano-Passante-Bovisa)": "D031",
  "Direttrice 37 (Mariano/Camnago - Milano)": "D036",
  "Direttrice 39 (Lecco - Carnate - Milano P.ta Garibaldi)": "D041",
  "Direttrice 4 (Porto Ceresio - Varese - Gallarate - Milano)": "D003",
  "Direttrice 40 (Varese - Milano Passante - Treviglio)": "D027",
  "Direttrice 42 (Malpensa - Varese - Mendrisio - Como)": "D042",
  "Direttrice 5 (Luino - Gallarate \u2013 Milano / Cadenazzo - Luino - Gallarate)": "D004",
  "Direttrice 6 (Milano - Como - Chiasso)": "D005",
  "Direttrice 7 (Tirano - Sondrio - Lecco - Milano)": "D006",
  "Direttrice 8 (Lecco-Molteno-Monza-Milano)": "D007",
  "Direttrice 9 (Colico - Chiavenna)": "D008"
};

function getDirettriceCode(name) {
    if (!name) return null;
    const clean = name.replace(/\s+/g, ' ').replace(/[\u2013\u2014-]/g, '-').trim();
    for (const key in DIRETTRICI_CODES) {
        const cleanKey = key.replace(/\s+/g, ' ').replace(/[\u2013\u2014-]/g, '-').trim();
        if (clean === cleanKey) {
            return DIRETTRICI_CODES[key];
        }
    }
    return null;
}

function sanitizeNewsText(text) {
    if (!text) return '';
    
    // 1. Converti i caratteri CP1252 non standard
    let clean = '';
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code === 145 || code === 146 || code === 0x2019) {
            clean += "'";
        } else if (code === 147 || code === 148 || code === 0x201c || code === 0x201d) {
            clean += '"';
        } else if (code === 150 || code === 0x2013 || code === 0x2014) {
            clean += '-';
        } else if (code === 149 || code === 0x2022) {
            clean += '•';
        } else {
            clean += text[i];
        }
    }
    
    // 2. Risolvi il carattere jolly \uFFFD basato sul contesto
    let result = '';
    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        if (char === '\uFFFD') {
            const prev = i > 0 ? clean[i-1] : '';
            const next = i < clean.length - 1 ? clean[i+1] : '';
            const prevWord = i >= 4 ? clean.substring(i-4, i).toLowerCase() : '';
            const prevWord3 = i >= 3 ? clean.substring(i-3, i).toLowerCase() : '';
            const prevWord2 = i >= 2 ? clean.substring(i-2, i).toLowerCase() : '';
            
            if (prev === ' ' && next === ' ') {
                result += '-';
            } else if (
                prev.toLowerCase() === 'l' || 
                prev.toLowerCase() === 'd' ||
                prevWord.endsWith('dell') || 
                prevWord.endsWith('sull') || 
                prevWord.endsWith('nell') || 
                prevWord.endsWith('dall') || 
                prevWord.endsWith('all') ||
                prevWord3.endsWith('quest') ||
                prevWord2.endsWith('un') ||
                prevWord.endsWith('anch')
            ) {
                result += "'";
            } else {
                result += '"';
            }
        } else {
            result += char;
        }
    }
    return result;
}

function linkify(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function(url) {
        let cleanUrl = url;
        let suffix = '';
        if (url.endsWith('.') || url.endsWith(',') || url.endsWith(')')) {
            cleanUrl = url.substring(0, url.length - 1);
            suffix = url[url.length - 1];
        }
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="alert-link" style="color: #60a5fa; text-decoration: underline; word-break: break-all; font-weight: 600;">${cleanUrl}</a>${suffix}`;
    });
}

function getTrainWarningBadge(t) {
    if (!t) return '';
    const noteText = (t.note || '').trim();
    const hasWarning = (noteText && noteText !== "INATTIVO" && noteText !== "REGOLARE") || 
                       ["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"].includes(t.stato);
    if (!hasWarning) return '';
    
    const titleText = sanitizeNewsText(noteText || t.stato || "Avviso per questo treno");
    return `<span class="train-alert-icon" title="${titleText.replace(/"/g, '&quot;')}" style="margin-left: 5px; color: #f59e0b; cursor: help; font-size: 0.95em;">⚠️</span>`;
}

async function fetchDirettriceNews() {
    try {
        const res = await fetch('https://infolineemat-tracciamento-tren-3993ebacd280.herokuapp.com/api/direttrici');
        if (res.ok) {
            const data = await res.json();
            const newsMap = {};
            for (const cat of ['critiche', 'ritardi', 'info', 'regolari']) {
                for (const item of (data[cat] || [])) {
                    if (item.nome) {
                        newsMap[item.nome] = item.news || [];
                    }
                }
            }
            liveDirettriciNews = newsMap;
            // Se siamo nella home page, ri-renderizziamo per mostrare gli avvisi
            if (!selectedDirettrice && lastDirettriceMap && Object.keys(lastDirettriceMap).length > 0) {
                renderHomePage(lastDirettriceMap);
            } else if (selectedDirettrice) {
                updateDetailView(selectedDirettrice);
            }
        }
    } catch (e) {
        console.warn("Errore caricamento avvisi direttrici:", e);
    }
}

let currentModalTrainNum = null;
let trainMap = null;
let trainMapMarkers = [];
let trainMapPolyline = null;
let stationCoordinates = null;
let leafletLoaded = false;
let mapResizeObserver = null;

function getLineBadgeHtml(lineName) {
    if (!lineName) return '';
    let s = lineName.trim();
    let badgeColor = '#4b5563'; // Gray 600 default
    let isS = s.startsWith('S') && !s.startsWith('S34') && !s.startsWith('ST');
    let isRE = s.startsWith('RE') || s.startsWith('RV');
    let isR = s.startsWith('R') && !s.startsWith('RE') && !s.startsWith('RV');
    let isMXP = s === 'MXP' || s.includes('Malpensa');

    if (isS) {
        const sNum = s.substring(1);
        const sColors = {
            '1': '#ef4444', // Red
            '2': '#f59e0b', // Yellow/Orange
            '3': '#10b981', // Green
            '4': '#06b6d4', // Cyan
            '5': '#3b82f6', // Blue
            '6': '#8b5cf6', // Purple
            '7': '#84cc16', // Lime
            '8': '#f97316', // Orange
            '9': '#047857', // Forest green
            '11': '#ec4899', // Pink
            '12': '#a855f7', // Lavender
            '13': '#db2777', // Magenta
        };
        badgeColor = sColors[sNum] || '#3b82f6';
    } else if (isRE) {
        badgeColor = '#0284c7'; // Sky Blue
    } else if (isR) {
        badgeColor = '#059669'; // Emerald Green
    } else if (isMXP) {
        badgeColor = '#b91c1c'; // Red
    }

    return `<span class="line-badge" style="background-color: ${badgeColor}; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.72rem; display: inline-block; text-align: center; min-width: 24px; vertical-align: middle; line-height: 1.2;">${s}</span>`;
}

function getLineBadgesListHtml(servizi) {
    if (!servizi || servizi.length === 0) return '';
    return servizi.map(s => getLineBadgeHtml(s)).join(' ');
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase();
    renderTable();
});

const searchDirettriciInput = document.getElementById('searchDirettriciInput');
const clearSearchDirettriciBtn = document.getElementById('clearSearchDirettriciBtn');

if (searchDirettriciInput && clearSearchDirettriciBtn) {
    searchDirettriciInput.addEventListener('input', (e) => {
        currentDirettriciSearch = e.target.value.toLowerCase();
        if (currentDirettriciSearch.length > 0) {
            clearSearchDirettriciBtn.classList.remove('hidden');
        } else {
            clearSearchDirettriciBtn.classList.add('hidden');
        }
        renderHomePage(lastDirettriceMap);
    });

    clearSearchDirettriciBtn.addEventListener('click', () => {
        searchDirettriciInput.value = '';
        currentDirettriciSearch = '';
        clearSearchDirettriciBtn.classList.add('hidden');
        searchDirettriciInput.focus();
        renderHomePage(lastDirettriceMap);
    });
}

function renderStatus(stato, critico) {
    if (stato === "INATTIVO") {
        return `<span class="status-badge" style="background-color:rgba(139, 146, 165, 0.15); color:var(--text-muted)">INATTIVO</span>`;
    }
    if (stato === "RITARDO") {
        if (critico) return `<span class="status-badge status-crit">CRITICO</span>`;
        return `<span class="status-badge status-warn">RITARDO</span>`;
    }
    if (stato !== "REGOLARE") {
        return `<span class="status-badge status-crit">${stato}</span>`;
    }
    return `<span class="status-badge status-ok">REGOLARE</span>`;
}
function updateDashboard() {
    fetchDirettriceNews();
    if (IS_STATIC) {
        renderDashboardData(STATIC_DATA);
        updateOverallStats();
    } else {
        fetch('/api/data')
            .then(res => res.json())
            .then(data => {
                renderDashboardData(data);
                updateOverallStats();
            })
            .catch(err => console.error("Errore fetch dati:", err));
    }
}
function renderMonthlyData(mdata) {
    if (!mdata) return;
    let mEl = document.getElementById('kpi-disagio-mese');
    mEl.innerText = `${mdata.disagio}%`;
    mEl.className = 'kpi-value';
    if (mdata.disagio > 20) mEl.classList.add('disagio-high');
    else if (mdata.disagio > 5) mEl.classList.add('disagio-med');
    else mEl.classList.add('disagio-low');

    // Draw trend chart
    if (mdata.trend && mdata.trend.length > 0) {
        document.getElementById('monthly-chart-container').style.display = 'block';
        const ctx = document.getElementById('trendChart').getContext('2d');
        if (trendChart) trendChart.destroy();

        const gradient = ctx.createLinearGradient(0, 0, 0, 180);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: mdata.trend.map(t => t.data.substring(5)), // Solo MM-DD
                datasets: [{
                    label: 'Disagio %',
                    data: mdata.trend.map(t => t.disagio),
                    borderColor: '#3b82f6',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: mdata.trend.map(t => t.disagio > 20 ? '#ef4444' : (t.disagio > 5 ? '#f59e0b' : '#10b981')),
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1a1d24',
                        titleColor: '#f0f0f0',
                        bodyColor: '#8b92a5',
                        borderColor: '#2e3440',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return ` Disagio: ${context.raw.toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#2e3440' }, ticks: { color: '#8b92a5', callback: v => v + '%' } },
                    x: { grid: { display: false }, ticks: { color: '#8b92a5' } }
                }
            }
        });
    }
}

function renderDailyHistory(trend) {
    if (!trend || trend.length === 0) return;
    const container = document.getElementById('daily-history-container');
    const tbody = document.getElementById('daily-history-table-body');
    container.style.display = 'block';

    const MESI_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                     'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

    function formatMese(key) {
        const parts = key.split('-');
        if (parts.length < 2) return key;
        const m = parseInt(parts[1], 10) - 1;
        return `${MESI_IT[m] || parts[1]} ${parts[0]}`;
    }

    tbody.innerHTML = trend.map((d, idx) => {
        const disagio = d.disagio !== undefined ? d.disagio : 0;
        const colorStyle = disagio > 20 ? 'color: var(--danger); font-weight: 600;'
                         : disagio > 5  ? 'color: var(--warning); font-weight: 600;'
                         :                'color: var(--success);';
        const rowBg = idx % 2 === 0 ? '' : 'background-color: rgba(255,255,255,0.015);';
        const treni = d.treni_totali !== undefined ? d.treni_totali : '-';
        const critici = d.treni_anomali !== undefined ? d.treni_anomali : '-';
        const giorni = d.giorni !== undefined ? d.giorni : '-';
        return `<tr style="${rowBg}">
            <td style="padding: 10px 20px; border-bottom: 1px solid var(--border-color); font-weight: 600;">${formatMese(d.data)}</td>
            <td style="padding: 10px 20px; text-align: right; border-bottom: 1px solid var(--border-color); color: var(--text-muted);">${giorni}</td>
            <td style="padding: 10px 20px; text-align: right; border-bottom: 1px solid var(--border-color);">${treni}</td>
            <td style="padding: 10px 20px; text-align: right; border-bottom: 1px solid var(--border-color);">${critici}</td>
            <td style="padding: 10px 20px; text-align: right; border-bottom: 1px solid var(--border-color); ${colorStyle}">${disagio.toFixed(1)}%</td>
        </tr>`;
    }).join('');

    const rows = tbody.querySelectorAll('tr');
    if (rows.length > 0) {
        rows[rows.length - 1].querySelectorAll('td').forEach(td => td.style.borderBottom = 'none');
    }
}

function toggleDailyHistory() {
    const body = document.getElementById('daily-history-body');
    const icon = document.getElementById('daily-history-toggle-icon');
    if (body.style.display === 'none') {
        body.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        body.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

function renderDashboardData(data) {
    if (!data || data.error) {
        const err = data ? data.error : "Nessun dato";
        document.getElementById('table-body').innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--danger)">${err}</td></tr>`;
        return;
    }

    document.getElementById('last-update').innerText = `Ultimo aggiornamento scansione: ${data.ultima_scansione.replace('T', ' ')}`;

    const treni = Object.values(data.treni || {});

    treni.sort((a, b) => {
        if (a.linea !== b.linea) return a.linea.localeCompare(b.linea);
        return a.numero - b.numero;
    });

    // Normalizza i dati assicurando la presenza del campo direttrice
    treni.forEach(t => {
        if (!t.direttrice) {
            t.direttrice = "Direttrice 6 (Milano - Como - Chiasso)";
        }
    });

    allTrainsData = treni;

    // Calcolo statistiche complessive oggi
    const totaliOggi = treni.length;
    const criticiOggi = treni.filter(t => t.critico && t.stato !== "INATTIVO").length;
    const disagioOggi = totaliOggi > 0 ? (criticiOggi / totaliOggi * 100) : 0;

    const oggiDisagioEl = document.getElementById('overall-kpi-disagio-oggi');
    if (oggiDisagioEl) {
        oggiDisagioEl.innerText = `${disagioOggi.toFixed(1)}%`;
        oggiDisagioEl.className = 'kpi-value';
        if (disagioOggi > 20) oggiDisagioEl.classList.add('disagio-high');
        else if (disagioOggi > 5) oggiDisagioEl.classList.add('disagio-med');
        else oggiDisagioEl.classList.add('disagio-low');
    }
    const oggiDetailsEl = document.getElementById('overall-kpi-details-oggi');
    if (oggiDetailsEl) {
        oggiDetailsEl.innerText = `${criticiOggi} / ${totaliOggi} treni critici`;
    }

    const direttriciMap = {};
    allTrainsData.forEach(t => {
        const dName = t.direttrice;
        if (!direttriciMap[dName]) {
            direttriciMap[dName] = {
                nome: dName,
                treni: [],
                critici: 0,
                totali: 0
            };
        }
        direttriciMap[dName].treni.push(t);
        direttriciMap[dName].totali++;
        if (t.critico && t.stato !== "INATTIVO") {
            direttriciMap[dName].critici++;
        }
    });

    renderHomePage(direttriciMap);

    if (selectedDirettrice) {
        updateDetailView(selectedDirettrice);
        renderTable();
    }
}

// --- PWA Preferiti (Favorites) Logic ---

function getFavDirettrici() {
    return JSON.parse(localStorage.getItem('fav_direttrici') || '[]');
}

function getFavTreni() {
    return JSON.parse(localStorage.getItem('fav_treni') || '[]');
}

function toggleFavDirettrice(event, dirNameEscaped) {
    if (event) event.stopPropagation();
    const dirName = decodeURIComponent(dirNameEscaped);
    let favs = getFavDirettrici();
    const idx = favs.indexOf(dirName);
    if (idx > -1) {
        favs.splice(idx, 1);
    } else {
        favs.push(dirName);
    }
    localStorage.setItem('fav_direttrici', JSON.stringify(favs));
    renderHomePage(lastDirettriceMap);
}

function toggleFavTrain(event, numero) {
    if (event) event.stopPropagation();
    let favs = getFavTreni();
    const idx = favs.indexOf(numero);
    if (idx > -1) {
        favs.splice(idx, 1);
    } else {
        favs.push(numero);
    }
    localStorage.setItem('fav_treni', JSON.stringify(favs));
    
    if (selectedDirettrice) {
        renderTable();
    } else if (lastDirettriceMap) {
        renderHomePage(lastDirettriceMap);
    }
    
    updateModalFavButton(numero);
    
    // Aggiorna tutte le icone stella per questo treno nella pagina
    document.querySelectorAll(`.fav-star-icon-train-${numero}`).forEach(btn => {
        const isFav = favs.includes(numero);
        if (isFav) {
            btn.classList.remove('inactive');
        } else {
            btn.classList.add('inactive');
        }
    });
}


function updateModalFavButton(numero) {
    const btn = document.getElementById('modal-fav-btn');
    if (!btn) return;
    const favs = getFavTreni();
    const isFav = favs.includes(numero);
    if (isFav) {
        btn.classList.remove('inactive');
    } else {
        btn.classList.add('inactive');
    }
    btn.onclick = (event) => toggleFavTrain(event, numero);
}

function renderFavTrainsSection() {
    const favs = getFavTreni();
    const section = document.getElementById('fav-trains-section');
    const grid = document.getElementById('fav-trains-grid');
    if (!section || !grid) return;

    if (favs.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    let html = '';

    favs.forEach(num => {
        const t = allTrainsData.find(x => x.numero === num);
        if (t) {
            const statusBadge = renderStatus(t.stato, t.critico);
            const trenoData = encodeURIComponent(JSON.stringify({
                linea: t.linea,
                numero: t.numero,
                origine: t.origine,
                destinazione: t.destinazione
            }));

            html += `
                <div class="fav-train-card" onclick="openModal('${trenoData}', ${t.numero})">
                    <div class="fav-train-header">
                        <span class="fav-train-name" style="display: flex; align-items: center; gap: 6px;">${getLineBadgeHtml(t.linea)} ${t.numero}${getTrainWarningBadge(t)}</span>
                        <button class="fav-star-icon" onclick="toggleFavTrain(event, ${t.numero}); event.stopPropagation();">★</button>
                    </div>
                    <div class="fav-train-route" title="${t.origine} ➔ ${t.destinazione}">
                        ${t.origine} ➔ ${t.destinazione}
                    </div>
                    <div class="fav-train-status-row">
                        <span>Partenza: <strong>${t.orario_programmato || '--:--'}</strong></span>
                        <span>${statusBadge}</span>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="fav-train-card" style="opacity: 0.6;" onclick="openModal(null, ${num})">
                    <div class="fav-train-header">
                        <span class="fav-train-name">Treno ${num}</span>
                        <button class="fav-star-icon" onclick="toggleFavTrain(event, ${num}); event.stopPropagation();">★</button>
                    </div>
                    <div class="fav-train-route">Stato attuale non disponibile</div>
                    <div class="fav-train-status-row">
                        <span>Non attivo oggi</span>
                        <span class="status-badge" style="background-color:rgba(139, 146, 165, 0.15); color:var(--text-muted)">NON ATTIVO</span>
                    </div>
                </div>
            `;
        }
    });

    grid.innerHTML = html;
}

function renderHomePage(direttriciMap) {
    lastDirettriceMap = direttriciMap;
    renderFavTrainsSection();
    const grid = document.getElementById('direttrici-grid');
    let html = '';
    
    const dirs = Object.values(direttriciMap);
    const favDirettrici = getFavDirettrici();
    
    // Filtro direttrici in base alla ricerca
    const filteredDirs = dirs.filter(dir => {
        if (!currentDirettriciSearch) return true;
        
        const servizi = [...new Set(dir.treni.map(t => t.linea))].filter(Boolean);
        const serviziStr = servizi.join(' / ');
        
        return dir.nome.toLowerCase().includes(currentDirettriciSearch) ||
            serviziStr.toLowerCase().includes(currentDirettriciSearch) ||
            dir.treni.some(t => {
                const numStr = String(t.numero);
                const origStr = (t.origine || '').toLowerCase();
                const destStr = (t.destinazione || '').toLowerCase();
                return numStr.includes(currentDirettriciSearch) || 
                       origStr.includes(currentDirettriciSearch) || 
                       destStr.includes(currentDirettriciSearch);
            });
    });

    if (filteredDirs.length === 0) {
        grid.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); width: 100%; grid-column: 1/-1; padding: 40px;">
                Nessuna direttrice trovata per "${currentDirettriciSearch.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
            </div>
        `;
        return;
    }
    
    // Ordinamento (preferiti prima, poi numerico)
    filteredDirs.sort((a, b) => {
        const isFavA = favDirettrici.includes(a.nome);
        const isFavB = favDirettrici.includes(b.nome);
        if (isFavA && !isFavB) return -1;
        if (!isFavA && isFavB) return 1;

        const numA = parseInt(a.nome.match(/Direttrice\s+(\d+)/)?.[1], 10);
        const numB = parseInt(b.nome.match(/Direttrice\s+(\d+)/)?.[1], 10);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return a.nome.localeCompare(b.nome);
    }).forEach(dir => {
        const disagio = dir.totali > 0 ? ((dir.critici / dir.totali) * 100) : 0;
        
        let indicatorClass = 'indicator-ok';
        if (disagio > 20) {
            indicatorClass = 'indicator-crit';
        } else if (disagio > 5) {
            indicatorClass = 'indicator-warn';
        }
        
        const servizi = [...new Set(dir.treni.map(t => t.linea))].filter(Boolean).sort();
        const serviziStr = servizi.join(' / ');
        const isFav = favDirettrici.includes(dir.nome);
        
        // 1. Cerca avvisi ufficiali della direttrice dall'API di infolineemat
        const code = getDirettriceCode(dir.nome);
        const officialNews = code ? (liveDirettriciNews[code] || []) : [];
        
        // 2. Raccoglie anche le anomalie dei singoli treni (es. soppressioni in tempo reale)
        const treniAnomalie = [];
        dir.treni.forEach(t => {
            let note = (t.note || '').trim();
            if (t.stato === "SOPPRESSO") {
                if (!note || note.toLowerCase() === "treno cancellato" || note.toLowerCase() === "soppresso") {
                    note = "Cancellato";
                }
            } else if (t.stato === "PARZ. SOPPRESSO") {
                if (!note) {
                    note = "Parzialmente cancellato";
                }
            } else if (t.stato === "LIMITATO") {
                if (!note) {
                    note = "Percorso limitato";
                }
            }
            
            if (note && note !== "INATTIVO" && note !== "REGOLARE") {
                treniAnomalie.push({ numero: t.numero, linea: t.linea, nota: note });
            }
        });

        let avvisiHtml = '';
        if (officialNews.length > 0) {
            // Mostra il primo avviso ufficiale della linea
            const firstNews = sanitizeNewsText(officialNews[0].description.split('\n')[0]);
            avvisiHtml = `
                <div class="direttrice-warnings-box" style="border-color: rgba(239, 68, 68, 0.25); background-color: rgba(239, 68, 68, 0.05);">
                    <div class="warnings-summary" style="color: var(--danger);">
                        <span class="warning-alert-icon">🚨</span>
                        <span><strong>AVVISO DI LINEA:</strong></span>
                    </div>
                    <div class="warning-text-preview" style="font-size: 0.76rem; color: var(--text-main); line-height: 1.35; font-weight: 500;">
                        ${firstNews.length > 90 ? firstNews.substring(0, 87) + '...' : firstNews}
                    </div>
                </div>
            `;
        } else if (treniAnomalie.length > 0) {
            // Se non ci sono notizie generali, mostra le anomalie dei singoli treni
            avvisiHtml = `
                <div class="direttrice-warnings-box">
                    <div class="warnings-summary">
                        <span class="warning-alert-icon">⚠️</span>
                        <span><strong>${treniAnomalie.length}</strong> ${treniAnomalie.length === 1 ? 'treno critico' : 'treni critici'}</span>
                    </div>
                    <ul class="warnings-details-list">
                        ${treniAnomalie.slice(0, 2).map(a => `
                            <li>Treno <strong>${a.numero}</strong>: ${a.nota}</li>
                        `).join('')}
                        ${treniAnomalie.length > 2 ? `<li class="more-warnings-indicator">...e altri ${treniAnomalie.length - 2} treni</li>` : ''}
                    </ul>
                </div>
            `;
        }

        html += `
            <div class="direttrice-card" onclick="selectDirettrice('${encodeURIComponent(dir.nome)}')">
                <div class="direttrice-header">
                    <div>
                        <h3 class="direttrice-name">
                            <button class="fav-star-icon ${isFav ? '' : 'inactive'}" 
                                    onclick="toggleFavDirettrice(event, '${encodeURIComponent(dir.nome)}'); event.stopPropagation();" 
                                    style="margin-right: 6px; font-size: 1.1rem;">
                                ★
                            </button>
                            ${dir.nome}
                        </h3>
                        <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">${getLineBadgesListHtml(servizi)}</div>
                    </div>
                    <div class="direttrice-status-indicator ${indicatorClass}"></div>
                </div>
                <div class="direttrice-stats">
                    <div class="stat-item">
                        <span class="stat-val ${disagio > 20 ? 'disagio-high' : (disagio > 5 ? 'disagio-med' : 'disagio-low')}">${disagio.toFixed(1)}%</span>
                        <span class="stat-lbl">Disagio</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-val">${dir.totali}</span>
                        <span class="stat-lbl">Treni Totali</span>
                    </div>
                    <div class="stat-item" style="grid-column: span 2; margin-top: 5px; padding-top: 5px; border-top: 1px dotted var(--border-color); display: flex; flex-direction: row; justify-content: space-between;">
                        <span class="stat-lbl" style="text-transform: none;">Treni critici oggi:</span>
                        <span style="font-weight: 600; color: ${dir.critici > 0 ? 'var(--danger)' : 'var(--success)'};">${dir.critici}</span>
                    </div>
                </div>
                ${avvisiHtml}
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

function selectDirettrice(dirNameEscaped, pushState = true) {
    const dirName = decodeURIComponent(dirNameEscaped);
    selectedDirettrice = dirName;
    currentFilter = 'all'; 
    
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('detail-view').classList.remove('hidden');
    
    document.getElementById('current-direttrice-title').innerText = dirName;
    
    updateDetailView(dirName);
    renderTable();
    
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (pushState) {
        history.pushState({ view: 'detail', direttrice: dirName }, '', `?dir=${encodeURIComponent(dirName)}`);
    }
}

function showHome(pushState = true) {
    selectedDirettrice = null;
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('home-view').classList.remove('hidden');
    
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (pushState) {
        history.pushState({ view: 'home' }, '', window.location.pathname);
    }
}

function updateDetailView(dirName) {
    const dirTreni = allTrainsData.filter(t => t.direttrice === dirName);
    
    // Aggiorna gli avvisi in tempo reale per la direttrice (sia generali da API che anomalie singoli treni)
    const code = getDirettriceCode(dirName);
    const officialNews = code ? (liveDirettriciNews[code] || []) : [];

    const treniAnomalie = [];
    dirTreni.forEach(t => {
        let note = (t.note || '').trim();
        if (t.stato === "SOPPRESSO") {
            if (!note || note.toLowerCase() === "treno cancellato" || note.toLowerCase() === "soppresso") {
                note = "Cancellato";
            }
        } else if (t.stato === "PARZ. SOPPRESSO") {
            if (!note) {
                note = "Parzialmente cancellato";
            }
        } else if (t.stato === "LIMITATO") {
            if (!note) {
                note = "Percorso limitato";
            }
        }
        
        if (note && note !== "INATTIVO" && note !== "REGOLARE") {
            treniAnomalie.push({ numero: t.numero, linea: t.linea, nota: note });
        }
    });

    const alertsContainer = document.getElementById('direttrice-alerts-container');
    if (alertsContainer) {
        if (officialNews.length > 0 || treniAnomalie.length > 0) {
            alertsContainer.classList.remove('hidden');
            
            let html = '';
            
            // 1. Renderizza gli avvisi di linea ufficiali (se presenti)
            if (officialNews.length > 0) {
                html += `
                    <div class="direttrice-alerts-box" style="border-color: rgba(239, 68, 68, 0.25); background-color: rgba(239, 68, 68, 0.05); margin-bottom: 15px;">
                        <div class="alerts-box-header" style="border-bottom-color: rgba(239, 68, 68, 0.15); margin-bottom: 12px; padding-bottom: 8px;">
                            <span class="warning-alert-icon">🚨</span>
                            <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--danger);">AVVISI DI CIRCOLAZIONE UFFICIALI</h4>
                        </div>
                        <div style="white-space: pre-line; font-size: 0.9rem; line-height: 1.5; color: var(--text-main);">
                            ${officialNews.map((n, idx) => `
                                <div style="${idx > 0 ? 'margin-top: 15px; border-top: 1px solid rgba(239, 68, 68, 0.15); padding-top: 15px;' : ''}">
                                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 600;">PUBBLICATO IL: ${new Date(n.date).toLocaleString('it-IT')}</div>
                                    <div>${linkify(sanitizeNewsText(n.description))}</div>
                                </div>
                            `).join('')}
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 15px; border-top: 1px dotted rgba(239, 68, 68, 0.2); padding-top: 8px; font-style: italic; line-height: 1.4;">
                            Nota: Gli avvisi di linea sopra riportati sono riprodotti a scopo informativo dai canali di comunicazione ufficiali di Trenord. Questo sito non ha alcuna affiliazione, controllo o responsabilità riguardo all'accuratezza o tempestività delle informazioni di circolazione fornite.
                        </div>
                    </div>
                `;
            }
            
            // 2. Renderizza le anomalie dei singoli treni (se presenti)
            if (treniAnomalie.length > 0) {
                html += `
                    <div class="direttrice-alerts-box" style="margin-bottom: 0;">
                        <div class="alerts-box-header" style="margin-bottom: 12px; padding-bottom: 8px;">
                            <span class="warning-alert-icon">⚠️</span>
                            <h4 style="margin: 0; font-size: 1.05rem; font-weight: 600; color: #f59e0b;">Treni con variazioni o cancellazioni</h4>
                        </div>
                        <ul class="alerts-details-list">
                            ${treniAnomalie.map(a => `
                                <li>
                                    Treno <strong>${a.numero}</strong> (${a.linea}): ${a.nota}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }
            
            alertsContainer.innerHTML = html;
        } else {
            alertsContainer.classList.add('hidden');
            alertsContainer.innerHTML = '';
        }
    }

    let totali = dirTreni.length;
    let critici = 0;
    dirTreni.forEach(t => { if (t.critico) critici++; });
    
    document.getElementById('kpi-totale').innerText = totali;
    document.getElementById('kpi-critici').innerText = critici;
    
    let disagio = totali > 0 ? ((critici / totali) * 100).toFixed(1) : 0;
    let disagioEl = document.getElementById('kpi-disagio');
    disagioEl.innerText = `${disagio}%`;
    disagioEl.className = 'kpi-value';
    if (disagio > 20) disagioEl.classList.add('disagio-high');
    else if (disagio > 5) disagioEl.classList.add('disagio-med');
    else disagioEl.classList.add('disagio-low');
    
    // Aggiorna dati mensili e storico specifici per questa direttrice
    if (IS_STATIC) {
        const mdata = STATIC_MONTHLY[dirName] || { disagio: 0, trend: [] };
        renderMonthlyData(mdata);
        renderDailyHistory(STATIC_DAILY_TREND[dirName] || []);
    } else {
        fetch(`/api/monthly_stats?direttrice=${encodeURIComponent(dirName)}`)
            .then(res => res.json())
            .then(mdata => {
                renderMonthlyData(mdata);
                fetch(`/api/historical_stats?direttrice=${encodeURIComponent(dirName)}`)
                    .then(res => res.json())
                    .then(history => {
                        renderDailyHistory(history);
                    })
                    .catch(err => {
                        console.error("Errore fetch historical stats:", err);
                        renderDailyHistory([]);
                    });
            })
            .catch(e => console.error("Errore fetch monthly:", e));
    }
    
    const servizi = [...new Set(dirTreni.map(t => t.linea))].filter(Boolean).sort();
    const filterButtonsContainer = document.getElementById('filter-buttons-container');
    
    let buttonsHtml = `<button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Tutti</button>`;
    servizi.forEach(serv => {
        buttonsHtml += `<button class="filter-btn ${currentFilter === serv ? 'active' : ''}" data-filter="${serv}">${serv}</button>`;
    });
    buttonsHtml += `<button class="filter-btn filter-btn-danger ${currentFilter === 'critici' ? 'active' : ''}" data-filter="critici">Solo Critici</button>`;
    
    filterButtonsContainer.innerHTML = buttonsHtml;
    
    document.querySelectorAll('#filter-buttons-container .filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#filter-buttons-container .filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderTable();
        });
    });
}

function renderTable() {
    if (!selectedDirettrice) return;
    
    let tbodyHTML = '';
    let count = 0;
    
    const dirTreni = allTrainsData.filter(t => t.direttrice === selectedDirettrice);

    dirTreni.forEach(t => {
        if (currentFilter !== 'all' && currentFilter !== 'critici' && t.linea !== currentFilter) return;
        if (currentFilter === 'critici' && !t.critico) return;

        if (currentSearch) {
            const searchStr = `${t.linea} ${t.numero} ${t.origine} ${t.destinazione} ${t.stato} ${t.note || ''}`.toLowerCase();
            if (!searchStr.includes(currentSearch)) return;
        }

        count++;

        let ritCapClass = t.ritardo_capolinea > 15 ? 'color: var(--danger); font-weight:bold;' : '';

        const noteRaw = t.note || "";
        let noteHtml = noteRaw;
        if (["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"].includes(t.stato)) {
            noteHtml = `<span class="note-soppresso">${t.stato}</span> <span style="font-size:0.85em; color:var(--text-muted)">${noteRaw}</span>`;
        }

        const trenoData = encodeURIComponent(JSON.stringify({
            linea: t.linea,
            numero: t.numero,
            origine: t.origine,
            destinazione: t.destinazione
        }));

        let trClass = (t.critico && t.stato !== "INATTIVO") ? 'class="row-critico"' : '';
        const favTreni = getFavTreni();
        const isFav = favTreni.includes(t.numero);

        tbodyHTML += `
            <tr ${trClass} onclick="openModal('${trenoData}', ${t.numero})">
                <td>
                    <button class="fav-star-icon ${isFav ? '' : 'inactive'}" 
                            onclick="toggleFavTrain(event, ${t.numero}); event.stopPropagation();" 
                            style="margin-right: 8px;">
                        ★
                    </button>
                    <strong>${getLineBadgeHtml(t.linea)} ${t.numero}${getTrainWarningBadge(t)}</strong>
                </td>
                <td>${renderStatus(t.stato, t.critico)}</td>
                <td>${t.ritardo_attuale}'</td>
                <td style="${ritCapClass}">${t.ritardo_capolinea}'</td>
                <td>${t.ritardo_picco}'</td>
                <td>${t.orario_programmato}</td>
                <td><div class="note-text">${noteHtml || '-'}</div></td>
            </tr>
        `;
    });

    if (count === 0) {
        tbodyHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted)">Nessun treno trovato</td></tr>`;
    }

    document.getElementById('table-body').innerHTML = tbodyHTML;
}

function openModal(trenoDataStr, numero) {
    let t = { linea: '', numero: numero, origine: 'Storico', destinazione: 'Treno' };
    if (trenoDataStr) {
        t = JSON.parse(decodeURIComponent(trenoDataStr));
    } else {
        t.linea = "";
        t.numero = numero;
        t.origine = "Monitoraggio Storico";
        t.destinazione = "";
    }
    
    currentModalTrainNum = t.numero;

    // Reset dello stato della mappa nel modal
    const mapContainer = document.getElementById('modal-map-container');
    if (mapContainer) {
        mapContainer.classList.add('hidden');
    }
    const toggleBtn = document.getElementById('modal-map-toggle-btn');
    if (toggleBtn) {
        toggleBtn.innerText = "🗺️ Visualizza Mappa Percorso & Stato Live";
        toggleBtn.classList.remove('active');
    }
    cleanupMap();
    
    document.getElementById('chartModal').style.display = "flex";
    document.getElementById('modal-treno-title').innerText = `Treno ${t.linea} ${t.numero}`.trim();
    document.getElementById('modal-treno-subtitle').innerText = t.destinazione ? `${t.origine} ➔ ${t.destinazione}` : t.origine;

    // Popola immediatamente il box delle note/avvisi del treno se presenti
    const fullTrain = allTrainsData.find(x => String(x.numero) === String(numero)) || t;
    const noteText = (fullTrain.note || '').trim();
    const isDelayReason = (fullTrain.ritardo_capolinea > 0 || fullTrain.ritardo_attuale > 0);
    const hasNote = (noteText && noteText !== "INATTIVO" && noteText !== "REGOLARE") || 
                  ["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"].includes(fullTrain.stato);
                  
    const noteBox = document.getElementById('modal-train-note-box');
    if (noteBox) {
        if (hasNote) {
            let displayNote = noteText;
            if (["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"].includes(fullTrain.stato) && (!displayNote || displayNote.toLowerCase() === 'treno cancellato')) {
                displayNote = `Stato convoglio: ${fullTrain.stato}`;
            }
            
            const titleText = isDelayReason ? "Motivo del Ritardo / Dettaglio" : "Note di Viaggio / Variazione";
            const titleColor = isDelayReason ? "var(--danger)" : "var(--warning)";
            const borderStyle = isDelayReason ? "border-color: rgba(239, 68, 68, 0.3); background-color: rgba(239, 68, 68, 0.05);" : "border-color: rgba(245, 158, 11, 0.3); background-color: rgba(245, 158, 11, 0.05);";

            noteBox.innerHTML = `
                <div class="live-train-info-box" style="margin-top: 15px; margin-bottom: 15px; ${borderStyle}">
                    <div class="live-train-info-title" style="color: ${titleColor}; font-weight: 700; text-transform: uppercase;">⚠️ ${titleText}</div>
                    <div style="font-size: 0.9rem; color: var(--text-main); font-weight: 500; line-height: 1.4;">${linkify(sanitizeNewsText(displayNote))}</div>
                </div>
            `;
            noteBox.classList.remove('hidden');
        } else {
            noteBox.innerHTML = '';
            noteBox.classList.add('hidden');
        }
    }

    updateModalFavButton(numero);

    if (IS_STATIC) {
        renderChart(STATIC_HISTORY[numero] || []);
    } else {
        fetch(`/api/train_history/${numero}`)
            .then(res => res.json())
            .then(data => renderChart(data.history || []))
            .catch(err => console.error("Errore chart:", err));
    }
}

function renderChart(historyArray) {
    const ctx = document.getElementById('delayChart').getContext('2d');
    if (myChart) myChart.destroy();

    const labels = historyArray.map(h => h.data);
    const delays = historyArray.map(h => h.ritardo_capolinea);
    
    // Generazione dei gradienti dinamici per le singole barre
    const bgGradients = historyArray.map(h => {
        const grad = ctx.createLinearGradient(0, 0, 0, 200);
        if (h.critico) {
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.95)'); // Rosso neon sopra
            grad.addColorStop(1, 'rgba(239, 68, 68, 0.15)'); // Rosso trasparente sotto
        } else {
            grad.addColorStop(0, 'rgba(59, 130, 246, 0.95)'); // Blu neon sopra
            grad.addColorStop(1, 'rgba(59, 130, 246, 0.15)'); // Blu trasparente sotto
        }
        return grad;
    });

    const borderColors = historyArray.map(h => h.critico ? '#ef4444' : '#3b82f6');

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ritardo al capolinea',
                data: delays,
                backgroundColor: bgGradients,
                borderColor: borderColors,
                borderWidth: 1.5,
                borderRadius: 6, // Arrotondamento superiore
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1d24',
                    titleColor: '#f0f0f0',
                    bodyColor: '#8b92a5',
                    borderColor: '#2e3440',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return ` Ritardo: ${context.raw} min`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#2e3440' },
                    ticks: { color: '#8b92a5', callback: v => v + ' min' }
                },
                x: {
                    grid: { color: '#2e3440' },
                    ticks: { color: '#8b92a5' }
                }
            }
        }
    });
}

function closeModal() {
    cleanupMap();
    document.getElementById('chartModal').style.display = "none";
}

function openDisclaimerModal(event) {
    if (event) {
        event.preventDefault();
    }
    document.getElementById('disclaimerModal').style.display = "flex";
}

function closeDisclaimerModal() {
    document.getElementById('disclaimerModal').style.display = "none";
}

// Gestione dei click all'esterno dei modali per la chiusura
document.addEventListener('DOMContentLoaded', () => {
    const chartModal = document.getElementById('chartModal');
    if (chartModal) {
        chartModal.addEventListener('click', function(event) {
            if (event.target === this) {
                event.preventDefault();
                event.stopPropagation();
                closeModal();
            }
        });
    }
    
    const disclaimerModal = document.getElementById('disclaimerModal');
    if (disclaimerModal) {
        disclaimerModal.addEventListener('click', function(event) {
            if (event.target === this) {
                event.preventDefault();
                event.stopPropagation();
                closeDisclaimerModal();
            }
        });
    }
    
    const iosInstallModal = document.getElementById('iosInstallModal');
    if (iosInstallModal) {
        iosInstallModal.addEventListener('click', function(event) {
            if (event.target === this) {
                event.preventDefault();
                event.stopPropagation();
                closeIosModal();
            }
        });
    }
});

function toggleOverallHistory() {
    const body = document.getElementById('overall-history-body');
    const icon = document.getElementById('overall-history-toggle-icon');
    if (body.style.display === 'none') {
        body.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        body.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

function updateOverallStats() {
    if (IS_STATIC) {
        const mdata = STATIC_MONTHLY["Tutto Trenord"] || { disagio: 0, trend: [] };
        const history = STATIC_DAILY_TREND["Tutto Trenord"] || [];
        renderOverallMonthlyData(mdata, history);
    } else {
        fetch('/api/monthly_stats')
            .then(res => res.json())
            .then(mdata => {
                fetch('/api/historical_stats')
                    .then(res => res.json())
                    .then(history => {
                        renderOverallMonthlyData(mdata, history);
                    })
                    .catch(err => {
                        console.error("Errore fetch overall historical stats:", err);
                        renderOverallMonthlyData(mdata, []);
                    });
            })
            .catch(e => console.error("Errore fetch overall monthly:", e));
    }
}

function renderOverallMonthlyData(mdata, history) {
    if (!mdata) return;
    
    // Aggiorna KPI Mese
    let mEl = document.getElementById('overall-kpi-disagio-mese');
    if (mEl) {
        mEl.innerText = `${mdata.disagio}%`;
        mEl.className = 'kpi-value';
        if (mdata.disagio > 20) mEl.classList.add('disagio-high');
        else if (mdata.disagio > 5) mEl.classList.add('disagio-med');
        else mEl.classList.add('disagio-low');
    }
    
    const meseDetailsEl = document.getElementById('overall-kpi-details-mese');
    if (meseDetailsEl) {
        meseDetailsEl.innerText = `${mdata.treni_anomali} / ${mdata.treni_totali} treni critici`;
    }

    // Renderizza Grafico
    if (mdata.trend && mdata.trend.length > 0) {
        const ctx = document.getElementById('overallTrendChart').getContext('2d');
        if (overallTrendChart) overallTrendChart.destroy();

        const gradient = ctx.createLinearGradient(0, 0, 0, 180);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        overallTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: mdata.trend.map(t => t.data.substring(5)), // Solo MM-DD
                datasets: [{
                    label: 'Disagio Complessivo %',
                    data: mdata.trend.map(t => t.disagio),
                    borderColor: '#10b981',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: mdata.trend.map(t => t.disagio > 20 ? '#ef4444' : (t.disagio > 5 ? '#f59e0b' : '#10b981')),
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1a1d24',
                        titleColor: '#f0f0f0',
                        bodyColor: '#8b92a5',
                        borderColor: '#2e3440',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return ` Disagio: ${context.raw.toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#2e3440' }, ticks: { color: '#8b92a5', callback: v => v + '%' } },
                    x: { grid: { display: false }, ticks: { color: '#8b92a5' } }
                }
            }
        });
    }

    // Renderizza Tabella Storico
    if (history && history.length > 0) {
        const tbody = document.getElementById('overall-history-table-body');
        if (!tbody) return;
        
        const MESI_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                         'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

        function formatMese(key) {
            const parts = key.split('-');
            if (parts.length < 2) return key;
            const m = parseInt(parts[1], 10) - 1;
            return `${MESI_IT[m] || parts[1]} ${parts[0]}`;
        }

        tbody.innerHTML = history.map((d, idx) => {
            const disagio = d.disagio !== undefined ? d.disagio : 0;
            const colorStyle = disagio > 20 ? 'color: var(--danger); font-weight: 600;'
                             : disagio > 5  ? 'color: var(--warning); font-weight: 600;'
                             :                'color: var(--success);';
            const rowBg = idx % 2 === 0 ? '' : 'background-color: rgba(255,255,255,0.015);';
            const treni = d.treni_totali !== undefined ? d.treni_totali : '-';
            const critici = d.treni_anomali !== undefined ? d.treni_anomali : '-';
            const giorni = d.giorni !== undefined ? d.giorni : '-';
            return `<tr style="${rowBg}">
                <td style="padding: 10px 10px; border-bottom: 1px solid var(--border-color); font-weight: 600;">${formatMese(d.data)}</td>
                <td style="padding: 10px 10px; text-align: right; border-bottom: 1px solid var(--border-color); color: var(--text-muted);">${giorni}</td>
                <td style="padding: 10px 10px; text-align: right; border-bottom: 1px solid var(--border-color);">${treni}</td>
                <td style="padding: 10px 10px; text-align: right; border-bottom: 1px solid var(--border-color);">${critici}</td>
                <td style="padding: 10px 10px; text-align: right; border-bottom: 1px solid var(--border-color); ${colorStyle}">${disagio.toFixed(1)}%</td>
            </tr>`;
        }).join('');

        const rows = tbody.querySelectorAll('tr');
        if (rows.length > 0) {
            rows[rows.length - 1].querySelectorAll('td').forEach(td => td.style.borderBottom = 'none');
        }
    }
}

updateDashboard();
setInterval(updateDashboard, 60000);

function handleEmailClick(el, email) {
    const performFeedback = () => {
        if (!el) return;
        const originalText = el.innerHTML;
        el.innerHTML = "✉️ Copiata negli appunti!";
        setTimeout(() => {
            el.innerHTML = originalText;
        }, 1500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(() => {
            performFeedback();
        }).catch(() => {
            fallbackCopy(email, performFeedback);
        });
    } else {
        fallbackCopy(email, performFeedback);
    }
}

function fallbackCopy(text, callback) {
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        if (callback) {
            callback();
        }
    } catch (err) {
        console.error("Fallback copy failed: ", err);
    }
}

// --- PWA Service Worker & Install Logic ---

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Registra sw.js a livello di radice (sw.js si trova in /sw.js)
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registrato con successo. Scope:', reg.scope))
            .catch(err => console.error('Errore registrazione Service Worker:', err));
    });
}

function updateOnlineStatus() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    if (navigator.onLine) {
        banner.classList.add('hidden');
    } else {
        banner.classList.remove('hidden');
    }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus(); // Esegui all'avvio

let deferredPrompt;
const installBtn = document.getElementById('install-pwa-btn');

if (installBtn) {
    // Rileva se l'utente è su iOS (Safari) e se non è già in modalità standalone (installato)
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

    if (isIos && !isStandalone) {
        installBtn.classList.remove('hidden');
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        // Previene la comparsa automatica del banner nativo del browser
        e.preventDefault();
        deferredPrompt = e;
        // Mostra il pulsante di installazione personalizzato nell'header
        installBtn.classList.remove('hidden');
    });

    installBtn.addEventListener('click', () => {
        // Rileva se l'utente è su iOS (Safari)
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        if (isIos) {
            openIosModal();
        } else if (deferredPrompt) {
            // Mostra il prompt nativo per Android/Chrome
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('Installazione PWA accettata');
                }
                installBtn.classList.add('hidden');
                deferredPrompt = null;
            });
        } else {
            // Se non c'è prompt nativo ma si clicca su desktop/altro
            alert("Il tuo browser non supporta l'installazione rapida o l'app è già installata!");
        }
    });
}

function openIosModal() {
    const modal = document.getElementById('iosInstallModal');
    if (modal) modal.style.display = 'flex';
}

function closeIosModal() {
    const modal = document.getElementById('iosInstallModal');
    if (modal) modal.style.display = 'none';
}

// Ricarica automaticamente la pagina se l'applicazione viene riaperta dopo essere stata in background
const PAGE_LOAD_TIME = Date.now();
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        const now = Date.now();
        // Se la pagina è stata caricata da più di 2 minuti (120000 ms), ricarica
        if (now - PAGE_LOAD_TIME > 120000) {
            console.log('PWA riaperta in foreground, ricarico per scaricare i dati aggiornati.');
            window.location.reload();
        }
    }
});

function showSkeleton() {
    const grid = document.getElementById('direttrici-grid');
    if (!grid) return;
    let skeletonHtml = '';
    const widths = [50, 60, 40, 55, 45, 50];
    for (let i = 0; i < 6; i++) {
        skeletonHtml += `
            <div class="direttrice-card skeleton-card">
                <div class="direttrice-header">
                    <div style="width: 70%;">
                        <div class="skeleton-text skeleton-title"></div>
                        <div class="skeleton-text skeleton-subtitle" style="width: ${widths[i]}%;"></div>
                    </div>
                    <div class="skeleton-circle"></div>
                </div>
                <div class="direttrice-stats">
                    <div class="stat-item">
                        <div class="skeleton-text skeleton-stat-val"></div>
                        <div class="skeleton-text skeleton-stat-lbl"></div>
                    </div>
                    <div class="stat-item">
                        <div class="skeleton-text skeleton-stat-val"></div>
                        <div class="skeleton-text skeleton-stat-lbl"></div>
                    </div>
                </div>
            </div>
        `;
    }
    grid.innerHTML = skeletonHtml;
}

// --- Gestione Navigazione a Schede (Tabs) ---
let currentTab = 'monitor';

function switchTab(tabName, pushState = true) {
    currentTab = tabName;
    const tabMon = document.getElementById('tab-monitor');
    const tabSrc = document.getElementById('tab-search');
    const tabStn = document.getElementById('tab-station');
    const tabLive = document.getElementById('tab-live-train');
    
    const routeView = document.getElementById('route-search-view');
    const homeView = document.getElementById('home-view');
    const detailView = document.getElementById('detail-view');
    const stationView = document.getElementById('station-search-view');
    const liveView = document.getElementById('live-train-view');
    
    if (!tabMon || !tabSrc || !tabStn) return;

    tabMon.classList.remove('active');
    tabSrc.classList.remove('active');
    tabStn.classList.remove('active');
    if (tabLive) tabLive.classList.remove('active');
    
    routeView.classList.add('hidden');
    homeView.classList.add('hidden');
    detailView.classList.add('hidden');
    if (stationView) stationView.classList.add('hidden');
    if (liveView) liveView.classList.add('hidden');

    if (tabName === 'search') {
        tabSrc.classList.add('active');
        routeView.classList.remove('hidden');
        initStationAutocomplete();
        if (pushState) {
            history.pushState({ view: 'search' }, '', '?tab=search');
        }
    } else if (tabName === 'station') {
        tabStn.classList.add('active');
        if (stationView) stationView.classList.remove('hidden');
        initStationAutocomplete();
        if (pushState) {
            history.pushState({ view: 'station' }, '', '?tab=station');
        }
    } else if (tabName === 'live-train') {
        if (tabLive) tabLive.classList.add('active');
        if (liveView) liveView.classList.remove('hidden');
        const trainInput = document.getElementById('live-train-search-input');
        const trainNum = trainInput ? trainInput.value.trim() : '';
        if (pushState) {
            const url = trainNum ? `?tab=live-train&treno=${encodeURIComponent(trainNum)}` : '?tab=live-train';
            history.pushState({ view: 'live-train', treno: trainNum }, '', url);
        }
    } else {
        tabMon.classList.add('active');
        if (selectedDirettrice) {
            detailView.classList.remove('hidden');
            if (pushState) {
                history.pushState({ view: 'detail', direttrice: selectedDirettrice }, '', `?dir=${encodeURIComponent(selectedDirettrice)}`);
            }
        } else {
            homeView.classList.remove('hidden');
            if (pushState) {
                history.pushState({ view: 'home' }, '', window.location.pathname);
            }
        }
    }
}

// --- Autocompletamento Stazioni Custom ---
let stationsList = [];
let isStationsLoaded = false;

function initStationAutocomplete() {
    if (isStationsLoaded) return;
    
    const path = IS_STATIC ? 'data/stazioni.json' : '/data/stazioni.json';
    fetch(path)
        .then(res => res.json())
        .then(data => {
            stationsList = data;
            isStationsLoaded = true;
            setupAutocompleteInput('station-start', 'autocomplete-start', 'clear-start-btn');
            setupAutocompleteInput('station-end', 'autocomplete-end', 'clear-end-btn');
            setupAutocompleteInput('station-search-input', 'autocomplete-station-search', 'clear-station-search-btn');
        })
        .catch(err => console.error("Errore caricamento stazioni:", err));
}

function setupAutocompleteInput(inputId, autocompleteId, clearBtnId) {
    const input = document.getElementById(inputId);
    const listContainer = document.getElementById(autocompleteId);
    const clearBtn = document.getElementById(clearBtnId);
    
    if (!input || !listContainer || !clearBtn) return;
    
    let currentFocus = -1;
    
    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        closeAllLists();
        
        if (!val) {
            clearBtn.classList.add('hidden');
            return;
        }
        clearBtn.classList.remove('hidden');
        
        const matches = stationsList.filter(s => s.toLowerCase().includes(val)).slice(0, 8);
        if (matches.length === 0) {
            listContainer.classList.add('hidden');
            return;
        }
        
        listContainer.classList.remove('hidden');
        currentFocus = -1;
        
        matches.forEach((station, idx) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            
            const matchIdx = station.toLowerCase().indexOf(val);
            const boldText = station.substring(0, matchIdx) + 
                             '<strong>' + station.substring(matchIdx, matchIdx + val.length) + '</strong>' + 
                             station.substring(matchIdx + val.length);
            
            item.innerHTML = boldText;
            item.addEventListener('click', () => {
                input.value = station;
                closeAllLists();
                if (inputId === 'station-search-input') {
                    performStationSearch();
                }
            });
            listContainer.appendChild(item);
        });
    });
    
    input.addEventListener('keydown', (e) => {
        const items = listContainer.getElementsByClassName('autocomplete-item');
        if (e.keyCode === 40) { // Arrow Down
            currentFocus++;
            addActive(items);
        } else if (e.keyCode === 38) { // Arrow Up
            currentFocus--;
            addActive(items);
        } else if (e.keyCode === 13) { // Enter
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].click();
            } else if (items.length > 0) {
                items[0].click();
            }
        } else if (e.keyCode === 27) { // Escape
            closeAllLists();
        }
    });
    
    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.classList.add('hidden');
        closeAllLists();
        input.focus();
    });
    
    function addActive(items) {
        if (!items) return;
        removeActive(items);
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add('selected');
        items[currentFocus].scrollIntoView({ block: 'nearest' });
    }
    
    function removeActive(items) {
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove('selected');
        }
    }
    
    function closeAllLists() {
        listContainer.innerHTML = '';
        listContainer.classList.add('hidden');
    }
    
    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== listContainer) {
            closeAllLists();
        }
    });
}

// --- Ricerca Soluzioni di Viaggio ed Affidabilità ---
let cachedTimetable = null;

function timeToMinutes(tStr) {
    try {
        const parts = tStr.split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    } catch(e) {
        return 0;
    }
}

function performRouteSearch() {
    const start = document.getElementById('station-start').value.trim();
    const end = document.getElementById('station-end').value.trim();
    const depTime = document.getElementById('search-time')?.value || "00:00";
    const timeType = document.getElementById('search-time-type')?.value || "dep";
    const allowTransfers = document.getElementById('allow-transfers')?.checked || false;
    const container = document.getElementById('search-results-container');
    
    if (!start || !end) {
        alert("Inserisci sia la stazione di partenza che quella di arrivo!");
        return;
    }
    
    container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px;">
            <div class="skeleton-text skeleton-title" style="width: 50%; margin: 0 auto 15px auto;"></div>
            Analisi orari e storico ritardi in corso...
        </div>
    `;
    
    if (IS_STATIC) {
        loadTimetableAndSearchClient(start, end, container);
    } else {
        fetch(`/api/route_search?da=${encodeURIComponent(start)}&a=${encodeURIComponent(end)}&ora=${encodeURIComponent(depTime)}&tipo_ora=${timeType}&cambi=${allowTransfers}`)
            .then(res => res.json())
            .then(data => renderSearchResults(data, container))
            .catch(err => {
                console.error("Errore ricerca tratte:", err);
                container.innerHTML = `<div style="text-align:center; color:var(--danger); padding:20px;">Errore durante la ricerca. Riprova più tardi.</div>`;
            });
    }
}

function loadTimetableAndSearchClient(start, end, container) {
    if (cachedTimetable) {
        searchClientSide(start, end, container);
        return;
    }
    
    fetch('data/orari_tratte_compresso.json')
        .then(res => res.json())
        .then(data => {
            cachedTimetable = data;
            searchClientSide(start, end, container);
        })
        .catch(err => {
            console.error("Errore download orari:", err);
            container.innerHTML = `<div style="text-align:center; color:var(--danger); padding:20px;">Impossibile caricare gli orari statici offline.</div>`;
        });
}

function searchClientSide(start, end, container) {
    const timeLimit = document.getElementById('search-time')?.value || "00:00";
    const timeType = document.getElementById('search-time-type')?.value || "dep";
    const allowTransfers = document.getElementById('allow-transfers')?.checked || false;
    
    const startTrains = cachedTimetable[start] || {};
    const endTrains = cachedTimetable[end] || {};
    
    const results = [];
    
    // 1. Trova treni diretti
    const commonNums = Object.keys(startTrains).filter(num => num in endTrains);
    commonNums.forEach(numStr => {
        const stInfo = startTrains[numStr]; // [seq, dep, line]
        const endInfo = endTrains[numStr];
        
        if (stInfo[0] < endInfo[0]) {
            let isValid = false;
            if (timeType === "dep") {
                isValid = (stInfo[1] >= timeLimit);
            } else { // 'arr'
                isValid = (endInfo[1] <= timeLimit);
            }
            
            if (isValid) {
                const stats = calculateReliabilityClient(numStr);
                results.push({
                    tipo: "diretto",
                    numero: parseInt(numStr, 10),
                    linea: stInfo[2],
                    partenza: stInfo[1],
                    arrivo: endInfo[1],
                    affidabilita: stats
                });
            }
        }
    });
    
    // 2. Trova soluzioni con 1 cambio se richiesto
    if (allowTransfers) {
        Object.keys(cachedTimetable).forEach(stName => {
            if (stName === start || stName === end) return;
            
            const stTrains = cachedTimetable[stName];
            
            const t1Candidates = Object.keys(startTrains).filter(num => num in stTrains);
            if (t1Candidates.length === 0) return;
            
            const t2Candidates = Object.keys(stTrains).filter(num => num in endTrains);
            if (t2Candidates.length === 0) return;
            
            t1Candidates.forEach(t1Num => {
                const t1Start = startTrains[t1Num];
                const t1Mid = stTrains[t1Num];
                
                if (t1Start[0] >= t1Mid[0]) return;
                
                const t1Dep = t1Start[1];
                const t1Arr = t1Mid[1];
                const t1ArrM = timeToMinutes(t1Arr);
                
                if (timeType === "dep" && t1Dep < timeLimit) return;
                
                t2Candidates.forEach(t2Num => {
                    if (t1Num === t2Num) return;
                    
                    const t2Mid = stTrains[t2Num];
                    const t2End = endTrains[t2Num];
                    
                    if (t2Mid[0] >= t2End[0]) return;
                    
                    const t2Dep = t2Mid[1];
                    const t2Arr = t2End[1];
                    const t2DepM = timeToMinutes(t2Dep);
                    
                    if (timeType === "arr" && t2Arr > timeLimit) return;
                    
                    const layover = t2DepM - t1ArrM;
                    if (layover >= 5 && layover <= 90) {
                        const stats1 = calculateReliabilityClient(t1Num);
                        const stats2 = calculateReliabilityClient(t2Num);
                        results.push({
                            tipo: "cambio",
                            cambio_stazione: stName,
                            partenza: t1Dep,
                            arrivo: t2Arr,
                            treno1: {
                                numero: parseInt(t1Num, 10),
                                linea: t1Start[2],
                                partenza: t1Dep,
                                arrivo: t1Arr,
                                affidabilita: stats1
                            },
                            treno2: {
                                numero: parseInt(t2Num, 10),
                                linea: t2Mid[2],
                                partenza: t2Dep,
                                arrivo: t2Arr,
                                affidabilita: stats2
                            },
                            attesa: layover
                        });
                    }
                });
            });
        });
    }
    
    if (timeType === "arr") {
        results.sort((a, b) => a.arrivo.localeCompare(b.arrivo));
    } else {
        results.sort((a, b) => a.partenza.localeCompare(b.partenza));
    }
    renderSearchResults(results, container);
}

function calculateReliabilityClient(trainNum) {
    const history = STATIC_HISTORY[trainNum] || [];
    if (history.length === 0) {
        return { puntualita: 100.0, ritardo_medio: 0.0, soppressioni: 0.0, corse_totali: 0 };
    }
    
    const total = history.length;
    let punctual = 0;
    let cancelled = 0;
    const delays = [];
    
    history.forEach(t => {
        if (["SOPPRESSO", "LIMITATO", "PARZ. SOPPRESSO"].includes(t.stato)) {
            cancelled++;
        } else {
            if (t.ritardo_capolinea <= 5) {
                punctual++;
            }
            delays.push(Math.max(0, t.ritardo_capolinea));
        }
    });
    
    const sumDelays = delays.reduce((a, b) => a + b, 0);
    const avgDelay = delays.length > 0 ? (sumDelays / delays.length) : 0.0;
    
    return {
        puntualita: parseFloat(((punctual / total) * 100).toFixed(1)),
        ritardo_medio: parseFloat(avgDelay.toFixed(1)),
        soppressioni: parseFloat(((cancelled / total) * 100).toFixed(1)),
        corse_totali: total
    };
}

function renderSearchResults(trains, container) {
    const start = document.getElementById('station-start').value.trim();
    const end = document.getElementById('station-end').value.trim();

    if (!trains || trains.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 40px; background-color: var(--card-bg); border-radius: 12px; border: 1px solid var(--border-color);">
                Nessuna soluzione ferroviaria trovata per questa combinazione di stazioni.
            </div>
        `;
        return;
    }
    
    let html = `<h3 style="margin-top: 0; margin-bottom: 20px; font-size: 1.1rem; color: var(--text-muted);">${trains.length} Soluzioni Trovate:</h3>`;
    
    trains.forEach(t => {
        if (t.tipo === "diretto") {
            const stats = t.affidabilita;
            const puntColor = stats.puntualita > 80 ? 'var(--success)' : (stats.puntualita > 50 ? 'var(--warning)' : 'var(--danger)');
            const sopColor = stats.soppressioni < 2 ? 'var(--success)' : (stats.soppressioni < 10 ? 'var(--warning)' : 'var(--danger)');
            const ritColor = stats.ritardo_medio < 3 ? 'var(--success)' : (stats.ritardo_medio < 10 ? 'var(--warning)' : 'var(--danger)');
            
            const trenoData = encodeURIComponent(JSON.stringify({
                linea: t.linea,
                numero: t.numero,
                origine: `${start} (${t.partenza})`,
                destinazione: `${end} (${t.arrivo})`
            }));
            
            html += `
                <div class="search-result-card" onclick="openModal('${trenoData}', ${t.numero})">
                    <div class="route-header">
                        <div>
                            <span class="route-train-num" style="display: flex; align-items: center; gap: 6px;">${getLineBadgeHtml(t.linea)} ${t.numero}${getTrainWarningBadge(t)}</span>
                            <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 8px;">(Campione: ${stats.corse_totali} gg)</span>
                        </div>
                        <div class="route-times">
                            <span style="font-size: 0.85rem; color: var(--text-muted); margin-right: 4px;">Partenza:</span>
                            <span style="font-weight: 700; color: var(--accent);">${t.partenza}</span>
                            <span class="route-time-arrow" style="margin: 0 8px;">➔</span>
                            <span style="font-size: 0.85rem; color: var(--text-muted); margin-right: 4px;">Arrivo:</span>
                            <span style="font-weight: 700; color: var(--text-main);">${t.arrivo}</span>
                        </div>
                    </div>
                    
                    <div class="reliability-grid">
                        <div class="reliability-item">
                            <div class="reliability-val" style="color: ${puntColor};">${stats.puntualita}%</div>
                            <div class="reliability-lbl">Puntualità (≤5')</div>
                        </div>
                        <div class="reliability-item">
                            <div class="reliability-val" style="color: ${ritColor};">${stats.ritardo_medio}'</div>
                            <div class="reliability-lbl">Ritardo Medio</div>
                        </div>
                        <div class="reliability-item">
                            <div class="reliability-val" style="color: ${sopColor};">${stats.soppressioni}%</div>
                            <div class="reliability-lbl">Soppressioni</div>
                        </div>
                    </div>
                </div>
            `;
        } else if (t.tipo === "cambio") {
            const t1 = t.treno1;
            const t2 = t.treno2;
            
            const t1PuntColor = t1.affidabilita.puntualita > 80 ? 'var(--success)' : (t1.affidabilita.puntualita > 50 ? 'var(--warning)' : 'var(--danger)');
            const t2PuntColor = t2.affidabilita.puntualita > 80 ? 'var(--success)' : (t2.affidabilita.puntualita > 50 ? 'var(--warning)' : 'var(--danger)');
            
            const trenoData1 = encodeURIComponent(JSON.stringify({
                linea: t1.linea,
                numero: t1.numero,
                origine: `${start} (${t1.partenza})`,
                destinazione: `${t.cambio_stazione} (${t1.arrivo})`
            }));
            
            const trenoData2 = encodeURIComponent(JSON.stringify({
                linea: t2.linea,
                numero: t2.numero,
                origine: `${t.cambio_stazione} (${t2.partenza})`,
                destinazione: `${end} (${t2.arrivo})`
            }));
            
            html += `
                <div class="search-result-card" style="cursor: default; gap: 12px;">
                    <div class="route-header" style="border-bottom: 1px dashed rgba(255, 255, 255, 0.08); padding-bottom: 10px;">
                        <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                            <span>🔄 Via ${t.cambio_stazione}</span>
                            <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 12px;">1 Cambio</span>
                        </div>
                        <div class="route-times">
                            <span style="font-size: 0.85rem; color: var(--text-muted); margin-right: 4px;">Partenza:</span>
                            <span style="font-weight: 700; color: var(--accent);">${t.partenza}</span>
                            <span class="route-time-arrow" style="margin: 0 8px;">➔</span>
                            <span style="font-size: 0.85rem; color: var(--text-muted); margin-right: 4px;">Arrivo:</span>
                            <span style="font-weight: 700; color: var(--text-main);">${t.arrivo}</span>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <!-- Segmento 1 -->
                        <div class="segment-row" onclick="openModal('${trenoData1}', ${t1.numero})" style="cursor: pointer; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;">
                            <div>
                                <span class="route-train-num" style="color: var(--accent); font-size: 0.95rem;">🚂 ${t1.linea} ${t1.numero}</span>
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px;">
                                    ${start} (${t1.partenza}) ➔ ${t.cambio_stazione} (${t1.arrivo})
                                </div>
                            </div>
                            <div style="display: flex; gap: 15px; align-items: center;">
                                <div style="text-align: right;">
                                    <div style="font-size: 0.9rem; font-weight: 700; color: ${t1PuntColor};">${t1.affidabilita.puntualita}%</div>
                                    <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Puntualità</div>
                                </div>
                                <div style="color: var(--text-muted); font-size: 0.9rem;">➔</div>
                            </div>
                        </div>
                        
                        <!-- Attesa Cambio -->
                        <div style="display: flex; align-items: center; gap: 8px; padding-left: 20px; font-size: 0.82rem; color: var(--text-muted); border-left: 2px dashed rgba(255, 255, 255, 0.1); margin-left: 15px;">
                            <span>⏳ Attesa di <strong>${t.attesa} min</strong> a ${t.cambio_stazione}</span>
                        </div>
                        
                        <!-- Segmento 2 -->
                        <div class="segment-row" onclick="openModal('${trenoData2}', ${t2.numero})" style="cursor: pointer; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;">
                            <div>
                                <span class="route-train-num" style="color: var(--accent); font-size: 0.95rem;">🚂 ${t2.linea} ${t2.numero}</span>
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px;">
                                    ${t.cambio_stazione} (${t2.partenza}) ➔ ${end} (${t2.arrivo})
                                </div>
                            </div>
                            <div style="display: flex; gap: 15px; align-items: center;">
                                <div style="text-align: right;">
                                    <div style="font-size: 0.9rem; font-weight: 700; color: ${t2PuntColor};">${t2.affidabilita.puntualita}%</div>
                                    <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Puntualità</div>
                                </div>
                                <div style="color: var(--text-muted); font-size: 0.9rem;">➔</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    container.innerHTML = html;
}

// --- Gestione Ricerca Stazione ---
let lastStationResults = [];
let lastSearchedStation = "";

function performStationSearch() {
    const station = document.getElementById('station-search-input').value.trim();
    const container = document.getElementById('station-results-container');
    
    if (!station) {
        alert("Seleziona una stazione!");
        return;
    }
    
    container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px;">
            <div class="skeleton-text skeleton-title" style="width: 50%; margin: 0 auto 15px auto;"></div>
            Recupero passaggi e stato live per la stazione in corso...
        </div>
    `;
    
    if (IS_STATIC) {
        loadTimetableAndSearchStationClient(station, container);
    } else {
        fetch(`/api/station_search?stazione=${encodeURIComponent(station)}`)
            .then(res => res.json())
            .then(data => renderStationResults(data, container, station))
            .catch(err => {
                console.error("Errore ricerca stazione:", err);
                container.innerHTML = `<div style="text-align:center; color:var(--danger); padding:20px;">Errore durante il recupero dei dati. Riprova più tardi.</div>`;
            });
    }
}

function loadTimetableAndSearchStationClient(station, container) {
    if (cachedTimetable) {
        searchStationClientSide(station, container);
        return;
    }
    
    fetch('data/orari_tratte_compresso.json')
        .then(res => res.json())
        .then(data => {
            cachedTimetable = data;
            searchStationClientSide(station, container);
        })
        .catch(err => {
            console.error("Errore download orari:", err);
            container.innerHTML = `<div style="text-align:center; color:var(--danger); padding:20px;">Impossibile caricare gli orari statici offline.</div>`;
        });
}

function getTrainEndpointsJS(trainNumStr) {
    if (!cachedTimetable) return { origine: "N/D", destinazione: "N/D" };
    
    let minSeq = 9999;
    let maxSeq = -1;
    let origName = null;
    let origDep = null;
    let destName = null;
    let destDep = null;
    
    for (const stName in cachedTimetable) {
        const stTrains = cachedTimetable[stName];
        if (stTrains && trainNumStr in stTrains) {
            const stInfo = stTrains[trainNumStr];
            const seq = (typeof stInfo.seq !== 'undefined') ? stInfo.seq : stInfo[0];
            const dep = stInfo.dep || stInfo[1];
            
            if (seq < minSeq) {
                minSeq = seq;
                origName = stName;
                origDep = dep;
            }
            if (seq > maxSeq) {
                maxSeq = seq;
                destName = stName;
                destDep = dep;
            }
        }
    }
    
    const origine = origName ? `${origName} (${origDep})` : "N/D";
    const destinazione = destName ? `${destName} (${destDep})` : "N/D";
    return { origine, destinazione };
}

function searchStationClientSide(station, container) {
    const stationTrains = cachedTimetable[station];
    if (!stationTrains || Object.keys(stationTrains).length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 40px; background-color: var(--card-bg); border-radius: 12px; border: 1px solid var(--border-color);">
                Nessun treno programmato in transito per questa stazione.
            </div>
        `;
        return;
    }
    
    const results = [];
    
    for (const numStr in stationTrains) {
        const stInfo = stationTrains[numStr];
        const scheduledDep = stInfo.dep || stInfo[1];
        const line = stInfo.line || stInfo[2];
        const trainNum = parseInt(numStr, 10);
        
        // Cerca se attivo oggi
        const liveT = allTrainsData.find(x => x.numero === trainNum);
        if (liveT) {
            results.push({
                attivo: true,
                numero: trainNum,
                linea: liveT.linea || line,
                origine: liveT.origine || "N/D",
                destinazione: liveT.destinazione || "N/D",
                orario_passaggio: scheduledDep,
                orario_programmato: liveT.orario_programmato || "",
                stato: liveT.stato || "REGOLARE",
                critico: liveT.critico || false,
                ritardo_attuale: liveT.ritardo_attuale || 0,
                ritardo_capolinea: liveT.ritardo_capolinea || 0,
                ritardo_picco: liveT.ritardo_picco || 0,
                note: liveT.note || ""
            });
        } else {
            const endpoints = getTrainEndpointsJS(numStr);
            results.push({
                attivo: false,
                numero: trainNum,
                linea: line,
                origine: endpoints.origine,
                destinazione: endpoints.destinazione,
                orario_passaggio: scheduledDep,
                orario_programmato: scheduledDep,
                stato: "INATTIVO",
                critico: false,
                ritardo_attuale: 0,
                ritardo_capolinea: 0,
                ritardo_picco: 0,
                note: ""
            });
        }
    }
    
    results.sort((a, b) => a.orario_passaggio.localeCompare(b.orario_passaggio));
    renderStationResults(results, container, station);
}

function renderStationResults(results, container, station) {
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 40px; background-color: var(--card-bg); border-radius: 12px; border: 1px solid var(--border-color);">
                Nessun treno trovato in transito per questa stazione.
            </div>
        `;
        return;
    }
    
    lastStationResults = results;
    lastSearchedStation = station;
    
    // Calcola orario di default (ora attuale meno 30 minuti)
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const startDefault = String(thirtyMinAgo.getHours()).padStart(2, '0') + ':' + String(thirtyMinAgo.getMinutes()).padStart(2, '0');
    
    // Raccoglie le anomalie/note di tutti i treni in questa stazione
    const stationAnomalies = [];
    results.forEach(t => {
        const note = (t.note || '').trim();
        if (note && note !== "INATTIVO" && note !== "REGOLARE") {
            stationAnomalies.push({ numero: t.numero, linea: t.linea, nota: note, stato: t.stato });
        } else if (["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"].includes(t.stato)) {
            stationAnomalies.push({ numero: t.numero, linea: t.linea, nota: `Stato convoglio: ${t.stato}`, stato: t.stato });
        }
    });

    let stationAlertsHtml = '';
    if (stationAnomalies.length > 0) {
        stationAlertsHtml = `
            <div class="direttrice-alerts-box" style="margin-bottom: 20px; border-color: rgba(245, 158, 11, 0.3); background-color: rgba(245, 158, 11, 0.06);">
                <div class="alerts-box-header" style="margin-bottom: 10px; padding-bottom: 6px;">
                    <span class="warning-alert-icon">⚠️</span>
                    <h4 style="margin: 0; font-size: 1.05rem; font-weight: 600; color: #f59e0b;">Stazione di ${station}: ${stationAnomalies.length} ${stationAnomalies.length === 1 ? 'treno interessato da avviso/anomalia' : 'treni interessati da avvisi/anomalie'}</h4>
                </div>
                <ul class="alerts-details-list">
                    ${stationAnomalies.map(a => `
                        <li>
                            Treno <strong>${a.linea ? a.linea + ' ' : ''}${a.numero}</strong>: ${linkify(sanitizeNewsText(a.nota))}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    let html = `${stationAlertsHtml}<h3 style="margin-top: 0; margin-bottom: 20px; font-size: 1.1rem; color: var(--text-muted);">${results.length} Treni in Transito a ${station}:</h3>`;
    
    // Aggiunge la barra dei filtri avanzati
    html += `
        <div class="station-filters-bar" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 25px; background-color: var(--card-bg); padding: 15px; border-radius: 12px; border: 1px solid var(--border-color); align-items: center;">
            
            <!-- Filtro di testo -->
            <div style="flex: 2; min-width: 250px; position: relative;">
                <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;">🔍</span>
                <input type="text" id="station-text-filter" placeholder="Cerca treno, linea o destinazione..." 
                       style="width: 100%; padding: 8px 12px 8px 32px; border-radius: 6px; border: 1px solid var(--border-color); background-color: var(--body-bg); color: var(--text-main); font-family: inherit; font-size: 0.9rem;"
                       oninput="applyStationFilters()">
            </div>
            
            <!-- Filtro orario da -->
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.85rem; color: var(--text-muted);">Dalle:</span>
                <input type="time" id="station-time-start" value="${startDefault}"
                       style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); background-color: var(--body-bg); color: var(--text-main); font-family: inherit; font-size: 0.9rem;"
                       onchange="applyStationFilters()">
            </div>
            
            <!-- Filtro orario a -->
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.85rem; color: var(--text-muted);">Alle:</span>
                <input type="time" id="station-time-end" 
                       style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); background-color: var(--body-bg); color: var(--text-main); font-family: inherit; font-size: 0.9rem;"
                       onchange="applyStationFilters()">
            </div>
            
            <!-- Filtro stato -->
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.85rem; color: var(--text-muted);">Stato:</span>
                <select id="station-status-filter" 
                        style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); background-color: var(--body-bg); color: var(--text-main); font-family: inherit; font-size: 0.9rem;"
                        onchange="applyStationFilters()">
                    <option value="all">Tutti i treni</option>
                    <option value="active">Solo attivi oggi</option>
                    <option value="delay">Solo ritardi/anomalie</option>
                    <option value="inactive">Solo inattivi oggi</option>
                </select>
            </div>
            
            <!-- Bottone reset filtri -->
            <button onclick="resetStationFilters()" 
                    style="padding: 8px 15px; border-radius: 6px; border: 1px solid var(--border-color); background-color: rgba(255,255,255,0.05); color: var(--text-main); font-family: inherit; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s;">
                Reset
            </button>
        </div>
    `;
    
    // Contenitore tabella
    html += `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Treno</th>
                        <th>Stato</th>
                        <th>Rit. Att.</th>
                        <th>Rit. Capolinea</th>
                        <th>Rit. Picco</th>
                        <th>Transito</th>
                        <th>Percorso</th>
                        <th>Note</th>
                    </tr>
                </thead>
                <tbody id="station-table-body">
                    <!-- Righe filtrate dinamicamente -->
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Applica subito i filtri per mostrare la finestra temporale iniziale di default
    applyStationFilters();
}

function applyStationFilters() {
    const textVal = (document.getElementById('station-text-filter')?.value || "").trim().toLowerCase();
    const timeStart = document.getElementById('station-time-start')?.value || "";
    const timeEnd = document.getElementById('station-time-end')?.value || "";
    const statusVal = document.getElementById('station-status-filter')?.value || "all";
    const tbody = document.getElementById('station-table-body');
    
    if (!tbody || !lastStationResults) return;
    
    const favs = getFavTreni();
    let filtered = lastStationResults;
    
    // 1. Filtro Testuale (treno, linea, origine, destinazione)
    if (textVal) {
        filtered = filtered.filter(t => {
            const numStr = String(t.numero);
            const lineStr = (t.linea || "").toLowerCase();
            const origStr = (t.origine || "").toLowerCase();
            const destStr = (t.destinazione || "").toLowerCase();
            return numStr.includes(textVal) || lineStr.includes(textVal) || origStr.includes(textVal) || destStr.includes(textVal);
        });
    }
    
    // 2. Filtro Orario (Transito dalle... alle...)
    if (timeStart) {
        filtered = filtered.filter(t => t.orario_passaggio >= timeStart);
    }
    if (timeEnd) {
        filtered = filtered.filter(t => t.orario_passaggio <= timeEnd);
    }
    
    // 3. Filtro Stato
    if (statusVal === "active") {
        filtered = filtered.filter(t => t.attivo);
    } else if (statusVal === "inactive") {
        filtered = filtered.filter(t => !t.attivo);
    } else if (statusVal === "delay") {
        filtered = filtered.filter(t => t.attivo && (t.stato === "RITARDO" || t.stato === "SOPPRESSO" || t.stato === "LIMITATO" || t.stato === "PARZ. SOPPRESSO" || t.ritardo_attuale > 0 || t.critico));
    }
    
    // Render delle righe filtrate
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:30px;">Nessun treno corrispondente ai filtri impostati.</td></tr>`;
        return;
    }
    
    let html = "";
    filtered.forEach(t => {
        const isFav = favs.includes(t.numero);
        const statusBadge = renderStatus(t.stato, t.critico);
        
        let noteHtml = t.note || '-';
        if (["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"].includes(t.stato)) {
            noteHtml = `<span class="note-soppresso">${t.stato}</span> ${t.note ? `<span style="font-size:0.85em; color:var(--text-muted)">${t.note}</span>` : ''}`;
        }
        
        const trenoData = encodeURIComponent(JSON.stringify({
            linea: t.linea,
            numero: t.numero,
            origine: t.origine,
            destinazione: t.destinazione
        }));
        
        let trClass = '';
        if (t.attivo) {
            trClass = (t.critico && t.stato !== "INATTIVO") ? 'class="row-critico"' : '';
        } else {
            trClass = 'style="opacity: 0.6;"';
        }
        
        let ritCapClass = '';
        if (t.attivo) {
            if (t.ritardo_capolinea > 15) {
                ritCapClass = 'color: var(--danger); font-weight: bold;';
            } else if (t.ritardo_capolinea > 5) {
                ritCapClass = 'color: var(--warning); font-weight: bold;';
            } else if (t.ritardo_capolinea > 0) {
                ritCapClass = 'color: var(--success);';
            }
        }
        
        html += `
            <tr ${trClass} onclick="openModal('${trenoData}', ${t.numero})">
                <td>
                    <button class="fav-star-icon fav-star-icon-train-${t.numero} ${isFav ? '' : 'inactive'}" 
                            onclick="toggleFavTrain(event, ${t.numero}); event.stopPropagation();" 
                            style="margin-right: 8px;">
                        ★
                    </button>
                    <strong>${getLineBadgeHtml(t.linea)} ${t.numero}${getTrainWarningBadge(t)}</strong>
                </td>
                <td>${statusBadge}</td>
                <td>${t.attivo ? `${t.ritardo_attuale}'` : '-'}</td>
                <td style="${ritCapClass}">${t.attivo ? `${t.ritardo_capolinea}'` : '-'}</td>
                <td>${t.attivo ? `${t.ritardo_picco}'` : '-'}</td>
                <td><strong>${t.orario_passaggio}</strong></td>
                <td><div style="font-size: 0.88rem; color: var(--text-muted);">${t.origine} ➔ ${t.destinazione}</div></td>
                <td><div class="note-text">${noteHtml}</div></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function resetStationFilters() {
    const textInput = document.getElementById('station-text-filter');
    const startInput = document.getElementById('station-time-start');
    const endInput = document.getElementById('station-time-end');
    const statusSelect = document.getElementById('station-status-filter');
    
    if (textInput) textInput.value = "";
    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";
    if (statusSelect) statusSelect.value = "all";
    
    applyStationFilters();
}

// --- Gestione Ricerca Treno Live ---

function formatTime(ms) {
    if (!ms) return '--:--';
    const date = new Date(ms);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

const CORS_PROXIES = [
    url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://cors-anywhere.herokuapp.com/${url}`
];

function fetchWithTimeout(url, options = {}, timeout = 4000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...options, signal: controller.signal })
        .then(res => {
            clearTimeout(id);
            return res;
        })
        .catch(err => {
            clearTimeout(id);
            throw err;
        });
}

function fetchWithProxy(targetUrl, proxyIndex = 0) {
    if (proxyIndex >= CORS_PROXIES.length) {
        return Promise.reject(new Error("Tutti i proxy CORS hanno fallito o sono andati in timeout."));
    }
    const proxyUrl = CORS_PROXIES[proxyIndex](targetUrl);
    return fetchWithTimeout(proxyUrl, {}, 4000)
        .then(res => {
            if (!res.ok) throw new Error(`Status ${res.status}`);
            return res;
        })
        .catch(err => {
            console.warn(`Proxy CORS (${proxyIndex}) fallito per ${targetUrl}, provo il successivo...`, err);
            return fetchWithProxy(targetUrl, proxyIndex + 1);
        });
}

function queryViaggiatrenoWithProxies(trainNum, resultsContainer) {
    const baseViaggiatreno = "https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno";
    const autocompleteUrl = `${baseViaggiatreno}/cercaNumeroTrenoTrenoAutocomplete/${encodeURIComponent(trainNum)}`;
    
    fetchWithProxy(autocompleteUrl)
        .then(res => res.text())
        .then(text => {
            if (!text || !text.trim()) {
                throw new Error(`Treno ${trainNum} non trovato.`);
            }
            const lines = text.trim().split("\n");
            let targetLine = null;
            for (let line of lines) {
                line = line.trim();
                if (!line) continue;
                if (line.includes("|")) {
                    const parts = line.split("|");
                    const subparts = parts[1].split("-");
                    if (subparts.length >= 3 && subparts[0] === trainNum) {
                        targetLine = line;
                        break;
                    }
                }
            }
            if (!targetLine && lines.length > 0 && lines[0].includes("|")) {
                targetLine = lines[0].trim();
            }
            if (!targetLine) {
                throw new Error(`Treno ${trainNum} non trovato.`);
            }
            
            const parts = targetLine.split("|");
            const subparts = parts[1].split("-");
            const codiceStazione = subparts[1];
            const timestamp = subparts[2];
            
            const detailUrl = `${baseViaggiatreno}/andamentoTreno/${codiceStazione}/${encodeURIComponent(trainNum)}/${timestamp}`;
            return fetchWithProxy(detailUrl).then(res => res.json());
        })
        .then(data => {
            renderLiveTrainResults(data);
        })
        .catch(err => {
            console.error("Errore ricerca live statica con proxy:", err);
            resultsContainer.innerHTML = `
                <div class="live-train-info-box" style="border: 1px solid rgba(239, 68, 68, 0.3); background-color: rgba(239, 68, 68, 0.05); color: var(--danger); padding: 25px; border-radius: 12px; margin-top: 20px; text-align: left; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    <div style="text-align: center; font-size: 2rem; margin-bottom: 15px;">⚠️</div>
                    <div class="live-train-info-title" style="color: var(--danger); font-size: 1.1rem; font-weight: 600; margin-bottom: 8px; text-align: center;">
                        Impossibile recuperare i dati in tempo reale
                    </div>
                    <div style="font-size: 0.92rem; color: var(--text-main); margin-bottom: 20px; line-height: 1.5; text-align: center;">
                        La connessione diretta alle API di Viaggiatreno è bloccata dal browser per motivi di sicurezza (CORS). I proxy pubblici gratuiti utilizzati come alternativa sono andati in timeout o sono offline.
                    </div>
                    
                    <div style="border-top: 1px dashed rgba(239, 68, 68, 0.2); padding-top: 15px; margin-top: 15px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 0.95rem; color: var(--text-main); font-weight: 600;">Opzione 1 (Consigliata): Sblocca il Proxy Demo</h4>
                        <p style="margin: 0 0 12px 0; font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
                            Puoi attivare l'accesso temporaneo per oggi cliccando sul pulsante sotto e selezionando <strong>"Request temporary access to the demo server"</strong> nella pagina che si apre. Poi torna qui e riprova la ricerca.
                        </p>
                        <div style="text-align: center; margin-bottom: 20px;">
                            <a href="https://cors-anywhere.herokuapp.com/corsdemo" target="_blank" style="display: inline-block; background-color: var(--accent); color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 0.88rem; font-weight: 600; transition: all 0.2s ease; border: none; cursor: pointer; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);">
                                🔓 Attiva temporaneamente CORS Anywhere
                            </a>
                        </div>
                        
                        <h4 style="margin: 0 0 8px 0; font-size: 0.95rem; color: var(--text-main); font-weight: 600;">Opzione 2: Esegui in Locale (Prestazioni Ottimali)</h4>
                        <p style="margin: 0 0 10px 0; font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
                            Clona il progetto ed esegui il server locale per evitare qualsiasi blocco CORS e avere caricamenti istantanei:
                        </p>
                        <div style="background-color: var(--bg-main); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); font-family: monospace; font-size: 0.85rem; color: var(--text-main); overflow-x: auto; margin-bottom: 5px;">
                            python web_app.py
                        </div>
                    </div>
                </div>
            `;
        });
}

function queryWithVercelAndFallback(trainNum, resultsContainer) {
    const vercelUrl = `https://trenord-monitor.vercel.app/api/train_live/${encodeURIComponent(trainNum)}`;
    
    fetch(vercelUrl)
        .then(res => {
            if (!res.ok) {
                return res.text().then(text => {
                    try {
                        const errData = JSON.parse(text);
                        throw new Error(errData.error || `Status ${res.status}`);
                    } catch (e) {
                        throw new Error(`Status ${res.status}`);
                    }
                });
            }
            return res.json();
        })
        .then(data => {
            renderLiveTrainResults(data);
        })
        .catch(err => {
            console.warn("API Vercel fallita, ripiego sui proxy CORS...", err);
            queryViaggiatrenoWithProxies(trainNum, resultsContainer);
        });
}

function performLiveTrainSearch(trainNum, updateHistory = true) {
    if (!trainNum) return;
    
    const resultsContainer = document.getElementById('live-train-results-container');
    if (!resultsContainer) return;
    
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 0;">
            <div class="skeleton-circle" style="width: 40px; height: 40px; margin: 0 auto 15px;"></div>
            <div class="skeleton-text" style="width: 150px; margin: 0 auto; height: 1.2rem;"></div>
            <p style="color: var(--text-muted); margin-top: 10px; font-size: 0.95rem;">Interrogazione in tempo reale delle API di Viaggiatreno...</p>
        </div>
    `;
    
    if (updateHistory) {
        history.pushState({ view: 'live-train', treno: trainNum }, '', `?tab=live-train&treno=${encodeURIComponent(trainNum)}`);
    }

    if (IS_STATIC) {
        // Evitiamo di fare chiamate HTTP su localhost se siamo caricati tramite HTTPS (evita mixed content)
        const canUseLocalBackend = window.location.protocol !== 'https:';
        
        if (canUseLocalBackend) {
            // Proviamo prima a contattare il backend Flask locale a http://127.0.0.1:5000 (CORS abilitato)
            const localUrl = `http://127.0.0.1:5000/api/train_live/${encodeURIComponent(trainNum)}`;
            
            fetch(localUrl)
                .then(res => {
                    if (!res.ok) {
                        return res.text().then(text => {
                            try {
                                const errData = JSON.parse(text);
                                throw new Error(errData.error);
                            } catch (e) {
                                throw new Error(`Errore locale ${res.status}`);
                            }
                        });
                    }
                    return res.json();
                })
                .then(data => {
                    renderLiveTrainResults(data);
                })
                .catch(localErr => {
                    if (localErr.message && !localErr.message.includes("Failed to fetch") && !localErr.message.includes("Errore locale")) {
                        resultsContainer.innerHTML = `
                            <div class="live-train-info-box" style="border-style: solid; border-color: rgba(239, 68, 68, 0.3); background-color: rgba(239, 68, 68, 0.05); color: var(--danger); padding: 25px; text-align: center; margin-top: 20px;">
                                <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
                                <div class="live-train-info-title" style="color: var(--danger); font-size: 0.95rem; margin-bottom: 5px;">Impossibile recuperare i dati</div>
                                <div style="font-size: 0.9rem; color: var(--text-main);">${localErr.message}</div>
                            </div>
                        `;
                        return;
                    }
                    // Fallback su Vercel e poi proxy CORS
                    queryWithVercelAndFallback(trainNum, resultsContainer);
                });
        } else {
            // Su HTTPS (GitHub Pages): passiamo prima alla nostra API su Vercel
            queryWithVercelAndFallback(trainNum, resultsContainer);
        }
    } else {
        // Modalità Flask Backend (stesso host)
        const url = `/api/train_live/${encodeURIComponent(trainNum)}`;
        fetch(url)
            .then(res => {
                if (!res.ok) {
                    return res.text().then(text => {
                        try {
                            const errData = JSON.parse(text);
                            throw new Error(errData.error || `Errore del server (Codice ${res.status}).`);
                        } catch (e) {
                            throw new Error(e.message || `Treno non trovato o non attivo (Errore ${res.status}).`);
                        }
                    });
                }
                return res.json();
            })
            .then(data => {
                renderLiveTrainResults(data);
            })
            .catch(err => {
                console.error("Errore ricerca live:", err);
                resultsContainer.innerHTML = `
                    <div class="live-train-info-box" style="border-style: solid; border-color: rgba(239, 68, 68, 0.3); background-color: rgba(239, 68, 68, 0.05); color: var(--danger); padding: 25px; text-align: center; margin-top: 20px;">
                        <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
                        <div class="live-train-info-title" style="color: var(--danger); font-size: 0.95rem; margin-bottom: 5px;">Impossibile recuperare i dati</div>
                        <div style="font-size: 0.9rem; color: var(--text-main);">${err.message || 'Verifica il numero del treno o riprova più tardi.'}</div>
                    </div>
                `;
            });
    }
}

function renderLiveTrainResults(data) {
    const resultsContainer = document.getElementById('live-train-results-container');
    if (!resultsContainer) return;
    
    const favs = getFavTreni();
    const isFav = favs.includes(parseInt(data.numeroTreno));
    
    let delayText = '';
    let delayBadgeClass = 'status-badge';
    if (data.ritardo > 0) {
        delayText = `+${data.ritardo} min`;
        delayBadgeClass += ' status-crit';
    } else if (data.ritardo < 0) {
        delayText = `${data.ritardo} min`;
        delayBadgeClass += ' status-ok';
    } else if (data.ritardo === 0) {
        delayText = 'in orario';
        delayBadgeClass += ' status-ok';
    } else {
        delayText = 'ritardo non disp.';
        delayBadgeClass += ' status-warn';
    }

    let statusText = 'IN VIAGGIO';
    let statusBadgeClass = 'status-badge status-ok';
    if (data.provvedimento === 1) {
        statusText = 'SOPPRESSO';
        statusBadgeClass = 'status-badge status-crit';
    } else if (data.provvedimento === 2) {
        statusText = 'PARZ. SOPPRESSO';
        statusBadgeClass = 'status-badge status-crit';
    } else if (data.nonPartito) {
        statusText = 'NON PARTITO';
        statusBadgeClass = 'status-badge status-warn';
    } else if (data.arrivato) {
        statusText = 'ARRIVATO';
        statusBadgeClass = 'status-badge status-ok';
    }

    // Ultimo rilevamento
    let lastDetectionHtml = '';
    if (data.stazioneUltimoRilevamento) {
        const timeStr = data.oraUltimoRilevamento ? ` alle <strong>${formatTime(data.oraUltimoRilevamento)}</strong>` : '';
        lastDetectionHtml = `
            <div class="live-train-info-box" style="margin-bottom: 20px;">
                <div class="live-train-info-title">Ultimo Rilevamento</div>
                <div style="font-size: 0.95rem; color: var(--text-main);">Stazione: <strong>${data.stazioneUltimoRilevamento}</strong>${timeStr}</div>
            </div>
        `;
    }

    // Note di viaggio / Motivo del ritardo
    let notesHtml = '';
    if (data.subTitle && data.subTitle.trim()) {
        const isDelayReason = data.ritardo > 0;
        const titleText = isDelayReason ? "Motivo del Ritardo / Dettaglio" : "Note di Viaggio / Variazione";
        const titleColor = isDelayReason ? "var(--danger)" : "var(--warning)";
        const borderStyle = isDelayReason ? "border-color: rgba(239, 68, 68, 0.3); background-color: rgba(239, 68, 68, 0.05);" : "border-color: rgba(245, 158, 11, 0.3); background-color: rgba(245, 158, 11, 0.05);";
        
        notesHtml = `
            <div class="live-train-info-box" style="margin-bottom: 20px; ${borderStyle}">
                <div class="live-train-info-title" style="color: ${titleColor}; font-weight: 700; text-transform: uppercase;">${titleText}</div>
                <div style="font-size: 0.9rem; color: var(--text-main); font-weight: 500; line-height: 1.4;">${linkify(sanitizeNewsText(data.subTitle))}</div>
            </div>
        `;
    }

    // Timeline delle fermate
    const fermate = data.fermate || [];
    let stopsHtml = '';
    if (fermate.length === 0) {
        stopsHtml = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Nessuna fermata disponibile.</p>';
    } else {
        stopsHtml = `
            <div class="timeline-stepper">
                ${fermate.map(f => {
                    let nodeClass = 'upcoming';
                    let isCompleted = false;
                    let isCancelled = f.actualFermataType === 3 || f.actualFermataType === "3";
                    let isActive = false;
                    
                    if (isCancelled) {
                        nodeClass = 'cancelled';
                    } else if (f.effettiva !== null && f.effettiva !== undefined) {
                        isCompleted = true;
                        if (!data.arrivato && data.stazioneUltimoRilevamento && f.stazione.toUpperCase().trim() === data.stazioneUltimoRilevamento.toUpperCase().trim()) {
                            nodeClass = 'active';
                            isActive = true;
                        } else {
                            nodeClass = 'completed';
                        }
                    } else {
                        nodeClass = 'upcoming';
                    }
                    
                    const scheduledTimeStr = formatTime(f.programmata);
                    let timeInfoHtml = '';
                    
                    if (isCancelled) {
                        timeInfoHtml = `<div class="timeline-times"><span class="timeline-delay-badge status-crit">SOPPRESSA</span></div>`;
                    } else if (isCompleted || isActive) {
                        const actualTimeStr = formatTime(f.effettiva);
                        let delayClass = 'timeline-actual-time';
                        let delayBadge = '';
                        
                        if (f.ritardo > 0) {
                            delayClass += ' delayed';
                            delayBadge = `<span class="timeline-delay-badge status-crit">+${f.ritardo} min</span>`;
                        } else if (f.ritardo < 0) {
                            delayBadge = `<span class="timeline-delay-badge status-ok">${f.ritardo} min</span>`;
                        } else {
                            delayBadge = `<span class="timeline-delay-badge status-ok">in orario</span>`;
                        }
                        
                        timeInfoHtml = `
                            <div class="timeline-times">
                                <span>Prog. ${scheduledTimeStr}</span>
                                <span>•</span>
                                <span class="${delayClass}">Eff. ${actualTimeStr}</span>
                                ${delayBadge}
                            </div>
                        `;
                    } else {
                        let delayBadge = '';
                        if (f.ritardo > 0) {
                            delayBadge = `<span class="timeline-delay-badge status-warn">+${f.ritardo} min</span>`;
                        } else if (f.ritardo < 0) {
                            delayBadge = `<span class="timeline-delay-badge status-ok">${f.ritardo} min</span>`;
                        }
                        
                        timeInfoHtml = `
                            <div class="timeline-times">
                                <span>Prog. ${scheduledTimeStr}</span>
                                ${delayBadge}
                            </div>
                        `;
                    }
                    
                    const nameClass = isCancelled ? 'timeline-station-name cancelled-text' : 'timeline-station-name';
                    
                    return `
                        <div class="timeline-step">
                            <div class="timeline-node ${nodeClass}"></div>
                            <div class="timeline-content">
                                <div class="timeline-station-info">
                                    <span class="${nameClass}">${f.stazione}</span>
                                    ${timeInfoHtml}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    resultsContainer.innerHTML = `
        <div class="live-train-header">
            <div class="live-train-title-area">
                <div class="live-train-number">
                    <span style="display: inline-flex; align-items: center; gap: 6px;">🚊 ${getLineBadgeHtml(data.categoria)} ${data.numeroTreno}</span>
                    <button class="fav-star-icon fav-star-icon-train-${data.numeroTreno} ${isFav ? '' : 'inactive'}" 
                            onclick="toggleFavTrain(event, ${parseInt(data.numeroTreno)})"
                            style="background:none; border:none; font-size:1.6rem; cursor:pointer; vertical-align: middle;">
                        ★
                    </button>
                </div>
                <div class="live-train-route">
                    <strong>${data.origine}</strong> ➔ <strong>${data.destinazione}</strong>
                </div>
            </div>
            <div class="live-train-status-area">
                <span class="${statusBadgeClass}">${statusText}</span>
                <span class="${delayBadgeClass}">${delayText}</span>
            </div>
        </div>
        
        ${notesHtml}
        ${lastDetectionHtml}
        ${stopsHtml}
        
        <div class="live-train-history-btn">
            <button class="filter-btn active" onclick="openModal(null, ${parseInt(data.numeroTreno)})">
                🗓️ Visualizza Storico Affidabilità Mensile
            </button>
        </div>
    `;
}

// --- Gestione Navigazione con Tasto Indietro (History API) ---
window.addEventListener('popstate', (event) => {
    const state = event.state;
    if (state) {
        if (state.view === 'search') {
            switchTab('search', false);
        } else if (state.view === 'station') {
            switchTab('station', false);
        } else if (state.view === 'live-train') {
            switchTab('live-train', false);
            if (state.treno) {
                const trainInput = document.getElementById('live-train-search-input');
                if (trainInput) trainInput.value = state.treno;
                performLiveTrainSearch(state.treno, false);
            } else {
                const trainInput = document.getElementById('live-train-search-input');
                if (trainInput) trainInput.value = '';
                const clearBtn = document.getElementById('clear-live-train-search-btn');
                if (clearBtn) clearBtn.classList.add('hidden');
                const resultsContainer = document.getElementById('live-train-results-container');
                if (resultsContainer) {
                    resultsContainer.classList.add('hidden');
                    resultsContainer.innerHTML = '';
                }
            }
        } else if (state.view === 'detail') {
            switchTab('monitor', false);
            selectDirettrice(state.direttrice, false);
        } else {
            switchTab('monitor', false);
            showHome(false);
        }
    } else {
        switchTab('monitor', false);
        showHome(false);
    }
});

// Gestione caricamento iniziale con URL parametrizzato (?dir= o ?tab=search)
window.addEventListener('DOMContentLoaded', () => {
    const btnSearch = document.getElementById('searchRouteBtn');
    if (btnSearch) {
        btnSearch.addEventListener('click', performRouteSearch);
    }

    const btnStationSearch = document.getElementById('searchStationBtn');
    if (btnStationSearch) {
        btnStationSearch.addEventListener('click', performStationSearch);
    }

    const inputStationSearch = document.getElementById('station-search-input');
    if (inputStationSearch) {
        inputStationSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performStationSearch();
            }
        });
    }

    const timeTypeSelect = document.getElementById('search-time-type');
    if (timeTypeSelect) {
        timeTypeSelect.addEventListener('change', (e) => {
            const timeInput = document.getElementById('search-time');
            if (timeInput) {
                if (e.target.value === 'arr' && timeInput.value === '00:00') {
                    timeInput.value = '23:59';
                } else if (e.target.value === 'dep' && timeInput.value === '23:59') {
                    timeInput.value = '00:00';
                }
            }
        });
    }

    // Ascoltatori per la ricerca Treno Live
    const btnLiveTrainSearch = document.getElementById('searchLiveTrainBtn');
    if (btnLiveTrainSearch) {
        btnLiveTrainSearch.addEventListener('click', () => {
            const trainInput = document.getElementById('live-train-search-input');
            if (trainInput) {
                const trainNum = trainInput.value.trim();
                if (trainNum) {
                    performLiveTrainSearch(trainNum);
                }
            }
        });
    }

    const inputLiveTrainSearch = document.getElementById('live-train-search-input');
    if (inputLiveTrainSearch) {
        inputLiveTrainSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const trainNum = inputLiveTrainSearch.value.trim();
                if (trainNum) {
                    performLiveTrainSearch(trainNum);
                }
            }
        });
        
        const clearLiveTrainSearchBtn = document.getElementById('clear-live-train-search-btn');
        inputLiveTrainSearch.addEventListener('input', () => {
            if (inputLiveTrainSearch.value.trim()) {
                clearLiveTrainSearchBtn.classList.remove('hidden');
            } else {
                clearLiveTrainSearchBtn.classList.add('hidden');
            }
        });
        
        if (clearLiveTrainSearchBtn) {
            clearLiveTrainSearchBtn.addEventListener('click', () => {
                inputLiveTrainSearch.value = '';
                clearLiveTrainSearchBtn.classList.add('hidden');
                const resultsContainer = document.getElementById('live-train-results-container');
                if (resultsContainer) {
                    resultsContainer.classList.add('hidden');
                    resultsContainer.innerHTML = '';
                }
                history.pushState({ view: 'live-train', treno: '' }, '', '?tab=live-train');
            });
        }
    }

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const dirParam = params.get('dir');
    const trenoParam = params.get('treno');
    
    if (tabParam === 'search') {
        history.replaceState({ view: 'home' }, '', window.location.pathname);
        history.pushState({ view: 'search' }, '', window.location.search);
        switchTab('search', false);
    } else if (tabParam === 'station') {
        history.replaceState({ view: 'home' }, '', window.location.pathname);
        history.pushState({ view: 'station' }, '', window.location.search);
        switchTab('station', false);
    } else if (tabParam === 'live-train' || trenoParam) {
        history.replaceState({ view: 'home' }, '', window.location.pathname);
        history.pushState({ view: 'live-train', treno: trenoParam || '' }, '', window.location.search);
        switchTab('live-train', false);
        if (trenoParam) {
            const trainInput = document.getElementById('live-train-search-input');
            if (trainInput) {
                trainInput.value = trenoParam;
                const clearBtn = document.getElementById('clear-live-train-search-btn');
                if (clearBtn) clearBtn.classList.remove('hidden');
            }
            performLiveTrainSearch(trenoParam, false);
        }
    } else if (dirParam) {
        history.replaceState({ view: 'home' }, '', window.location.pathname);
        history.pushState({ view: 'detail', direttrice: dirParam }, '', window.location.search);
        switchTab('monitor', false);
        selectDirettrice(dirParam, false);
    } else {
        history.replaceState({ view: 'home' }, '', window.location.pathname);
    }
});

// --- Gestione Pulsante Torna in Alto ---
window.addEventListener('scroll', () => {
    const btn = document.getElementById('backToTopBtn');
    if (!btn) return;
    if (window.scrollY > 300) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
});

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function toggleModalMap() {
    const container = document.getElementById('modal-map-container');
    const btn = document.getElementById('modal-map-toggle-btn');
    if (!container || !btn) return;
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.innerText = "🗺️ Nascondi Mappa";
        btn.classList.add('active');
        
        if (!trainMap) {
            loadLeafletAndRenderMap();
        } else {
            setTimeout(() => {
                if (trainMap) {
                    trainMap.invalidateSize();
                }
            }, 100);
        }
        
        // Auto-scroll del modal content per mostrare interamente la mappa
        setTimeout(() => {
            const modalContent = document.querySelector('#chartModal .modal-content');
            if (modalContent) {
                modalContent.scrollTo({
                    top: modalContent.scrollHeight,
                    behavior: 'smooth'
                });
            }
        }, 300);
    } else {
        container.classList.add('hidden');
        btn.innerText = "🗺️ Visualizza Mappa Percorso & Stato Live";
        btn.classList.remove('active');
    }
}

function loadLeafletAndRenderMap() {
    loadLeaflet(() => {
        if (!stationCoordinates) {
            fetch('data/stazioni_coordinate.json')
                .then(res => res.json())
                .then(coords => {
                    stationCoordinates = coords;
                    renderTrainMap();
                })
                .catch(err => {
                    console.error("Errore caricamento coordinate:", err);
                    const mapDiv = document.getElementById('train-map');
                    if (mapDiv) {
                        mapDiv.innerHTML = `
                            <div style="padding: 40px; text-align: center; color: var(--danger); font-size: 0.9rem;">
                                Impossibile caricare le coordinate delle stazioni.
                            </div>
                        `;
                    }
                });
        } else {
            renderTrainMap();
        }
    });
}

function loadLeaflet(callback) {
    if (leafletLoaded) {
        callback();
        return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
        leafletLoaded = true;
        callback();
    };
    document.head.appendChild(script);
}

function fetchLiveTrainForMap(trainNum, callback) {
    const vercelUrl = `https://trenord-monitor.vercel.app/api/train_live/${trainNum}`;
    fetch(vercelUrl)
        .then(res => {
            if (!res.ok) throw new Error("Errore API");
            return res.json();
        })
        .then(data => callback(data))
        .catch(err => {
            console.warn("Chiamata Vercel fallita per mappa, provo fallback locale...", err);
            const localUrl = `/api/train_live/${trainNum}`;
            fetch(localUrl)
                .then(res => res.json())
                .then(data => callback(data))
                .catch(localErr => {
                    console.error("Tutti i tentativi falliti per la mappa:", localErr);
                    callback(null);
                });
        });
}

function getStaticStopsForTrain(trainNum) {
    if (!cachedTimetable) return [];
    let stops = [];
    for (const stName in cachedTimetable) {
        const trainInfo = cachedTimetable[stName][trainNum];
        if (trainInfo) {
            const seq = typeof trainInfo.seq !== 'undefined' ? trainInfo.seq : trainInfo[0];
            const dep = trainInfo.dep || trainInfo[1];
            stops.push({
                stazione: stName,
                programmata: dep,
                seq: seq
            });
        }
    }
    stops.sort((a, b) => a.seq - b.seq);
    return stops;
}

function renderTrainMap() {
    const mapDiv = document.getElementById('train-map');
    if (!mapDiv || !currentModalTrainNum) return;
    
    mapDiv.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Caricamento mappa e tracciamento in corso...</div>';

    fetchLiveTrainForMap(currentModalTrainNum, (liveData) => {
        let stops = [];
        let currentStation = null;
        let trainStatusLabel = "Non attivo";
        let destination = "";
        
        if (liveData && liveData.fermate) {
            destination = liveData.destinazione || "";
            stops = liveData.fermate.map(f => ({
                stazione: f.stazione.toUpperCase().trim(),
                programmata: formatTime(f.programmata),
                effettiva: f.effettiva ? formatTime(f.effettiva) : null,
                ritardo: f.ritardo,
                stato: f.actualFermataType
            }));
            
            if (!liveData.arrivato && !liveData.nonPartito && liveData.stazioneUltimoRilevamento) {
                currentStation = liveData.stazioneUltimoRilevamento.toUpperCase().trim();
                trainStatusLabel = `In viaggio - Ritardo: ${liveData.ritardo} min`;
            } else if (liveData.arrivato) {
                trainStatusLabel = "Arrivato";
            } else if (liveData.nonPartito) {
                trainStatusLabel = "Non ancora partito";
            }
        } else {
            const staticStops = getStaticStopsForTrain(currentModalTrainNum);
            stops = staticStops.map(s => ({
                stazione: s.stazione.toUpperCase().trim(),
                programmata: s.programmata,
                effettiva: null,
                ritardo: 0,
                stato: 0
            }));
            trainStatusLabel = "Fuori servizio / Dati live non disponibili";
            if (stops.length > 0) {
                destination = stops[stops.length - 1].stazione;
            }
        }
        
        if (stops.length === 0) {
            mapDiv.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Nessuna fermata programmata trovata.</div>';
            return;
        }

        // Calcola la posizione attuale del treno sulla sequenza fermate
        let trainIndex = -1;
        if (currentStation) {
            trainIndex = stops.findIndex(st => st.stazione === currentStation);
        }
        if (trainIndex === -1 && liveData && !liveData.nonPartito && !liveData.arrivato) {
            // Fallback: ultima fermata con orario effettivo registrato
            stops.forEach((st, idx) => {
                if (st.effettiva) {
                    trainIndex = idx;
                }
            });
        }

        mapDiv.innerHTML = '';

        if (trainMap) {
            try {
                trainMap.remove();
            } catch (e) {
                console.warn("Errore distruzione mappa:", e);
            }
            trainMap = null;
        }
        
        trainMap = L.map('train-map', {
            zoomControl: true,
            scrollWheelZoom: true
        });

        // Auto-invalidate size when container size changes dynamically (ResizeObserver)
        if (window.ResizeObserver) {
            mapResizeObserver = new ResizeObserver(() => {
                if (trainMap) {
                    try {
                        trainMap.invalidateSize();
                    } catch (e) {}
                }
            });
            mapResizeObserver.observe(mapDiv);
        }

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(trainMap);

        let points = [];
        let activeMarker = null;

        stops.forEach((st, index) => {
            const coords = stationCoordinates[st.stazione];
            if (coords) {
                const latLng = [coords[0], coords[1]];
                points.push(latLng);
                
                let isCurrent = (index === trainIndex);
                let markerColor = '#94a3b8';
                
                if (st.stato === 3) {
                    markerColor = '#4b5563'; // Grigio scuro per fermata soppressa
                } else if (isCurrent) {
                    markerColor = '#ef4444'; // Rosso per posizione attuale
                } else if (st.effettiva) {
                    markerColor = '#10b981'; // Verde per completato
                } else {
                    markerColor = '#3b82f6'; // Blu per programmato
                }
                
                const marker = L.circleMarker(latLng, {
                    radius: isCurrent ? 7 : 5,
                    fillColor: markerColor,
                    color: st.stato === 3 ? '#ef4444' : '#ffffff', // Bordo rosso se soppressa
                    weight: st.stato === 3 ? 2 : 1.5,
                    opacity: 1,
                    fillOpacity: st.stato === 3 ? 0.4 : 0.8
                }).addTo(trainMap);
                
                // Mostra il nome della stazione al passaggio del mouse (hover)
                marker.bindTooltip(st.stazione, {
                    direction: 'top',
                    offset: [0, -5],
                    sticky: true
                });
                
                let popupContent = `<strong>${st.stazione}</strong>`;
                if (st.stato === 3) {
                    popupContent += `<br><span style="color:#ef4444; font-weight:bold;">FERMATA SOPPRESSA</span>`;
                } else {
                    popupContent += `<br>Prog. ${st.programmata}`;
                    if (st.effettiva) {
                        popupContent += `<br>Effettiva: <span style="color:#10b981; font-weight:600;">${st.effettiva}</span>`;
                    }
                    if (st.ritardo > 0) {
                        popupContent += ` <span style="color:#ef4444; font-weight:600;">(+${st.ritardo}')</span>`;
                    }
                }
                marker.bindPopup(popupContent);
                
                if (isCurrent) {
                    const trainIcon = L.divIcon({
                        html: '<div style="background-color: #ef4444; border: 2px solid #ffffff; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 12px rgba(239, 68, 68, 0.85); animation: pulse 1.8s infinite;">🚆</div>',
                        iconSize: [36, 36],
                        iconAnchor: [18, 18],
                        className: 'custom-train-icon'
                    });
                    activeMarker = L.marker(latLng, { icon: trainIcon }).addTo(trainMap);
                    
                    let trainTooltipText = `Treno ${currentModalTrainNum}`;
                    if (destination) {
                        trainTooltipText += ` per ${destination}`;
                    }
                    activeMarker.bindTooltip(trainTooltipText, {
                        direction: 'top',
                        offset: [0, -10],
                        sticky: true
                    });
                    
                    let trainPopupText = `<strong>Treno ${currentModalTrainNum}</strong>`;
                    if (destination) {
                        trainPopupText += `<br>Direzione: <strong>${destination}</strong>`;
                    }
                    trainPopupText += `<br>${trainStatusLabel}`;
                    activeMarker.bindPopup(trainPopupText);
                }
            }
        });

        if (points.length > 1) {
            const polyline = L.polyline(points, {
                color: '#3b82f6',
                weight: 4,
                opacity: 0.7,
                smoothFactor: 1
            }).addTo(trainMap);
            
            if (activeMarker) {
                trainMap.setView(activeMarker.getLatLng(), 11);
                setTimeout(() => {
                    try {
                        activeMarker.openPopup();
                    } catch (e) {}
                }, 500);
            } else {
                trainMap.fitBounds(polyline.getBounds(), { padding: [30, 30] });
            }
        } else if (points.length === 1) {
            trainMap.setView(points[0], 12);
        }
        
        // Multipli timeout per forzare l'invalidazione della taglia durante la renderizzazione del modal
        setTimeout(() => { if (trainMap) trainMap.invalidateSize(); }, 100);
        setTimeout(() => { if (trainMap) trainMap.invalidateSize(); }, 300);
        setTimeout(() => { if (trainMap) trainMap.invalidateSize(); }, 600);
    });
}

function cleanupMap() {
    if (mapResizeObserver) {
        try {
            mapResizeObserver.disconnect();
        } catch (e) {}
        mapResizeObserver = null;
    }
    if (trainMap) {
        try {
            // Raccoglie i layer in un array temporaneo prima di rimuoverli per evitare modifiche concorrenti durante eachLayer
            const layers = [];
            trainMap.eachLayer(layer => layers.push(layer));
            layers.forEach(layer => {
                try {
                    trainMap.removeLayer(layer);
                } catch (err) {}
            });
            trainMap.off();
            trainMap.remove();
        } catch (e) {
            console.warn("Errore pulizia Leaflet:", e);
        }
        trainMap = null;
    }
    const mapDiv = document.getElementById('train-map');
    if (mapDiv) {
        mapDiv.innerHTML = '';
    }
}
