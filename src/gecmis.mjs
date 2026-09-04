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
  { ad: '2 yıl', gun: 730 },
  { ad: '3 yıl', gun: 1095 },
  { ad: '4 yıl', gun: 1460 },
  { ad: '5 yıl', gun: 1825 },
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

/**
 * O tarihteki gunluk ortalama TL islem hacmi (onceki 20 islem gunu).
 * Backtest'in durustlugu icin sart: gunde 2 milyon TL islem goren bir hisseye
 * "alsaydin %1400 kazanirdin" demek anlamsizdir, o pozisyona girilemezdi.
 */
function hacimOZaman(mumlar, hedefMs) {
  const oncesi = mumlar.filter(c => c.t.getTime() <= hedefMs && c.h != null).slice(-20);
  if (oncesi.length < 5) return null;
  return oncesi.reduce((a, c) => a + c.h * c.k, 0) / oncesi.length;
}

/** Bir hisse icin tum donemlerin gecmis puani ve getirisi. */
export async function gecmis(kod) {
  const f = await fiyat(kod, { range: '10y', interval: '1d' });
  if (!f.fiyat || f.mumlar.length < 30) throw new Error(`${kod}: yeterli fiyat gecmisi yok`);

  const donemler = [];
  for (const d of DONEMLER) {
    const hedef = Date.now() - d.gun * 864e5;
    const mum = enYakinMum(f.mumlar, hedef);
    if (!mum) continue;
    try {
      const t = await temel(kod, { bugun: new Date(hedef) });
      if (t.ttmKar == null || !t.hisseAdedi) continue;
      const m = olcutler(t, mum.k, hacimOZaman(f.mumlar, hedef));
      donemler.push({
        ad: d.ad, gun: d.gun,
        tarih: mum.t.toISOString().slice(0, 10),
        donem: m.donem,                       // o tarihte gecerli bilanco donemi
        fiyatOZaman: mum.k,
        hacim: m.hacim,                       // o gunku likidite — filtreleme icin
        puan: m.puan, fk: m.fk, peg: m.peg, pd: m.pd,
        buyume: m.buyume, borcOzkaynak: m.borcOzkaynak,
        kategori: m.kategori, egilim: m.egilim, sinyal: sinyal(m),
        getiri: (f.fiyat / mum.k - 1) * 100,   // o gunden bugune, NOMINAL
                                               // reel getiri arayuzde secilen olcute gore hesaplanir
      });
    } catch { /* o tarihte mali tablosu yoksa donem atlanir */ }
  }
  if (!donemler.length) throw new Error(`${kod}: gecmis hesaplanamadi`);
  return { kod, ad: f.ad, fiyat: f.fiyat, donemler };
}

/**
 * Toplu ozet: her donem icin puan aralıklarına göre getiri.
 *
 * ORTALAMA yaniltir — tek bir %1400'luk mikro hisse butun kovayi kaldirir.
 * Bu yuzden MEDYAN da verilir; kovalari karsilastirirken medyana bakilmalidir.
 *
 * @param {number} enAzHacim  gunluk TL islem hacmi esigi; altindakiler elenir
 *                            (o pozisyona gercekten girilemezdi)
 */
export function ozetle(hisseler, enAzHacim = 0) {
  const kovalar = [
    { ad: '+5 ve üstü', test: p => p >= 5 },
    { ad: '+2 … +4', test: p => p >= 2 && p <= 4 },
    { ad: '-1 … +1', test: p => p >= -1 && p <= 1 },
    { ad: '-2 ve altı', test: p => p <= -2 },
  ];
  const medyan = a => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y), o = s.length >> 1;
    return s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2;
  };
  return DONEMLER.map(d => {
    const kayitlar = hisseler
      .flatMap(h => h.donemler.filter(x => x.ad === d.ad))
      .filter(x => !enAzHacim || (x.hacim != null && x.hacim >= enAzHacim));
    return {
      donem: d.ad, gun: d.gun,
      kovalar: kovalar.map(k => {
        const g = kayitlar.filter(x => k.test(x.puan)).map(x => x.getiri);
        return {
          ad: k.ad, adet: g.length,
          ortalama: g.length ? g.reduce((a, x) => a + x, 0) / g.length : null,
          medyan: medyan(g),
        };
      }),
      tumu: kayitlar.length ? kayitlar.reduce((a, x) => a + x.getiri, 0) / kayitlar.length : null,
      medyanTumu: medyan(kayitlar.map(x => x.getiri)),
      adet: kayitlar.length,
    };
  });
}
