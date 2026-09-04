// "O zaman alsaydım ne olurdu?" — gecmis bir tarihteki Lynch olcutlerini
// O GUN BILINEN verilerle hesaplar ve bugune kadarki getiriyi olcer.
//
// Kritik nokta: mali tablolar gecikmeyle yayimlanir. temel(kod,{bugun}) o tarihte
// HANGI bilancolarin yayimlanmis oldugunu modelleyerek getirir — yani gelecege
// bakma (look-ahead bias) yapilmaz.
import { temel } from './temel.mjs';
import { fiyat } from './fiyat.mjs';
import { olcutler, sinyal } from './lynch.mjs';
import { enflasyon } from './enflasyon.mjs';

export { enflasyon };

export const DONEMLER = [
  { ad: '1 ay', gun: 30 },
  { ad: '3 ay', gun: 90 },
  { ad: '6 ay', gun: 180 },
  { ad: '1 yıl', gun: 365 },
];

/** Hedef tarihe en yakin islem gunu mumu. */
function enYakinMum(mumlar, hedefMs) {
  let en = null, enFark = Infinity;
  for (const c of mumlar) {
    const fark = Math.abs(c.t.getTime() - hedefMs);
    if (fark < enFark) { enFark = fark; en = c; }
  }
  // 10 gunden uzak eslesme guvenilmez (hisse o tarihte islem gormuyordu)
  return enFark <= 10 * 864e5 ? en : null;
}

/** Bir hisse icin tum donemlerin gecmis puani ve getirisi. */
export async function gecmis(kod) {
  const f = await fiyat(kod, { range: '2y', interval: '1d' });
  if (!f.fiyat || f.mumlar.length < 30) throw new Error(`${kod}: yeterli fiyat gecmisi yok`);

  const donemler = [];
  for (const d of DONEMLER) {
    const hedef = Date.now() - d.gun * 864e5;
    const mum = enYakinMum(f.mumlar, hedef);
    if (!mum) continue;
    try {
      const t = await temel(kod, { bugun: new Date(hedef) });
      if (t.ttmKar == null || !t.hisseAdedi) continue;
      const m = olcutler(t, mum.k);
      donemler.push({
        ad: d.ad, gun: d.gun,
        tarih: mum.t.toISOString().slice(0, 10),
        donem: m.donem,                       // o tarihte gecerli bilanco donemi
        fiyatOZaman: mum.k,
        puan: m.puan, fk: m.fk, peg: m.peg,
        buyume: m.buyume, borcOzkaynak: m.borcOzkaynak,
        kategori: m.kategori, sinyal: sinyal(m),
        getiri: (f.fiyat / mum.k - 1) * 100,   // o gunden bugune, NOMINAL
                                               // reel getiri arayuzde secilen olcute gore hesaplanir
      });
    } catch { /* o tarihte mali tablosu yoksa donem atlanir */ }
  }
  if (!donemler.length) throw new Error(`${kod}: gecmis hesaplanamadi`);
  return { kod, ad: f.ad, fiyat: f.fiyat, donemler };
}

/**
 * Toplu ozet: her donem icin puan aralıklarına göre ORTALAMA GETIRI.
 * Asil soru bu — yuksek puan gercekten daha iyi getiri getirmis mi?
 */
export function ozetle(hisseler) {
  const kovalar = [
    { ad: '+5 ve üstü', test: p => p >= 5 },
    { ad: '+2 … +4', test: p => p >= 2 && p <= 4 },
    { ad: '-1 … +1', test: p => p >= -1 && p <= 1 },
    { ad: '-2 ve altı', test: p => p <= -2 },
  ];
  return DONEMLER.map(d => {
    const kayitlar = hisseler.flatMap(h => h.donemler.filter(x => x.ad === d.ad));
    return {
      donem: d.ad, gun: d.gun,
      kovalar: kovalar.map(k => {
        const uyan = kayitlar.filter(x => k.test(x.puan));
        const ort = uyan.length ? uyan.reduce((a, x) => a + x.getiri, 0) / uyan.length : null;
        const medyan = uyan.length
          ? [...uyan].sort((a, b) => a.getiri - b.getiri)[Math.floor(uyan.length / 2)].getiri : null;
        return { ad: k.ad, adet: uyan.length, ortalama: ort, medyan };
      }),
      tumu: kayitlar.length ? kayitlar.reduce((a, x) => a + x.getiri, 0) / kayitlar.length : null,
    };
  });
}
