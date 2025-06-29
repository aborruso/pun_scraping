// Script per scaricare l'elenco completo dei punti di ricarica dalla Piattaforma Unica Nazionale

const puppeteer = require('puppeteer');
const fs = require('fs');

/* helper: sleep senza waitForTimeout (compatibilità) */
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  /* ---------- stream di output ---------- */
  const listOut   = fs.createWriteStream('../data/pun_pdr.ndjson',         { flags: 'w' });

  /* ---------- fase 1: elenco EVSE ---------- */
  const ids = new Set();
  page.on('response', async res => {
    if (!res.url().includes('/v1/chargepoints/public/map/search')) return;
    try {
      const { content = [] } = await res.json();
      content.forEach(o => {
        listOut.write(JSON.stringify(o) + '\n');
        ids.add(o.evse_id);
      });
      if (content.length) console.log(`📄  +${content.length} (tot ${ids.size})`);
    } catch {}
  });

  await page.goto('https://www.piattaformaunicanazionale.it/idr', { waitUntil: 'networkidle2' });

  for (let p = 0;; p++) {
    const before = ids.size;
    await page.evaluate(pg => fetch('/v1/chargepoints/public/map/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ page: pg, size: 12000 })
    }), p);
    await sleep(1200);
    if (ids.size === before) break; // pagina vuota → fine ciclo
  }
  listOut.end();
  console.log(`✅  Raccolti ${ids.size} EVSE`);

  await browser.close();
  console.log('\n🚀  Dump completato con successo. File generato: pun_pdr.ndjson');
})();
