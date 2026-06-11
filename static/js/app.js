let myChart = null;
let trendChart = null;
let overallTrendChart = null;

let allTrainsData = []; // Store per i filtri
let currentFilter = 'all';
let currentSearch = '';
let selectedDirettrice = null;

let lastDirettriceMap = {};
let currentDirettriciSearch = '';

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
    } else {
        renderHomePage(lastDirettriceMap);
    }
    
    updateModalFavButton(numero);
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
                        <span class="fav-train-name">${t.linea} ${t.numero}</span>
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
                        <span style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; display: inline-block;">${serviziStr}</span>
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
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
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
                    <strong>${t.linea} ${t.numero}</strong>
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
    
    document.getElementById('chartModal').style.display = "flex";
    document.getElementById('modal-treno-title').innerText = `Treno ${t.linea} ${t.numero}`.trim();
    document.getElementById('modal-treno-subtitle').innerText = t.destinazione ? `${t.origine} ➔ ${t.destinazione}` : t.origine;

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

window.onclick = function (event) {
    let chartModal = document.getElementById('chartModal');
    let disclaimerModal = document.getElementById('disclaimerModal');
    let iosInstallModal = document.getElementById('iosInstallModal');
    if (event.target == chartModal) {
        closeModal();
    }
    if (event.target == disclaimerModal) {
        closeDisclaimerModal();
    }
    if (event.target == iosInstallModal) {
        closeIosModal();
    }
}

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
    
    const routeView = document.getElementById('route-search-view');
    const homeView = document.getElementById('home-view');
    const detailView = document.getElementById('detail-view');
    
    if (!tabMon || !tabSrc) return;

    if (tabName === 'search') {
        tabMon.classList.remove('active');
        tabSrc.classList.add('active');
        
        routeView.classList.remove('hidden');
        homeView.classList.add('hidden');
        detailView.classList.add('hidden');
        
        initStationAutocomplete();
        
        if (pushState) {
            history.pushState({ view: 'search' }, '', '?tab=search');
        }
    } else {
        tabMon.classList.add('active');
        tabSrc.classList.remove('active');
        
        routeView.classList.add('hidden');
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
                            <span class="route-train-num">${t.linea} ${t.numero}</span>
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

// --- Gestione Navigazione con Tasto Indietro (History API) ---
window.addEventListener('popstate', (event) => {
    const state = event.state;
    if (state) {
        if (state.view === 'search') {
            switchTab('search', false);
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

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const dirParam = params.get('dir');
    
    if (tabParam === 'search') {
        history.replaceState({ view: 'home' }, '', window.location.pathname);
        history.pushState({ view: 'search' }, '', window.location.search);
        switchTab('search', false);
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
