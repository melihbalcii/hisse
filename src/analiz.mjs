// Bildirimleri LLM ile okuyup fiyat etkisine gore puanlar.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const NIM = 'https://integrate.api.nvidia.com/v1/chat/completions';
// Olculdu: 3/3 basarili, ort 1.3s, kati bicim talimatina uyuyor.
const MODEL = 'nvidia/nemotron-3-super-120b-a12b';

// Sunucusuz ortamda ortam degiskeni, yerelde ~/Desktop/nv/.env.
// Tembel yuklenir: modul import'unda cokmemesi icin (Netlify fonksiyonu bu yuzden patlar).
let _key;
function anahtar() {
  if (_key) return _key;
  if (process.env.NVIDIA_API_KEY) return (_key = process.env.NVIDIA_API_KEY);
  try {
    const m = readFileSync(join(homedir(), 'Desktop', 'nv', '.env'), 'utf8')
      .match(/^\s*NVIDIA_API_KEY\s*=\s*(.+)$/m);
    if (m) return (_key = m[1].trim());
  } catch {}
  throw new Error('NVIDIA_API_KEY yok — ortam degiskeni olarak tanimla');
}

const SISTEM = `Sen BIST hisselerini takip eden bir finans analistisin.
Sana bir KAP bildirimi verilecek. Hisse fiyatina etkisini degerlendir.

SADECE su bicimde tek satir yaz, baska hicbir sey yazma:
SKOR|GEREKCE

SKOR: -1.0 ile 1.0 arasi ondalik sayi.
  1.0 = cok olumlu, 0 = etkisiz/rutin, -1.0 = cok olumsuz
GEREKCE: en fazla 15 kelime, Turkce.`;

const bekle = ms => new Promise(r => setTimeout(r, ms));

/** Tek bir bildirimi puanlar. NIM ara sira 503 veriyor — 3 kez deneriz. */
export async function skorla({ baslik, hisse, sirket }, metin = '') {
  const govde = metin.slice(0, 3000) || baslik;
  let r;
  for (let deneme = 0; deneme < 3; deneme++) {
    r = await fetch(NIM, {
    method: 'POST',
    signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${anahtar()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, temperature: 0.1, max_tokens: 400,   // 120 az geliyor: dusunce cevaba tasiyor
      messages: [
        { role: 'system', content: SISTEM },
        { role: 'user', content: `Hisse: ${hisse ?? '-'}\nSirket: ${sirket}\nBaslik: ${baslik}\n\n${govde}` },
      ],
    }),
    });
    if (r.ok || (r.status !== 503 && r.status !== 429)) break;
    await bekle(1200 * (deneme + 1));   // artan bekleme
  }
  if (!r.ok) {
    if (r.status === 403) throw new Error('NVIDIA kotasi tukendi veya anahtar gecersiz (HTTP 403)');
    if (r.status === 429) throw new Error('hiz siniri asildi (HTTP 429)');
    throw new Error(`HTTP ${r.status}`);
  }
  const j = await r.json();
  const txt = (j.choices?.[0]?.message?.content ?? '').trim();

  // Model ara sira aciklama ekliyor — SKOR|GEREKCE satirini ayikla
  const satir = txt.split('\n').find(l => /^-?\d*\.?\d+\s*\|/.test(l.trim())) ?? txt;
  const [ham, ...g] = satir.split('|');
  const skor = Number(String(ham).trim());
  return {
    skor: Number.isFinite(skor) ? Math.max(-1, Math.min(1, skor)) : null,
    gerekce: g.join('|').trim() || txt.slice(0, 80),
  };
}

/** Es zamanlilik sinirli map — KAP'i ve NIM'i bogmamak icin. */
export async function paralel(liste, isle, sinir = 5) {
  const sonuc = new Array(liste.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(sinir, liste.length) }, async () => {
    while (i < liste.length) {
      const k = i++;
      try { sonuc[k] = await isle(liste[k], k); }
      catch (e) { sonuc[k] = { hata: e.message }; }
    }
  }));
  return sonuc;
}
