export default async function handler(req, res) {
    // Enable CORS for frontend requests
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Vercel routes path parameters via rewrite query or req.query
    const { numero } = req.query;
    if (!numero) {
        return res.status(400).json({ error: "Numero treno mancante." });
    }

    try {
        const autocompleteUrl = `https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/cercaNumeroTrenoTrenoAutocomplete/${encodeURIComponent(numero)}`;
        const autoRes = await fetch(autocompleteUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        const text = await autoRes.text();
        
        if (!text || !text.trim()) {
            return res.status(404).json({ error: `Treno ${numero} non trovato.` });
        }
        
        const lines = text.trim().split("\n");
        let targetLine = null;
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            if (line.includes("|")) {
                const parts = line.split("|");
                const subparts = parts[1].split("-");
                if (subparts.length >= 3 && subparts[0] === numero) {
                    targetLine = line;
                    break;
                }
            }
        }
        
        if (!targetLine && lines.length > 0 && lines[0].includes("|")) {
            targetLine = lines[0].trim();
        }
        
        if (!targetLine) {
            return res.status(404).json({ error: `Treno ${numero} non trovato.` });
        }
        
        const parts = targetLine.split("|");
        const subparts = parts[1].split("-");
        const codiceStazione = subparts[1];
        const timestamp = subparts[2];
        
        const detailUrl = `https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/andamentoTreno/${codiceStazione}/${encodeURIComponent(numero)}/${timestamp}`;
        const detailRes = await fetch(detailUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        
        if (!detailRes.ok) {
            return res.status(detailRes.status).json({ error: `Errore da Viaggiatreno: ${detailRes.status}` });
        }
        
        const data = await detailRes.json();
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
