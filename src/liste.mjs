// BIST sirket listesi — KAP'in /tr/bist-sirketler sayfasindan cikarilir.
// KAP'in acik bir sirket listesi API'si yok; veri sayfanin RSC yukune gomulu.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ONBELLEK = join(HERE, '..', 'veri', 'sirketler.json');
const SAYFA = 'https://www.kap.org.tr/tr/bist-sirketler';

/** Sayfadan sirket kayitlarini cikarir. */
function ayikla(html) {
  const s = html.replace(/\\"/g, '"');
  const kayitlar = [...s.matchAll(
    /"kapMemberTitle":"([^"]+)","relatedMemberTitle":"[^"]*","stockCode":"([^"]*)"/g,
  )].map(m => ({ ad: m[1].replace(/\s+A\.[ŞS]\.$/, '').trim(), kod: m[2] }));

  // Ayni koddan tek kayit; birden fazla kod tasiyanlar (ISATR, ISBTR...) elenir
  return [...new Map(
    kayitlar.filter(x => x.kod && !x.kod.includes(',')).map(x => [x.kod, x]),
  ).values()].sort((a, b) => a.kod.localeCompare(b.kod, 'tr'));
}

/** Sirket listesi. Yerel onbellek varsa oradan, yoksa KAP'tan cekip yazar. */
export async function sirketler({ tazele = false } = {}) {
  if (!tazele && existsSync(ONBELLEK)) {
    try { return JSON.parse(readFileSync(ONBELLEK, 'utf8')); } catch {}
  }
  const r = await fetch(SAYFA, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw new Error(`sirket listesi alinamadi: HTTP ${r.status}`);
  const liste = ayikla(await r.text());
  if (!liste.length) throw new Error('sirket listesi bos — sayfa yapisi degismis olabilir');
  try {
    mkdirSync(dirname(ONBELLEK), { recursive: true });
    writeFileSync(ONBELLEK, JSON.stringify(liste));
  } catch {}
  return liste;
}
