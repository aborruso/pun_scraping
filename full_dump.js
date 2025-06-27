// pun_full_dump.js
// node pun_full_dump.js
// Script completo e valido (Node ≥20 + Puppeteer ≥21)
// 1. Cattura i token AWS temporanei
// 2. Scarica l’elenco EVSE (57913)
// 3. Fa richieste /group firmate dal browser per:
//    • 2 ID di test → pun_specific.json
//    • tutti gli ID → pun_pdr_details.ndjson

const puppeteer = require('puppeteer');
const fs = require('fs');

/* helper: sleep senza waitForTimeout (compatibilità) */
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  /* ---------- intercetta e salva il primo token AWS SigV4 ---------- */
  await page.setRequestInterception(true);
  let tokenDumped = false;
  page.on('request', req => {
    const h = req.headers();
    if (!tokenDumped && h['authorization'] && req.url().includes('/v1/chargepoints/public/map/search')) {
      fs.writeFileSync('.env.aws',
`AUTHORIZATION=${h['authorization']}
X_AMZ_DATE=${h['x-amz-date']}
X_AMZ_SECURITY_TOKEN=${h['x-amz-security-token']}
`);
      console.log('\n🔐  Token AWS intercettato -> .env.aws');
      tokenDumped = true;
    }
    req.continue();
  });

  /* ---------- stream di output ---------- */
  const listOut   = fs.createWriteStream('pun_pdr.ndjson',         { flags: 'w' });
  const detailOut = fs.createWriteStream('pun_pdr_details.ndjson', { flags: 'w' });

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

  /* ---------- helper: richiesta /group firmata dal browser ---------- */
  async function fetchGroup(idArr) {
    return await page.evaluate(async arr => {
      const r = await fetch('/v1/chargepoints/group', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(arr)
      });
      if (!r.ok) return { error: r.status, text: await r.text() };
      const ct = r.headers.get('content-type') || '';
      return ct.includes('application/json') ? await r.json() : { error: 'not-json' };
    }, idArr);
  }

  /* ---------- fase 2: dettagli per 2 ID di test ---------- */
  const testIds = [
    'IT*ENX*E22XP22T3QQ1AN00755*2',
    'IT*ENX*E22XP22T3QQ1AN00755*1'
  ];
  const testDetails = await fetchGroup(testIds);
  console.log('\n🔍  Dettagli (test su 2 ID):');
  console.log(JSON.stringify(testDetails, null, 2));
  fs.writeFileSync('pun_specific.json', JSON.stringify(testDetails, null, 2));

  /* ---------- fase 3: dettagli per tutti gli EVSE ---------- */
  const idList = Array.from(ids);
  const batch = 100;
  for (let i = 0; i < idList.length; i += batch) {
    const slice = idList.slice(i, i + batch);
    const chunk = await fetchGroup(slice);
    if (Array.isArray(chunk)) chunk.forEach(d => detailOut.write(JSON.stringify(d) + '\n'));
    console.log(`🟢  dettagli ${Math.min(i + slice.length, idList.length)}/${idList.length}`);
    await sleep(350); // evita rate‑limit
  }

  detailOut.end();
  await browser.close();
  console.log('\n🚀  Dump completato con successo. File generati: pun_pdr.ndjson, pun_pdr_details.ndjson, pun_specific.json');
})();
