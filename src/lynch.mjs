// Peter Lynch olcutleriyle mekanik puanlama. LLM yok, yorum yok — sadece formul.
// Esik degerleri Lynch'in "One Up on Wall Street" kitabinda tarif ettigi kurallardir.
import { temel } from './temel.mjs';
import { fiyat } from './fiyat.mjs';

/**
 * Taban yila guvenilir mi? Lynch, kotu bir yildan toparlanan sirketi "hizli buyuyen"
 * degil AYRI bir kategori (turnaround) sayar ve ona PEG uygulamaz.
 * Sifira yakin tabandan cikan %1400 gibi oranlar aritmetik olarak dogru, analitik olarak anlamsizdir.
 */
export const tabanSaglam = (yeni, eski) => {
  if (eski == null || eski <= 0 || yeni == null) return false;
  const buyume = (yeni / eski - 1) * 100;
  // %100'un ustundeki buyume taban yilin cok dusuk oldugunu gosterir (kar en az ikiye katlanmis).
  // Lynch boyle bir sirketi "hizli buyuyen" degil toparlanma sayar; PEG uygulanmaz.
  return buyume <= 100;
};

export const yuzdeDegisim = (yeni, eski) =>
  yeni == null || eski == null || eski === 0 ? null : (yeni / eski - 1) * 100;

/** Lynch'in sirket siniflandirmasi — buyume hizina gore. */
export function kategori(buyume, saglam) {
  if (buyume == null) return 'belirsiz';
  if (!saglam) return 'toparlanma';        // Lynch'in ayri kategorisi: turnaround
  if (buyume < 0) return 'zayıflayan';
  if (buyume < 10) return 'yavaş büyüyen';
  if (buyume < 20) return 'sağlam';
  if (buyume <= 50) return 'hızlı büyüyen';
  return 'aşırı hızlı';
}

/** Her olcut icin puan ve gerekce — esikler Lynch'in kendi kurallari. */
export function puanla(m) {
  const p = [];

  // 1. PEG — Lynch'in merkezi olcutu: "F/K, buyume oranina esitse adil fiyatlidir"
  if (!m.tabanSaglam) p.push([0, 'PEG', 'taban yıl çok düşük — PEG uygulanmaz']);
  else if (m.buyume == null || m.buyume <= 0) p.push([-2, 'PEG', 'kâr büyümesi yok/negatif']);
  else if (m.peg == null) p.push([0, 'PEG', 'hesaplanamadı']);
  else if (m.peg < 0.5) p.push([3, 'PEG', `${m.peg.toFixed(2)} — çok ucuz`]);
  else if (m.peg < 1.0) p.push([2, 'PEG', `${m.peg.toFixed(2)} — ucuz`]);
  else if (m.peg < 1.5) p.push([1, 'PEG', `${m.peg.toFixed(2)} — makul`]);
  else if (m.peg < 2.0) p.push([0, 'PEG', `${m.peg.toFixed(2)} — pahalı`]);
  else p.push([-1, 'PEG', `${m.peg.toFixed(2)} — çok pahalı`]);

  // 2. Borc/Ozkaynak — Lynch dusuk borcu sart kosar
  const b = m.borcOzkaynak;
  if (b == null) p.push([0, 'Borç', 'veri yok']);
  else if (b < 0.25) p.push([2, 'Borç', `${b.toFixed(2)} — çok düşük`]);
  else if (b < 0.50) p.push([1, 'Borç', `${b.toFixed(2)} — düşük`]);
  else if (b < 1.00) p.push([0, 'Borç', `${b.toFixed(2)} — orta`]);
  else if (b < 2.00) p.push([-1, 'Borç', `${b.toFixed(2)} — yüksek`]);
  else p.push([-2, 'Borç', `${b.toFixed(2)} — çok yüksek`]);

  // 3. Buyume hizi — %20-25 Lynch'in ideal araligi, %50 ustu surdurulemez sayilir
  const g = m.buyume;
  if (!m.tabanSaglam) p.push([0, 'Büyüme', `%${g?.toFixed(0) ?? '?'} — düşük tabandan, ölçülemez`]);
  else if (g == null) p.push([0, 'Büyüme', 'veri yok']);
  else if (g < 0) p.push([-2, 'Büyüme', `%${g.toFixed(0)} — kâr düşüyor`]);
  else if (g < 10) p.push([0, 'Büyüme', `%${g.toFixed(0)} — yavaş`]);
  else if (g < 20) p.push([1, 'Büyüme', `%${g.toFixed(0)} — sağlam`]);
  else if (g <= 25) p.push([2, 'Büyüme', `%${g.toFixed(0)} — ideal aralık`]);
  else if (g <= 50) p.push([1, 'Büyüme', `%${g.toFixed(0)} — hızlı`]);
  else p.push([0, 'Büyüme', `%${g.toFixed(0)} — sürdürülebilirlik şüpheli`]);

  // 4. Net nakit — Lynch nakiti fazla sirketi sever
  if (m.netNakit != null)
    p.push(m.netNakit > 0 ? [1, 'Nakit', 'net nakit pozitif'] : [0, 'Nakit', 'net borçlu']);

  // 5. Stok uyarisi — stok satistan hizli buyuyorsa Lynch bunu kotu isaret sayar
  if (m.stokBuyume != null && m.satisBuyume != null)
    p.push(m.stokBuyume > m.satisBuyume + 5
      ? [-1, 'Stok', `stok %${m.stokBuyume.toFixed(0)} > satış %${m.satisBuyume.toFixed(0)}`]
      : [0, 'Stok', 'normal']);

  return p;
}

/** Tek hisse icin tam degerlendirme. */

/**
 * Temel veri + fiyattan Lynch olcutlerini uretir.
 * Hem guncel (lynch) hem gecmis (gecmis.mjs) hesaplamalari bunu kullanir.
 */
export function olcutler(t, fiyat, hacim = null) {
  const piyasaDegeri = t.hisseAdedi && fiyat ? t.hisseAdedi * fiyat : null;
  const fk = piyasaDegeri && t.ttmKar > 0 ? piyasaDegeri / t.ttmKar : null;
  const buyume = yuzdeDegisim(t.fyKar.onceki, t.fyKar.oncekiOnceki);
  const saglam = tabanSaglam(t.fyKar.onceki, t.fyKar.oncekiOnceki);

  const m = {
    kod: t.kod, donem: t.donem, fiyat, piyasaDegeri, fk, buyume, hacim,
    ttmKar: t.ttmKar, hisseAdedi: t.hisseAdedi,
    satisBuyume: yuzdeDegisim(t.fySatis.onceki, t.fySatis.oncekiOnceki),
    tabanSaglam: saglam,
    peg: fk != null && buyume > 0 && saglam ? fk / buyume : null,
    borcOzkaynak: t.ozkaynak > 0 ? t.finansalBorc / t.ozkaynak : null,
    netNakit: t.nakit != null ? t.nakit - t.finansalBorc : null,
    roe: t.ozkaynak > 0 && t.ttmKar != null ? (t.ttmKar / t.ozkaynak) * 100 : null,
    stokBuyume: yuzdeDegisim(t.stok, t.fyStok.onceki),
  };
  const kalemler = puanla(m);
  return { ...m, kategori: kategori(buyume, saglam), kalemler,
           puan: kalemler.reduce((a, [n]) => a + n, 0), enYuksek: 8 };
}

export async function lynch(kod) {
  const [t, f] = await Promise.all([temel(kod), fiyat(kod)]);

  const piyasaDegeri = t.hisseAdedi && f.fiyat ? t.hisseAdedi * f.fiyat : null;

  // Likidite: son 20 gunun ortalama gunluk TL islem hacmi.
  // Yuksek puanli ama gunde birkac milyon TL islem goren hisse tuzaktir —
  // puana katilmaz, kullanici sussun diye ayri alan olarak verilir.
  const son20 = f.mumlar.slice(-20).filter(c => c.h != null && c.k != null);
  const hacim = son20.length ? son20.reduce((a, c) => a + c.h * c.k, 0) / son20.length : null;
  const fk = piyasaDegeri && t.ttmKar > 0 ? piyasaDegeri / t.ttmKar : null;
  const buyume = yuzdeDegisim(t.fyKar.onceki, t.fyKar.oncekiOnceki);
  const saglam = tabanSaglam(t.fyKar.onceki, t.fyKar.oncekiOnceki);
  const satisBuyume = yuzdeDegisim(t.fySatis.onceki, t.fySatis.oncekiOnceki);

  const m = {
    kod: t.kod, donem: t.donem, fiyat: f.fiyat, piyasaDegeri, fk, buyume, satisBuyume,
    // ham temel veri: ceyreklik degisir, fiyat degisince F/K canli yeniden hesaplanabilsin
    ttmKar: t.ttmKar, hisseAdedi: t.hisseAdedi, hacim,
    tabanSaglam: saglam,
    peg: fk != null && buyume > 0 && saglam ? fk / buyume : null,
    borcOzkaynak: t.ozkaynak > 0 ? t.finansalBorc / t.ozkaynak : null,
    netNakit: t.nakit != null ? t.nakit - t.finansalBorc : null,
    roe: t.ozkaynak > 0 && t.ttmKar != null ? (t.ttmKar / t.ozkaynak) * 100 : null,
    stokBuyume: yuzdeDegisim(t.stok, t.fyStok.onceki),
  };

  const kalemler = puanla(m);
  return {
    ...m,
    kategori: kategori(buyume, saglam),
    kalemler,
    puan: kalemler.reduce((a, [n]) => a + n, 0),
    enYuksek: 8,   // 3+2+2+1 (stok 0)
  };
}

/** Birden fazla hisse; basarisizlar atlanmaz, isaretlenir. */
export const lynchCoklu = kodlar =>
  Promise.all(kodlar.map(k => lynch(k).catch(e => ({ kod: k.toUpperCase(), hata: e.message }))));

/**
 * Uc durumlu alim sinyali. "Alim sekli degisti" uyarilari bu durumun
 * degismesiyle tetiklenir; esikler Lynch'in kendi olcutlerine dayanir.
 *   AL    : puan >= 4 VE PEG < 1 VE borc/ozkaynak < 0.5
 *   KACIN : puan <= -3 (olcutlerin cogunda takilmis)
 *   BEKLE : arasi
 */
export function sinyal(h) {
  if (h?.puan == null) return 'VERİ YOK';
  if (h.puan >= 4 && h.peg != null && h.peg < 1 && h.borcOzkaynak != null && h.borcOzkaynak < 0.5) return 'AL';
  if (h.puan <= -3) return 'KAÇIN';
  return 'BEKLE';
}
