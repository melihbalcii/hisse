// Sanal portfoy — gercek para yok, emir gonderilmez.
// Durum Netlify Blobs'ta tutulur; yerelde onbellek yoksa bellekte kalir.
import { oku, yaz } from './onbellek.mjs';
import { fiyatlar, fiyat } from './fiyat.mjs';

const ANAHTAR = 'portfoy';
export const BASLANGIC = 100_000;   // TL
const KOMISYON = 0.0002;            // binde 0.2 — BIST'te tipik aracilik orani

const bosPortfoy = () => ({
  nakit: BASLANGIC,
  baslangic: BASLANGIC,
  acilis: new Date().toISOString(),
  pozisyonlar: {},   // { THYAO: { adet, toplamMaliyet } }
  islemler: [],
});

export async function getir() {
  return (await oku(ANAHTAR)) ?? bosPortfoy();
}

async function kaydet(p) {
  await yaz(ANAHTAR, p);
  return p;
}

/** Alim. Yetersiz nakit veya gecersiz girdi hata dondurur. */
export async function al(kod, adet, fiyatBirim) {
  kod = kod.toUpperCase();
  adet = Math.floor(Number(adet));
  if (!Number.isFinite(adet) || adet <= 0) throw new Error('adet pozitif tam sayi olmali');
  if (!Number.isFinite(fiyatBirim) || fiyatBirim <= 0) throw new Error('fiyat alinamadi');

  const p = await getir();
  const tutar = adet * fiyatBirim;
  const maliyet = tutar * (1 + KOMISYON);
  if (maliyet > p.nakit)
    throw new Error(`yetersiz nakit: ${maliyet.toFixed(2)} TL gerekli, ${p.nakit.toFixed(2)} TL var`);

  const mevcut = p.pozisyonlar[kod] ?? { adet: 0, toplamMaliyet: 0 };
  p.pozisyonlar[kod] = {
    adet: mevcut.adet + adet,
    toplamMaliyet: mevcut.toplamMaliyet + maliyet,   // ortalama maliyet komisyon dahil
  };
  p.nakit -= maliyet;
  p.islemler.unshift({ tarih: new Date().toISOString(), tip: 'AL', kod, adet, fiyat: fiyatBirim, tutar: maliyet });
  return kaydet(p);
}

/** Satis. Elde olandan fazlasi satilamaz (aciga satis yok). */
export async function sat(kod, adet, fiyatBirim) {
  kod = kod.toUpperCase();
  adet = Math.floor(Number(adet));
  if (!Number.isFinite(adet) || adet <= 0) throw new Error('adet pozitif tam sayi olmali');

  const p = await getir();
  const poz = p.pozisyonlar[kod];
  if (!poz || poz.adet < adet) throw new Error(`elde yeterli ${kod} yok (${poz?.adet ?? 0} adet)`);
  if (!Number.isFinite(fiyatBirim) || fiyatBirim <= 0) throw new Error('fiyat alinamadi');

  const hasilat = adet * fiyatBirim * (1 - KOMISYON);
  const oran = adet / poz.adet;
  const cikanMaliyet = poz.toplamMaliyet * oran;

  poz.adet -= adet;
  poz.toplamMaliyet -= cikanMaliyet;
  if (poz.adet === 0) delete p.pozisyonlar[kod];

  p.nakit += hasilat;
  p.islemler.unshift({
    tarih: new Date().toISOString(), tip: 'SAT', kod, adet, fiyat: fiyatBirim,
    tutar: hasilat, kar: hasilat - cikanMaliyet,
  });
  return kaydet(p);
}

export async function sifirla() {
  return kaydet(bosPortfoy());
}

/** Guncel fiyatlarla portfoy ozeti. */
export async function ozet() {
  const p = await getir();
  const kodlar = Object.keys(p.pozisyonlar);
  const f = kodlar.length ? await fiyatlar(kodlar) : [];
  const fiyatMap = new Map(f.filter(x => !x.hata).map(x => [x.kod, x]));

  const satirlar = kodlar.map(kod => {
    const poz = p.pozisyonlar[kod];
    const c = fiyatMap.get(kod);
    const ortMaliyet = poz.toplamMaliyet / poz.adet;
    const deger = c?.fiyat != null ? poz.adet * c.fiyat : null;
    return {
      kod, adet: poz.adet, ortMaliyet,
      fiyat: c?.fiyat ?? null,
      gunlukDegisim: c?.degisimYuzde ?? null,
      deger,
      kar: deger != null ? deger - poz.toplamMaliyet : null,
      karYuzde: deger != null ? (deger / poz.toplamMaliyet - 1) * 100 : null,
    };
  }).sort((a, b) => (b.deger ?? 0) - (a.deger ?? 0));

  const hisseDegeri = satirlar.reduce((t, s) => t + (s.deger ?? 0), 0);
  const toplam = p.nakit + hisseDegeri;

  // Kiyas: ayni parayi XU100'e koysaydik ne olurdu?
  // Portfoy acilis gununden bugune endeks getirisi.
  let endeks = null;
  try {
    const x = await fiyat('XU100', { range: '3mo', interval: '1d' });
    const acilisMs = new Date(p.acilis).getTime();
    const baslangicMum = x.mumlar.find(c => c.t.getTime() >= acilisMs) ?? x.mumlar.at(0);
    if (baslangicMum && x.fiyat)
      endeks = { getiriYuzde: (x.fiyat / baslangicMum.k - 1) * 100, seviye: x.fiyat };
  } catch { /* endeks alinamazsa portfoy yine gosterilir */ }

  return {
    nakit: p.nakit, hisseDegeri, toplam,
    baslangic: p.baslangic,
    kar: toplam - p.baslangic,
    karYuzde: (toplam / p.baslangic - 1) * 100,
    acilis: p.acilis, endeks,
    gun: Math.floor((Date.now() - new Date(p.acilis)) / 864e5),
    pozisyonlar: satirlar,
    islemler: p.islemler.slice(0, 40),
  };
}
