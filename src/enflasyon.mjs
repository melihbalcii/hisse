// Reel getiri hesabi. Nominal getiri tek basina yaniltir: %26 kazanc,
// enflasyon %40 ise %10 REEL KAYIP demektir.
//
// Uc olcut sunulur, kullanici hangisine gore bakacagini secer:
//  - TUFE  : resmi tuketici enflasyonu (TCMB EVDS, ucretsiz ama API anahtari ister)
//  - Dolar : USD/TRY degisimi — sert para karsisinda korunma
//  - Altin : gram altin TL — Turkiye'nin klasik enflasyon korunagi
//            (ons USD x kur / 31.1035; dogrudan TL gram serisi Yahoo'da yok)
import { fiyat } from './fiyat.mjs';

const EVDS = 'https://evds2.tcmb.gov.tr/service/evds';
const gg = d => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;

/** TUFE endeksi (TP.FG.J0). Anahtar yoksa null doner — sistem calismaya devam eder. */
async function tufeSerisi(gunSayisi) {
  const anahtar = process.env.EVDS_API_KEY;
  if (!anahtar) return null;
  const bit = new Date(), bas = new Date(Date.now() - (gunSayisi + 70) * 864e5);
  try {
    const u = `${EVDS}/series=TP.FG.J0&startDate=${gg(bas)}&endDate=${gg(bit)}&type=json&aggregationTypes=avg&formulas=0&frequency=5`;
    const r = await fetch(u, { headers: { key: anahtar }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    const j = await r.json();
    const seri = (j.items ?? [])
      .map(x => ({ tarih: x.Tarih, deger: Number(x['TP_FG_J0']) }))
      .filter(x => Number.isFinite(x.deger));
    if (seri.length < 2) return null;
    return (seri.at(-1).deger / seri[0].deger - 1) * 100;   // donem enflasyonu %
  } catch { return null; }
}

const ONS_GRAM = 31.1035;

/** Hedef tarihe en yakin mum. */
function enYakin(mumlar, hedefMs) {
  let en = null, ef = Infinity;
  for (const c of mumlar) {
    const f = Math.abs(c.t.getTime() - hedefMs);
    if (f < ef) { ef = f; en = c; }
  }
  return en;
}

/**
 * Donem bazinda enflasyon olcutleri.
 * @param {number[]} gunler  or. [30, 90, 180, 365]
 */
export async function enflasyon(gunler) {
  const [kur, ons] = await Promise.all([
    fiyat('USDTRY=X', { range: '10y', interval: '1d' }).catch(() => null),
    fiyat('GC=F', { range: '10y', interval: '1d' }).catch(() => null),
  ]);
  const gramSimdi = kur && ons ? (ons.fiyat / ONS_GRAM) * kur.fiyat : null;

  const out = {};
  for (const g of gunler) {
    const hedef = Date.now() - g * 864e5;
    let dolar = null, altin = null;
    if (kur?.fiyat) {
      const k = enYakin(kur.mumlar, hedef);
      if (k) dolar = (kur.fiyat / k.k - 1) * 100;
      if (ons && gramSimdi) {
        const o = enYakin(ons.mumlar, hedef);
        if (o && k) altin = (gramSimdi / ((o.k / ONS_GRAM) * k.k) - 1) * 100;
      }
    }
    out[g] = { tufe: await tufeSerisi(g), dolar, altin };
  }
  return out;
}

/** Nominal getiriyi enflasyona gore reel getiriye cevirir. */
export const reel = (nominalYuzde, enflasyonYuzde) =>
  nominalYuzde == null || enflasyonYuzde == null
    ? null
    : ((1 + nominalYuzde / 100) / (1 + enflasyonYuzde / 100) - 1) * 100;
