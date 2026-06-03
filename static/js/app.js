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

document.getElementById('searchDirettriciInput').addEventListener('input', (e) => {
    currentDirettriciSearch = e.target.value.toLowerCase();
    renderHomePage(lastDirettriceMap);
});

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

        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: mdata.trend.map(t => t.data.substring(5)), // Solo MM-DD
                datasets: [{
                    label: 'Disagio %',
                    data: mdata.trend.map(t => t.disagio),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: mdata.trend.map(t => t.disagio > 20 ? '#ef4444' : (t.disagio > 5 ? '#f59e0b' : '#10b981'))
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
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
    }
}

function renderHomePage(direttriciMap) {
    lastDirettriceMap = direttriciMap;
    const grid = document.getElementById('direttrici-grid');
    let html = '';
    
    const dirs = Object.values(direttriciMap);
    
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
    
    // Ordinamento numerico (es. Direttrice 1, 3, 7, 12, 33)
    filteredDirs.sort((a, b) => {
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
        
        html += `
            <div class="direttrice-card" onclick="selectDirettrice('${encodeURIComponent(dir.nome)}')">
                <div class="direttrice-header">
                    <div>
                        <h3 class="direttrice-name">${dir.nome}</h3>
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

function selectDirettrice(dirNameEscaped) {
    const dirName = decodeURIComponent(dirNameEscaped);
    selectedDirettrice = dirName;
    currentFilter = 'all'; 
    
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('detail-view').classList.remove('hidden');
    
    document.getElementById('current-direttrice-title').innerText = dirName;
    
    updateDetailView(dirName);
    renderTable();
}

function showHome() {
    selectedDirettrice = null;
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('home-view').classList.remove('hidden');
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
    buttonsHtml += `<button class="filter-btn ${currentFilter === 'critici' ? 'active' : ''}" data-filter="critici" style="border-color: var(--danger); color: var(--danger);">Solo Critici</button>`;
    
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

        tbodyHTML += `
            <tr ${trClass} onclick="openModal('${trenoData}', ${t.numero})">
                <td><strong>${t.linea} ${t.numero}</strong></td>
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
    const t = JSON.parse(decodeURIComponent(trenoDataStr));
    document.getElementById('chartModal').style.display = "flex";
    document.getElementById('modal-treno-title').innerText = `Treno ${t.linea} ${t.numero}`;
    document.getElementById('modal-treno-subtitle').innerText = `${t.origine} ➔ ${t.destinazione}`;

    if (IS_STATIC) {
        renderChart(STATIC_HISTORY[numero] || []);
    } else {
        fetch(`/api/train_history/${numero}`)
            .then(res => res.json())
            .then(data => renderChart(data.history))
            .catch(err => console.error("Errore chart:", err));
    }
}

function renderChart(historyArray) {
    const ctx = document.getElementById('delayChart').getContext('2d');
    if (myChart) myChart.destroy();

    const labels = historyArray.map(h => h.data);
    const delays = historyArray.map(h => h.ritardo_capolinea);
    const colors = historyArray.map(h => h.critico ? '#ef4444' : '#3b82f6');

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ritardo al capolinea',
                data: delays,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#2e3440' },
                    ticks: { color: '#8b92a5' }
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

        overallTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: mdata.trend.map(t => t.data.substring(5)), // Solo MM-DD
                datasets: [{
                    label: 'Disagio Complessivo %',
                    data: mdata.trend.map(t => t.disagio),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: mdata.trend.map(t => t.disagio > 20 ? '#ef4444' : (t.disagio > 5 ? '#f59e0b' : '#10b981'))
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
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
